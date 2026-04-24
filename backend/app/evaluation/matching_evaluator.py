"""
matching_evaluator.py — Évaluateur du matching avec ablation study.

Lit un dataset préparé (CVs parsés + offres structurées + labels humains)
et exécute le matching sous 4 configurations d'ablation.

Chaque configuration utilise un sous-ensemble des couches du moteur :
  - skills_only    : compétences seules (baseline minimale)
  - deterministic  : skills + expérience + formation (règles, pas de ML)
  - full           : système complet (règles + embeddings sémantiques)
  - semantic_only  : embeddings seuls (ML pur, pas de règles)

Pour chaque configuration, on calcule :
  - Classification : accuracy, F1 macro, F1 par classe
  - Ranking        : Spearman ρ moyen, nDCG moyen (par groupe offre)
  - Confusion matrix

Le résultat est un dict JSON-sérialisable prêt à stocker dans BenchmarkRun.detail.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from app.evaluation.matching_metrics import (
    classification_report,
    confusion_matrix,
    spearman_rho,
    ndcg_at_k,
    score_to_label,
    DATASET_LABELS,
    LABEL_TO_INT,
)

logger = logging.getLogger("matching_evaluator")


# ─────────────────────────────────────────────────────────────
#  Configurations d'ablation
# ─────────────────────────────────────────────────────────────

ABLATION_CONFIGS: dict[str, dict[str, float]] = {
    "skills_only": {
        "skills": 1.0, "experience": 0.0, "semantic": 0.0, "formation": 0.0,
        "description": "Compétences seules — baseline minimale",
    },
    "deterministic": {
        # Poids originaux (0.35/0.25/0.15) renormalisés sur 0.75 → somme = 1.0
        "skills": 0.467, "experience": 0.333, "semantic": 0.0, "formation": 0.200,
        "description": "Règles métier sans ML (skills + expérience + formation)",
    },
    "full": {
        "skills": 0.35, "experience": 0.25, "semantic": 0.25, "formation": 0.15,
        "description": "Système complet (règles + embeddings sémantiques)",
    },
    "semantic_only": {
        "skills": 0.0, "experience": 0.0, "semantic": 1.0, "formation": 0.0,
        "description": "Embeddings sémantiques seuls — ML pur",
    },
}


def _compute_ablation_score(
    sub_scores: dict[str, float],
    config: dict[str, float],
) -> float:
    """
    Calcule le score total pour une configuration d'ablation donnée.

    Args:
        sub_scores : {"skills": 80, "experience": 100, "semantic": 65.2, "formation": 60}
        config     : poids par composant (somme = 1.0)
    """
    total = (
        sub_scores["skills"]     * config["skills"]
        + sub_scores["experience"] * config["experience"]
        + sub_scores["semantic"]   * config["semantic"]
        + sub_scores["formation"]  * config["formation"]
    )
    return round(total, 1)


# ─────────────────────────────────────────────────────────────
#  Calcul des sous-scores pour une paire CV-offre
# ─────────────────────────────────────────────────────────────

def compute_sub_scores(cv_data: dict, offre: dict) -> dict[str, float]:
    """
    Calcule les 4 sous-scores du matching sans produire de MatchScore complet.
    Réutilise les couches existantes du MatchingEngine.

    Retourne : {"skills": X, "experience": X, "semantic": X, "formation": X}
    """
    from app.services.matching_service import RulesLayer, EmbeddingLayer

    rules = RulesLayer()
    embedder = EmbeddingLayer()

    cv_skills      = cv_data.get("skills", [])
    cv_experiences = cv_data.get("experiences", [])
    cv_education   = cv_data.get("education", [])
    cv_summary     = cv_data.get("summary") or ""

    offre_skills  = offre.get("competences_requises", [])
    offre_titre   = offre.get("titre", "")
    offre_desc    = offre.get("description", "")
    offre_domaine = offre.get("domaine", "")
    annees_min    = int(offre.get("annees_experience_min", 0) or 0)

    # Couche 1 — Règles
    score_skills, _, _ = rules.compute_skills_score(cv_skills, offre_skills)
    score_exp, _       = rules.compute_experience_score(cv_experiences, annees_min)
    score_edu          = rules.compute_formation_score(cv_education, offre_domaine)

    # Couche 2 — Embeddings
    score_sem = embedder.compute(
        cv_summary, cv_skills, cv_experiences,
        offre_titre, offre_desc, offre_skills,
    )

    return {
        "skills":     float(score_skills),
        "experience": float(score_exp),
        "semantic":   float(score_sem),
        "formation":  float(score_edu),
    }


# ─────────────────────────────────────────────────────────────
#  Évaluation d'une configuration sur le dataset
# ─────────────────────────────────────────────────────────────

def _evaluate_config(
    pairs: list[dict],
    config_name: str,
    config: dict[str, float],
) -> dict[str, Any]:
    """
    Évalue une configuration d'ablation sur toutes les paires.

    Chaque paire a : {"sub_scores": {...}, "true_label": int, "offre_id": str}
    """
    y_true = []
    y_pred = []
    scores = []

    for pair in pairs:
        score = _compute_ablation_score(pair["sub_scores"], config)
        pred_label = score_to_label(score)
        y_true.append(pair["true_label"])
        y_pred.append(pred_label)
        scores.append(score)
        pair[f"score_{config_name}"] = score  # stocke pour ranking par groupe

    # Classification
    cls_report = classification_report(y_true, y_pred, DATASET_LABELS)
    cm = confusion_matrix(y_true, y_pred, n_classes=3)

    # Ranking par groupe d'offre
    groups = {}
    for pair, score in zip(pairs, scores):
        gid = pair["offre_id"]
        groups.setdefault(gid, {"scores": [], "labels": []})
        groups[gid]["scores"].append(score)
        groups[gid]["labels"].append(pair["true_label"])

    spearman_values = []
    ndcg_values     = []

    for gid, group in groups.items():
        if len(group["scores"]) < 2:
            continue  # pas de ranking possible avec 1 candidat
        rho = spearman_rho(group["scores"], [float(l) for l in group["labels"]])
        ndcg = ndcg_at_k(group["scores"], group["labels"])
        spearman_values.append(rho)
        ndcg_values.append(ndcg)

    avg_spearman = sum(spearman_values) / len(spearman_values) if spearman_values else 0.0
    avg_ndcg     = sum(ndcg_values) / len(ndcg_values) if ndcg_values else 0.0

    return {
        "config_name":  config_name,
        "description":  config.get("description", ""),
        "weights":      {k: v for k, v in config.items() if k != "description"},
        "classification": cls_report,
        "confusion_matrix": cm,
        "ranking": {
            "spearman_rho_mean": round(avg_spearman, 4),
            "ndcg_mean":         round(avg_ndcg, 4),
            "n_groups":          len(spearman_values),
        },
    }


# ─────────────────────────────────────────────────────────────
#  Orchestrateur principal
# ─────────────────────────────────────────────────────────────

def run_matching_benchmark(
    dataset: list[dict],
) -> dict[str, Any]:
    """
    Exécute le benchmark matching complet avec ablation study.

    Args:
        dataset : liste de groupes, chaque groupe = {
            "offre_id": str,
            "offre": { titre, description, domaine, competences_requises, annees_experience_min },
            "candidats": [
                { "cv_id": str, "cv_data": dict, "label": "No Fit" | "Potential Fit" | "Good Fit" },
                ...
            ]
        }

    Returns:
        Dict JSON-sérialisable avec :
          - n_pairs, n_offres
          - configs : résultats par configuration d'ablation
          - best_config : nom de la meilleure configuration (F1 macro)
          - elapsed_seconds
    """
    started = time.monotonic()

    # ── Aplatir en paires et calculer les sous-scores ──────────
    pairs: list[dict] = []
    errors: list[dict] = []

    for group in dataset:
        offre_id  = group["offre_id"]
        offre     = group["offre"]

        for cand in group["candidats"]:
            try:
                sub_scores = compute_sub_scores(cand["cv_data"], offre)
                pairs.append({
                    "cv_id":      cand["cv_id"],
                    "offre_id":   offre_id,
                    "sub_scores": sub_scores,
                    "true_label": LABEL_TO_INT[cand["label"]],
                })
            except Exception as e:
                logger.error("Erreur matching %s × %s : %s", cand["cv_id"], offre_id, e)
                errors.append({
                    "cv_id": cand["cv_id"],
                    "offre_id": offre_id,
                    "error": str(e),
                })

    logger.info(
        "Sous-scores calculés : %d paires OK, %d erreurs",
        len(pairs), len(errors),
    )

    if not pairs:
        return {
            "n_pairs": 0, "n_offres": 0,
            "configs": {},
            "errors": errors,
            "elapsed_seconds": round(time.monotonic() - started, 2),
        }

    # ── Évaluer chaque configuration d'ablation ───────────────
    configs_results = {}
    for name, config in ABLATION_CONFIGS.items():
        logger.info("Évaluation config : %s", name)
        configs_results[name] = _evaluate_config(pairs, name, config)

    # ── Meilleure config ──────────────────────────────────────
    best_config = max(
        configs_results.items(),
        key=lambda x: x[1]["classification"]["f1_macro"],
    )[0]

    elapsed = time.monotonic() - started

    n_offres = len({p["offre_id"] for p in pairs})

    return {
        "n_pairs":          len(pairs),
        "n_offres":         n_offres,
        "best_config":      best_config,
        "configs":          configs_results,
        "label_distribution": {
            DATASET_LABELS[i]: sum(1 for p in pairs if p["true_label"] == i)
            for i in range(3)
        },
        "errors":           errors,
        "elapsed_seconds":  round(elapsed, 2),
    }