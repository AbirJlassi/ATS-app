"""
Orchestrateur du benchmark parser.

Itère sur le dataset de vérité terrain, appelle le parser sur chaque CV,
calcule les scores par champ via `metrics.score_field`, puis agrège.

Conçu pour être indépendant du parser : `run_benchmark` prend une fonction
`parse_fn` en argument. Cela permet de benchmarker plusieurs implémentations
sans coupler l'évaluateur à une lib particulière.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

from app.evaluation.metrics import score_field


#: Dataset par défaut — modifiable pour A/B-tester plusieurs jeux de données
DATASET_PATH = Path(__file__).parent / "datasets" / "parser_ground_truth.json"


# ──────────────────────────────────────────────────────────────────────
#  Chargement
# ──────────────────────────────────────────────────────────────────────

def load_dataset(path: Path = DATASET_PATH) -> list[dict]:
    """Charge le dataset de vérité terrain depuis un fichier JSON."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ──────────────────────────────────────────────────────────────────────
#  Scoring
# ──────────────────────────────────────────────────────────────────────

def evaluate_single(predicted: dict, expected: dict) -> dict:
    """
    Compare la sortie du parser à la vérité attendue pour UN CV.

    Ne score que les champs présents dans `expected` — un champ absent
    n'est pas évalué (évite de pénaliser le parser pour un champ facultatif
    que le candidat n'a pas renseigné).
    """
    fields = {}
    for field, truth in expected.items():
        pred = predicted.get(field) if predicted else None
        fields[field] = score_field(field, pred, truth)

    scores = [r["score"] for r in fields.values()]
    cv_score = sum(scores) / len(scores) if scores else 0.0
    return {"cv_score": cv_score, "fields": fields}


def aggregate(cv_results: list[dict]) -> dict:
    """
    Agrège les résultats individuels :
      - score global = moyenne des scores par CV
      - field_summary = moyenne par champ sur tous les CV où il est évalué
    """
    field_totals: dict[str, list[float]] = {}
    for item in cv_results:
        for field, res in item.get("fields", {}).items():
            field_totals.setdefault(field, []).append(res["score"])

    field_summary = {
        field: sum(scores) / len(scores)
        for field, scores in field_totals.items()
    }
    ok_results = [r for r in cv_results if r.get("status") == "ok"]
    global_score = (
        sum(r["cv_score"] for r in ok_results) / len(ok_results)
        if ok_results else 0.0
    )
    return {"global_score": global_score, "field_summary": field_summary}


# ──────────────────────────────────────────────────────────────────────
#  Orchestration
# ──────────────────────────────────────────────────────────────────────

def run_benchmark(
    parse_fn: Callable[[str], dict | None],
    dataset: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Exécute le benchmark complet.

    Args:
        parse_fn : fonction `(texte_brut) -> dict` qui applique le parser à tester.
                   Doit retourner un dict compatible CVData (full_name, email, skills…).
        dataset  : liste d'entrées {id, text, expected}. Chargé depuis DATASET_PATH
                   si non fourni.

    Returns:
        Dict JSON-sérialisable avec :
          - global_score     : float [0, 1]
          - field_summary    : {field: moyenne}
          - cv_count         : nb total de CV dans le dataset
          - cv_success_count : nb de CV où le parser n'a pas levé d'exception
          - cv_results       : liste détaillée par CV
          - elapsed_seconds  : durée totale
    """
    dataset = dataset if dataset is not None else load_dataset()
    started = time.monotonic()
    cv_results: list[dict] = []

    for cv in dataset:
        cv_id = cv.get("id", "?")
        try:
            prediction = parse_fn(cv["text"]) or {}
        except Exception as exc:   # noqa: BLE001
            cv_results.append({
                "id": cv_id,
                "status": "error",
                "error": str(exc),
                "cv_score": 0.0,
                "fields": {},
            })
            continue

        single = evaluate_single(prediction, cv["expected"])
        cv_results.append({
            "id": cv_id,
            "status": "ok",
            "cv_score": single["cv_score"],
            "fields": single["fields"],
        })

    agg = aggregate(cv_results)
    elapsed = time.monotonic() - started

    return {
        "cv_count": len(dataset),
        "cv_success_count": sum(1 for r in cv_results if r["status"] == "ok"),
        "global_score": agg["global_score"],
        "field_summary": agg["field_summary"],
        "cv_results": cv_results,
        "elapsed_seconds": round(elapsed, 2),
    }
