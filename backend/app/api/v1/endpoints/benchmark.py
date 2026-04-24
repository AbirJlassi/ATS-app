"""
Endpoints de benchmark — /api/v1/benchmark

Accès :
  - ADMINISTRATEUR : peut lancer un benchmark, lister et consulter les runs
  - RECRUTEUR      : lecture seule (pas de POST)
  - CANDIDAT       : aucun accès

Types de benchmarks supportés :
  - PARSER   : évaluation du parser CV (choix d'un preset LLM)
  - MATCHING : évaluation du moteur de matching + ablation study
"""
import json
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_role
from app.db.session import get_db
from app.evaluation.service import BenchmarkService
from app.models.benchmark_run import BenchmarkKind
from app.models.user import Role, User
from app.schemas.benchmark import (
    BenchmarkRunCreate,
    BenchmarkRunDetail,
    BenchmarkRunSummary,
)

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])

# Chemins vers les datasets de vérité terrain
_PARSER_DATASET_PATH = (
    Path(__file__).resolve().parents[3]
    / "evaluation" / "datasets" / "parser_ground_truth.json"
)
_MATCHING_DATASET_PATH = (
    Path(__file__).resolve().parents[3]
    / "evaluation" / "datasets" / "matching_ground_truth.json"
)


# ── Dépendance locale : admin OU recruteur ────────────────────────
def _require_admin_or_recruiter(
    current_user: User = Depends(get_active_user),
) -> User:
    """Lecture partagée entre ADMINISTRATEUR et RECRUTEUR."""
    if current_user.role not in (Role.ADMINISTRATEUR, Role.RECRUTEUR):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Accès réservé à l'administrateur et aux recruteurs.",
        )
    return current_user


# ──────────────────────────────────────────────────────────────────
#  POST  /benchmark     → lance un nouveau run (Admin uniquement)
# ──────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=BenchmarkRunSummary,
    status_code=status.HTTP_202_ACCEPTED,
)
def launch_benchmark(
    data: BenchmarkRunCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.ADMINISTRATEUR)),
):
    """
    Lance un nouveau benchmark.

    - PARSER   : évalue le parser CV (fournir `parser_preset`)
    - MATCHING : évalue le moteur de matching avec ablation study
                 (pas de preset nécessaire)

    Répond immédiatement 202 Accepted avec le run en statut EN_ATTENTE.
    Le frontend doit poller GET /benchmark/{id} jusqu'à TERMINE ou ECHEC.
    """
    # Validation et normalisation selon le type
    if data.kind == BenchmarkKind.PARSER:
        preset = data.parser_preset or "fast"
    elif data.kind == BenchmarkKind.MATCHING:
        preset = None  # pas de preset pour le matching
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Type de benchmark non supporté : {data.kind}",
        )

    try:
        run = BenchmarkService.create_pending_run(
            db,
            kind          = data.kind,
            parser_preset = preset,
            model_name    = data.model_name,
            triggered_by  = current_user.id,
        )
    except FileNotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    BenchmarkService.launch_async(run.id, preset)
    return run


# ──────────────────────────────────────────────────────────────────
#  GET   /benchmark     → liste les runs (Admin + Recruteur)
# ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[BenchmarkRunSummary])
def list_benchmarks(
    limit: int = 50,
    kind: Optional[BenchmarkKind] = Query(None, description="Filtrer par type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin_or_recruiter),
):
    """Liste les runs les plus récents, éventuellement filtrés par type."""
    return BenchmarkService.list_runs(db, limit=limit, kind=kind)


# ──────────────────────────────────────────────────────────────────
#  GET   /benchmark/dataset/{cv_id}  → texte brut d'un CV du dataset
# ──────────────────────────────────────────────────────────────────

@router.get("/dataset/{cv_id}")
def get_dataset_cv(
    cv_id: str,
    current_user: User = Depends(_require_admin_or_recruiter),
):
    """
    Retourne le texte brut et les annotations attendues d'un CV
    du dataset PARSER ground truth.
    """
    if not _PARSER_DATASET_PATH.exists():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Dataset de vérité terrain introuvable.",
        )

    with open(_PARSER_DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    for entry in dataset:
        if entry["id"] == cv_id:
            return {
                "id": entry["id"],
                "text": entry["text"],
                "expected": entry.get("expected"),
            }

    raise HTTPException(
        status.HTTP_404_NOT_FOUND,
        f"CV '{cv_id}' introuvable dans le dataset.",
    )


# ──────────────────────────────────────────────────────────────────
#  GET   /benchmark/matching-dataset/{offre_id}  → infos d'une offre
# ──────────────────────────────────────────────────────────────────

@router.get("/matching-dataset/{offre_id}")
def get_matching_offre(
    offre_id: str,
    current_user: User = Depends(_require_admin_or_recruiter),
):
    """
    Retourne les informations structurées d'une offre du dataset MATCHING
    + la liste des candidats associés (avec leurs labels de vérité).
    """
    if not _MATCHING_DATASET_PATH.exists():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Dataset de matching introuvable.",
        )

    with open(_MATCHING_DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    for group in dataset:
        if group.get("offre_id") == offre_id:
            return {
                "offre_id":  group["offre_id"],
                "offre":     group["offre"],
                "candidats": [
                    {
                        "cv_id": c["cv_id"],
                        "label": c["label"],
                        "cv_data": c.get("cv_data"),
                    }
                    for c in group.get("candidats", [])
                ],
            }

    raise HTTPException(
        status.HTTP_404_NOT_FOUND,
        f"Offre '{offre_id}' introuvable dans le dataset.",
    )


# ──────────────────────────────────────────────────────────────────
#  GET   /benchmark/{id}  → détail d'un run (Admin + Recruteur)
# ──────────────────────────────────────────────────────────────────

@router.get("/{run_id}", response_model=BenchmarkRunDetail)
def get_benchmark(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin_or_recruiter),
):
    """Détail complet d'un run avec les métriques détaillées."""
    run = BenchmarkService.get_run(db, run_id)
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run introuvable.")
    return run