"""
BenchmarkService — orchestre l'exécution asynchrone des benchmarks.

Supporte deux types de benchmarks :
  - PARSER   : évaluation du parser CV sur parser_ground_truth.json
  - MATCHING : évaluation du moteur de matching + ablation study
               sur matching_ground_truth.json

Le run est lancé dans un thread daemon ; le statut est mis à jour en base
(EN_ATTENTE → EN_COURS → TERMINE / ECHEC) pour que le frontend puisse poller.
"""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.evaluation.evaluator import DATASET_PATH as PARSER_DATASET_PATH
from app.evaluation.evaluator import load_dataset as load_parser_dataset
from app.evaluation.evaluator import run_benchmark
from app.models.benchmark_run import BenchmarkKind, BenchmarkRun, BenchmarkStatut

_logger = logging.getLogger(__name__)

# ── Chemins des datasets ──────────────────────────────────────────
MATCHING_DATASET_PATH = (
    Path(__file__).parent / "datasets" / "matching_ground_truth.json"
)


def load_matching_dataset() -> list[dict]:
    """Charge le dataset de matching depuis le JSON préparé."""
    if not MATCHING_DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset de matching introuvable : {MATCHING_DATASET_PATH}. "
            f"Exécute d'abord : python -m app.evaluation.prepare_matching_dataset"
        )
    with open(MATCHING_DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _matching_pair_count(dataset: list[dict]) -> int:
    """Compte le nombre total de paires (CV × offre) dans le dataset."""
    return sum(len(g.get("candidats", [])) for g in dataset)


class BenchmarkService:

    # ──────────────────────────────────────────────────────────────
    #  Création d'un run (synchrone, appelé depuis l'endpoint)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def create_pending_run(
        db: Session,
        *,
        kind: BenchmarkKind,
        parser_preset: Optional[str],
        model_name: Optional[str],
        triggered_by: Optional[UUID],
    ) -> BenchmarkRun:
        """Enregistre un run en statut EN_ATTENTE, prêt à être exécuté."""

        # Routage selon le type de benchmark
        if kind == BenchmarkKind.PARSER:
            dataset = load_parser_dataset()
            dataset_name = PARSER_DATASET_PATH.name
            dataset_size = len(dataset)
        elif kind == BenchmarkKind.MATCHING:
            dataset = load_matching_dataset()
            dataset_name = MATCHING_DATASET_PATH.name
            dataset_size = _matching_pair_count(dataset)
        else:
            raise ValueError(f"BenchmarkKind inconnu : {kind}")

        run = BenchmarkRun(
            kind          = kind,
            statut        = BenchmarkStatut.EN_ATTENTE,
            parser_preset = parser_preset,
            model_name    = model_name,
            dataset_name  = dataset_name,
            dataset_size  = dataset_size,
            triggered_by  = triggered_by,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    # ──────────────────────────────────────────────────────────────
    #  Lancement asynchrone
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def launch_async(run_id: UUID, parser_preset: Optional[str]) -> None:
        """
        Démarre l'exécution en arrière-plan et rend la main immédiatement.
        Le thread est daemon → ne bloque pas l'arrêt du serveur.
        """
        thread = threading.Thread(
            target=BenchmarkService._execute,
            args=(run_id, parser_preset),
            daemon=True,
            name=f"benchmark-{run_id}",
        )
        thread.start()

    @staticmethod
    def _execute(run_id: UUID, parser_preset: Optional[str]) -> None:
        """
        Tâche de fond :
          1. charge le run
          2. route selon kind (PARSER ou MATCHING)
          3. persiste le résultat ou l'erreur
        """
        db: Session = SessionLocal()
        run: Optional[BenchmarkRun] = None
        try:
            run = db.query(BenchmarkRun).filter(BenchmarkRun.id == run_id).first()
            if not run:
                _logger.error("BenchmarkRun %s introuvable en base", run_id)
                return

            run.statut     = BenchmarkStatut.EN_COURS
            run.started_at = datetime.now(timezone.utc)
            db.commit()

            if run.kind == BenchmarkKind.PARSER:
                BenchmarkService._execute_parser(run, parser_preset or "fast")
            elif run.kind == BenchmarkKind.MATCHING:
                BenchmarkService._execute_matching(run)
            else:
                raise ValueError(f"BenchmarkKind non supporté : {run.kind}")

            run.statut      = BenchmarkStatut.TERMINE
            run.finished_at = datetime.now(timezone.utc)
            db.commit()

            _logger.info(
                "BenchmarkRun %s [%s] terminé — score global %.3f",
                run_id, run.kind.value, run.global_score or 0.0,
            )

        except Exception as exc:   # noqa: BLE001
            _logger.exception("BenchmarkRun %s a échoué", run_id)
            if run is not None:
                try:
                    run.statut        = BenchmarkStatut.ECHEC
                    run.finished_at   = datetime.now(timezone.utc)
                    run.error_message = str(exc)[:2000]
                    db.commit()
                except Exception:   # noqa: BLE001
                    db.rollback()
        finally:
            db.close()

    # ──────────────────────────────────────────────────────────────
    #  Handler PARSER (existant)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _execute_parser(run: BenchmarkRun, parser_preset: str) -> None:
        """Évaluation du parser CV."""
        parse_fn = BenchmarkService._build_parse_fn(parser_preset)
        result   = run_benchmark(parse_fn)

        run.global_score  = result["global_score"]
        run.field_summary = result["field_summary"]
        run.detail        = result

    # ──────────────────────────────────────────────────────────────
    #  Handler MATCHING (nouveau)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _execute_matching(run: BenchmarkRun) -> None:
        """
        Évaluation du moteur de matching sur le dataset préparé,
        avec ablation study sur 4 configurations.
        """
        # Import local pour éviter de charger les lourds modèles inutilement
        from app.evaluation.matching_evaluator import run_matching_benchmark

        dataset = load_matching_dataset()
        result  = run_matching_benchmark(dataset)

        # Guard : si aucune paire n'a pu être calculée, lever une erreur explicite
        if result.get("n_pairs", 0) == 0:
            errors = result.get("errors", [])
            sample = errors[0]["error"] if errors else "erreur inconnue"
            raise RuntimeError(
                f"Aucune paire de matching calculée ({len(errors)} erreurs). "
                f"Première erreur : {sample}"
            )

        # Score global = F1 macro de la meilleure config
        best_cfg_name = result["best_config"]
        best_cfg      = result["configs"][best_cfg_name]
        global_score  = best_cfg["classification"]["f1_macro"]

        # Field summary = métriques clés de la meilleure config
        # (valeurs ∈ [0,1] pour être compatibles avec l'affichage existant)
        spearman = best_cfg["ranking"]["spearman_rho_mean"]
        field_summary = {
            "accuracy":  best_cfg["classification"]["accuracy"],
            "f1_macro":  best_cfg["classification"]["f1_macro"],
            "ndcg":      best_cfg["ranking"]["ndcg_mean"],
            "spearman":  max(0.0, spearman),  # clamp négatifs à 0 pour l'affichage
        }

        run.global_score  = global_score
        run.field_summary = field_summary
        run.detail        = result

    # ──────────────────────────────────────────────────────────────
    #  Construction du parser (pour PARSER uniquement)
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _build_parse_fn(preset: str):
        """
        Construit une fonction (texte) -> dict en utilisant CVParserFactory.
        """
        ALLOWED_PRESETS = {"fast", "accurate", "fastest", "best", "multilingual"}
        if preset not in ALLOWED_PRESETS:
            raise ValueError(
                f"Preset inconnu: {preset!r}. "
                f"Presets valides : {sorted(ALLOWED_PRESETS)}"
            )

        # Import local pour éviter de charger spaCy/Groq si le service n'est pas utilisé
        from app.services.cv_parser import CVParserFactory

        factory_method = getattr(CVParserFactory, preset)
        parser         = factory_method()

        def parse_fn(text: str) -> dict:
            cv_data = parser.parse_text(text)
            return json.loads(cv_data.to_json())

        return parse_fn

    # ──────────────────────────────────────────────────────────────
    #  Lecture
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def list_runs(
        db: Session,
        limit: int = 50,
        kind: Optional[BenchmarkKind] = None,
    ) -> list[BenchmarkRun]:
        """Liste les runs, éventuellement filtrés par type."""
        query = db.query(BenchmarkRun)
        if kind is not None:
            query = query.filter(BenchmarkRun.kind == kind)
        return query.order_by(BenchmarkRun.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_run(db: Session, run_id: UUID) -> Optional[BenchmarkRun]:
        return db.query(BenchmarkRun).filter(BenchmarkRun.id == run_id).first()