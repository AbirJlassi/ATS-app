"""
matching_metrics.py — Métriques d'évaluation pour le matching CV-offre.

Trois familles de métriques :

  1. Classification : le système assigne-t-il le bon label de pertinence ?
     → accuracy, precision, recall, F1 macro

  2. Ranking : le système classe-t-il les candidats dans le bon ordre ?
     → Spearman ρ (corrélation de rang), nDCG@k

  3. Agreement : concordance fine entre score système et label humain

Aucune dépendance externe — implémentation from scratch pour légèreté
et transparence (important pour le mémoire).
"""
from __future__ import annotations

import math
from typing import Any


# ─────────────────────────────────────────────────────────────
#  1. Classification
# ─────────────────────────────────────────────────────────────

def classification_report(
    y_true: list[int],
    y_pred: list[int],
    label_names: list[str] | None = None,
) -> dict[str, Any]:
    """
    Precision, recall, F1 par classe + accuracy globale + F1 macro.

    Args:
        y_true : labels ground truth (entiers 0, 1, 2, …)
        y_pred : labels prédits par le système
        label_names : noms lisibles des classes (ex: ["No Fit", "Potential Fit", "Good Fit"])

    Returns:
        {
            "accuracy": float,
            "f1_macro": float,
            "per_class": [
                {"label": str, "precision": float, "recall": float, "f1": float, "support": int},
                ...
            ]
        }
    """
    assert len(y_true) == len(y_pred), "y_true et y_pred doivent avoir la même longueur"

    classes = sorted(set(y_true) | set(y_pred))
    if label_names is None:
        label_names = [str(c) for c in classes]

    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / len(y_true) if y_true else 0.0

    per_class = []
    f1_sum = 0.0

    for i, cls in enumerate(classes):
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p == cls)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != cls and p == cls)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p != cls)
        support = sum(1 for t in y_true if t == cls)

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall    = tp / (tp + fn) if (tp + fn) else 0.0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

        name = label_names[i] if i < len(label_names) else str(cls)
        per_class.append({
            "label": name,
            "precision": round(precision, 4),
            "recall":    round(recall, 4),
            "f1":        round(f1, 4),
            "support":   support,
        })
        f1_sum += f1

    f1_macro = f1_sum / len(classes) if classes else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "f1_macro": round(f1_macro, 4),
        "per_class": per_class,
    }


def confusion_matrix(
    y_true: list[int],
    y_pred: list[int],
    n_classes: int = 3,
) -> list[list[int]]:
    """
    Matrice de confusion n×n.
    matrix[i][j] = nombre de cas où true=i et pred=j.
    """
    mat = [[0] * n_classes for _ in range(n_classes)]
    for t, p in zip(y_true, y_pred):
        if 0 <= t < n_classes and 0 <= p < n_classes:
            mat[t][p] += 1
    return mat


# ─────────────────────────────────────────────────────────────
#  2. Ranking
# ─────────────────────────────────────────────────────────────

def _rank(values: list[float]) -> list[float]:
    """
    Convertit une liste de valeurs en rangs (1-based).
    Gestion des ex-aequo par rang moyen (standard Spearman).
    """
    n = len(values)
    indexed = sorted(enumerate(values), key=lambda x: x[1])
    ranks = [0.0] * n

    i = 0
    while i < n:
        j = i
        while j < n - 1 and indexed[j + 1][1] == indexed[j][1]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1  # 1-based
        for k in range(i, j + 1):
            ranks[indexed[k][0]] = avg_rank
        i = j + 1

    return ranks


def spearman_rho(
    system_scores: list[float],
    human_labels: list[float],
) -> float:
    """
    Coefficient de corrélation de Spearman entre les scores système
    et les labels humains.

    Mesure si l'ordre relatif est cohérent :
      ρ = +1  → classement parfait
      ρ =  0  → aucune corrélation
      ρ = -1  → classement inversé

    Requiert au moins 3 échantillons.
    """
    n = len(system_scores)
    if n < 3:
        return 0.0

    r_sys = _rank(system_scores)
    r_hum = _rank(human_labels)

    d_sq = sum((rs - rh) ** 2 for rs, rh in zip(r_sys, r_hum))

    # Formule standard : ρ = 1 - 6·Σd² / (n·(n²-1))
    denom = n * (n ** 2 - 1)
    if denom == 0:
        return 0.0

    return round(1 - 6 * d_sq / denom, 4)


def ndcg_at_k(
    system_scores: list[float],
    relevance_labels: list[int],
    k: int | None = None,
) -> float:
    """
    Normalized Discounted Cumulative Gain @ k.

    Mesure la qualité du ranking en pondérant par la position :
    les erreurs en haut du classement sont plus coûteuses.

    Args:
        system_scores     : scores produits par le système (plus haut = meilleur)
        relevance_labels  : pertinence humaine (0=No Fit, 1=Potential, 2=Good)
        k                 : nombre de positions à considérer (None = toutes)

    Returns:
        nDCG ∈ [0, 1] — 1.0 = ranking parfait
    """
    n = len(system_scores)
    if n == 0:
        return 0.0
    if k is None:
        k = n
    k = min(k, n)

    # Trier les labels par score système décroissant
    paired = sorted(zip(system_scores, relevance_labels), key=lambda x: -x[0])
    sorted_relevance = [rel for _, rel in paired]

    # DCG du système
    dcg = sum(
        (2 ** sorted_relevance[i] - 1) / math.log2(i + 2)
        for i in range(k)
    )

    # DCG idéal (labels triés par pertinence décroissante)
    ideal = sorted(relevance_labels, reverse=True)
    idcg = sum(
        (2 ** ideal[i] - 1) / math.log2(i + 2)
        for i in range(k)
    )

    if idcg == 0:
        return 0.0

    return round(dcg / idcg, 4)


# ─────────────────────────────────────────────────────────────
#  3. Helpers — Mapping labels
# ─────────────────────────────────────────────────────────────

# Labels du dataset HuggingFace
DATASET_LABELS = ["No Fit", "Potential Fit", "Good Fit"]

# Mapping label texte → entier
LABEL_TO_INT = {"No Fit": 0, "Potential Fit": 1, "Good Fit": 2}


def score_to_label(score: float) -> int:
    """
    Convertit un score matching (0-100) en label comparable
    au ground truth du dataset HuggingFace.

    Seuils calibrés sur les niveaux FairHire :
      < 40  → 0 (No Fit)      ≡ FAIBLE
      40-69 → 1 (Potential Fit) ≡ PARTIEL + BON bas
      ≥ 70  → 2 (Good Fit)    ≡ BON haut + EXCELLENT
    """
    if score < 40:
        return 0
    if score < 70:
        return 1
    return 2


# ─────────────────────────────────────────────────────────────
#  Sanity check
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Classification
    y_true = [0, 0, 1, 1, 2, 2, 0, 1, 2]
    y_pred = [0, 1, 1, 1, 2, 1, 0, 0, 2]
    report = classification_report(y_true, y_pred, DATASET_LABELS)
    print("=== Classification Report ===")
    print(f"  Accuracy: {report['accuracy']}")
    print(f"  F1 macro: {report['f1_macro']}")
    for c in report["per_class"]:
        print(f"  {c['label']:15s}  P={c['precision']:.2f}  R={c['recall']:.2f}  F1={c['f1']:.2f}  n={c['support']}")

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    print("\n=== Confusion Matrix ===")
    print(f"  {'':15s}  {'No Fit':>8s}  {'Potential':>8s}  {'Good':>8s}")
    for i, row in enumerate(cm):
        print(f"  {DATASET_LABELS[i]:15s}  {row[0]:>8d}  {row[1]:>8d}  {row[2]:>8d}")

    # Ranking
    scores = [85.0, 72.0, 45.0, 30.0, 60.0]
    labels = [2, 2, 1, 0, 1]
    print(f"\n=== Ranking ===")
    print(f"  Spearman ρ = {spearman_rho(scores, [float(l) for l in labels])}")
    print(f"  nDCG       = {ndcg_at_k(scores, labels)}")
    print(f"  nDCG@3     = {ndcg_at_k(scores, labels, k=3)}")