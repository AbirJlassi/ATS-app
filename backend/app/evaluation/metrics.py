"""
metrics.py — Métriques d'évaluation pour le parser de CV.

Un routeur par champ :
  - email            → exact match après normalisation (lowercase + strip)
  - phone            → exact match sur les 10 derniers chiffres (robuste aux formats +33/0/espaces)
  - linkedin/github  → exact match après normalisation d'URL
  - full_name        → fuzzy match (Levenshtein normalisé) — tolère abréviations, accents, tirets
  - location         → containment bilatéral + token F1 — "Paris" ≈ "Paris, France"
  - skills           → F1 avec matching fuzzy par élément (seuil 0.85)
  - certifications   → idem skills
  - experiences      → matching bipartite greedy sur (titre 60% + entreprise 40%), seuil 0.6
  - education        → idem sur (diplôme 60% + institution 40%)
  - languages        → F1 sur le nom de langue normalisé

Dépendance externe : rapidfuzz (distance de Levenshtein normalisée, ~10-50x plus rapide que difflib).
"""

from __future__ import annotations

import re
import unicodedata
from rapidfuzz import fuzz as _rfuzz
from typing import Any, Iterable


# ─────────────────────────────────────────────────────────────
#  Normalisation
# ─────────────────────────────────────────────────────────────

def _strip_accents(s: str) -> str:
    """Enlève les accents Unicode (NFD + filtre les caractères combinants)."""
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if not unicodedata.combining(c))


def normalize_text(s: Any) -> str:
    """Minuscules, sans accents, ponctuation légère stripée, espaces collapsés."""
    if s is None:
        return ""
    s = _strip_accents(str(s)).lower().strip()
    # Ponctuation qui ne doit pas bloquer le matching (on garde les points pour emails/urls)
    s = re.sub(r"[,;:!?()\[\]{}\"]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


#: Indicatifs pays courants, triés par longueur décroissante pour le matching greedy.
_COUNTRY_CODES = sorted(
    ["216", "212", "213", "33", "44", "49", "34", "39", "32", "31", "41",
     "48", "351", "352", "353", "43", "45", "46", "47", "1", "7"],
    key=len, reverse=True,
)


def normalize_phone(s: Any) -> str:
    """
    Normalise un numéro de téléphone en sa forme 'locale' sans indicatif ni zéro de tête.
    Ex: '+33 6 12 34 56 78', '06 12 34 56 78', '0033612345678' → '612345678'
    """
    if s is None:
        return ""
    digits = re.sub(r"\D", "", str(s))
    if not digits:
        return ""
    # Préfixe international '00'
    if digits.startswith("00"):
        digits = digits[2:]
    # Strip country code si le reste ressemble à un numéro local valide (7-10 chiffres)
    for cc in _COUNTRY_CODES:
        if digits.startswith(cc):
            rest = digits[len(cc):]
            if 7 <= len(rest) <= 10:
                digits = rest
                break
    # Strip leading zero (format national français/belge/etc.)
    return digits.lstrip("0")


def normalize_url(s: Any) -> str:
    """Strip protocol, www, trailing slash, lowercase."""
    if s is None:
        return ""
    s = str(s).strip().lower()
    s = re.sub(r"^https?://", "", s)
    s = re.sub(r"^www\.", "", s)
    return s.rstrip("/")


def normalize_skill(s: Any) -> str:
    """Normalise un skill (lowercase, sans accents, ponctuation allégée)."""
    s = normalize_text(s)
    # uniformise quelques variantes courantes
    s = s.replace(".", "").replace("-", " ")
    return re.sub(r"\s+", " ", s).strip()


# ─────────────────────────────────────────────────────────────
#  Similarités de base
# ─────────────────────────────────────────────────────────────

def fuzzy_ratio(a: Any, b: Any) -> float:
    """Ratio de similarité basé sur la distance de Levenshtein normalisée (rapidfuzz, 0.0 → 1.0)."""
    a_n, b_n = normalize_text(a), normalize_text(b)
    if not a_n and not b_n:
        return 1.0
    if not a_n or not b_n:
        return 0.0
    return _rfuzz.ratio(a_n, b_n) / 100.0  # rapidfuzz renvoie [0, 100]


def token_f1(pred: Any, truth: Any) -> float:
    """F1 au niveau token (ordre/ponctuation ignorés)."""
    p = set(normalize_text(pred).split())
    t = set(normalize_text(truth).split())
    if not p and not t:
        return 1.0
    if not p or not t:
        return 0.0
    inter = p & t
    if not inter:
        return 0.0
    precision = len(inter) / len(p)
    recall = len(inter) / len(t)
    return 2 * precision * recall / (precision + recall)


def containment_score(pred: Any, truth: Any) -> float:
    """
    Score basé sur le containment bilatéral des tokens.
    Utile pour location : "Paris" ⊂ "Paris, France" → score élevé.
    """
    p = set(normalize_text(pred).split())
    t = set(normalize_text(truth).split())
    if not p and not t:
        return 1.0
    if not p or not t:
        return 0.0
    # max du taux de recouvrement dans les deux sens
    return max(len(p & t) / len(p), len(p & t) / len(t))


# ─────────────────────────────────────────────────────────────
#  Scoring par champ scalaire
# ─────────────────────────────────────────────────────────────

def score_email(pred: Any, truth: Any) -> float:
    p, t = normalize_text(pred), normalize_text(truth)
    return 1.0 if (p and t and p == t) else 0.0


def score_phone(pred: Any, truth: Any) -> float:
    p, t = normalize_phone(pred), normalize_phone(truth)
    return 1.0 if (p and t and p == t) else 0.0


def score_url(pred: Any, truth: Any) -> float:
    p, t = normalize_url(pred), normalize_url(truth)
    return 1.0 if (p and t and p == t) else 0.0


def score_full_name(pred: Any, truth: Any, threshold: float = 0.75) -> float:
    """
    Fuzzy match. Un score ≥ threshold est considéré comme correct (= 1.0).
    En-dessous, on renvoie le ratio brut pour le scoring continu.
    """
    ratio = fuzzy_ratio(pred, truth)
    # bonus si tous les tokens importants sont présents (prénom + nom au moins)
    tf = token_f1(pred, truth)
    combined = max(ratio, tf)
    return 1.0 if combined >= threshold else combined


def score_location(pred: Any, truth: Any) -> float:
    """Containment bilatéral — "Paris" ≡ "Paris, France" renvoie ~1.0."""
    return containment_score(pred, truth)


# ─────────────────────────────────────────────────────────────
#  Scoring de listes plates (skills, certifications)
# ─────────────────────────────────────────────────────────────

def score_flat_list(
    pred: Iterable[str] | None,
    truth: Iterable[str] | None,
    fuzzy_threshold: float = 0.85,
    normalizer=normalize_skill,
) -> dict:
    """
    F1 avec matching fuzzy : chaque élément truth est considéré trouvé
    s'il existe un élément pred avec similarité ≥ threshold.

    Retourne aussi matched_pairs, unmatched_pred, unmatched_truth
    pour l'analyse d'erreurs visuelle.
    """
    pred = list(pred or [])
    truth = list(truth or [])
    if not pred and not truth:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "matched": 0,
                "pred_count": 0, "truth_count": 0,
                "matched_pairs": [], "unmatched_pred": [], "unmatched_truth": []}
    if not pred or not truth:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "matched": 0,
                "pred_count": len(pred), "truth_count": len(truth),
                "matched_pairs": [],
                "unmatched_pred": [str(p) for p in pred],
                "unmatched_truth": [str(t) for t in truth]}

    pred_norm = [normalizer(x) for x in pred]
    truth_norm = [normalizer(x) for x in truth]

    # Matching greedy : chaque élément truth "consomme" au plus un pred
    used_pred = set()
    matched_pairs = []
    matched_truth_idx = set()

    for ti, t in enumerate(truth_norm):
        best_idx, best_sim = -1, 0.0
        for i, p in enumerate(pred_norm):
            if i in used_pred:
                continue
            sim = 1.0 if p == t else _rfuzz.ratio(p, t) / 100.0
            if sim > best_sim:
                best_sim, best_idx = sim, i
        if best_sim >= fuzzy_threshold and best_idx >= 0:
            used_pred.add(best_idx)
            matched_truth_idx.add(ti)
            matched_pairs.append([str(pred[best_idx]), str(truth[ti])])

    unmatched_pred  = [str(pred[i]) for i in range(len(pred)) if i not in used_pred]
    unmatched_truth = [str(truth[i]) for i in range(len(truth)) if i not in matched_truth_idx]
    matches = len(matched_pairs)

    precision = matches / len(pred) if pred else 0.0
    recall = matches / len(truth) if truth else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1,
            "matched": matches, "pred_count": len(pred), "truth_count": len(truth),
            "matched_pairs": matched_pairs,
            "unmatched_pred": unmatched_pred, "unmatched_truth": unmatched_truth}


# ─────────────────────────────────────────────────────────────
#  Scoring de listes structurées (experiences, education)
# ─────────────────────────────────────────────────────────────

def _entry_similarity(p: dict, t: dict, primary_key: str, secondary_key: str,
                      w_primary: float = 0.6, w_secondary: float = 0.4) -> float:
    """Similarité pondérée entre deux entrées structurées (expérience ou éducation)."""
    primary_sim = fuzzy_ratio(p.get(primary_key, ""), t.get(primary_key, ""))
    # si la clé secondaire est absente dans le truth, on ne la compte pas
    t_sec = t.get(secondary_key, "")
    if not t_sec:
        return primary_sim
    secondary_sim = fuzzy_ratio(p.get(secondary_key, ""), t_sec)
    return w_primary * primary_sim + w_secondary * secondary_sim


def _format_entry(entry: dict, primary_key: str, secondary_key: str) -> str:
    """Formatte une entrée structurée en string lisible : 'primary — secondary'."""
    parts = [str(entry.get(primary_key, "?")), str(entry.get(secondary_key, ""))]
    return " — ".join(p for p in parts if p)


def score_structured_list(
    pred: list[dict] | None,
    truth: list[dict] | None,
    primary_key: str,
    secondary_key: str,
    match_threshold: float = 0.6,
) -> dict:
    """
    Matching bipartite greedy. Pour chaque entrée truth, on cherche
    la meilleure entrée pred non encore utilisée avec similarité ≥ threshold.

    Retourne aussi matched_pairs, unmatched_pred, unmatched_truth
    pour l'analyse d'erreurs visuelle.
    """
    pred = list(pred or [])
    truth = list(truth or [])
    fmt = lambda e: _format_entry(e, primary_key, secondary_key)

    if not pred and not truth:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "matched": 0,
                "pred_count": 0, "truth_count": 0, "avg_match_sim": 1.0,
                "matched_pairs": [], "unmatched_pred": [], "unmatched_truth": []}
    if not pred or not truth:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "matched": 0,
                "pred_count": len(pred), "truth_count": len(truth), "avg_match_sim": 0.0,
                "matched_pairs": [],
                "unmatched_pred": [fmt(p) for p in pred],
                "unmatched_truth": [fmt(t) for t in truth]}

    used_pred = set()
    matched_pairs = []
    matched_truth_idx = set()
    match_sims = []

    for ti, t in enumerate(truth):
        best_idx, best_sim = -1, 0.0
        for i, p in enumerate(pred):
            if i in used_pred:
                continue
            sim = _entry_similarity(p, t, primary_key, secondary_key)
            if sim > best_sim:
                best_sim, best_idx = sim, i
        if best_sim >= match_threshold and best_idx >= 0:
            used_pred.add(best_idx)
            matched_truth_idx.add(ti)
            matched_pairs.append([fmt(pred[best_idx]), fmt(truth[ti])])
            match_sims.append(best_sim)

    unmatched_pred  = [fmt(pred[i]) for i in range(len(pred)) if i not in used_pred]
    unmatched_truth = [fmt(truth[i]) for i in range(len(truth)) if i not in matched_truth_idx]
    matches = len(matched_pairs)

    precision = matches / len(pred)
    recall = matches / len(truth)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    avg_sim = sum(match_sims) / len(match_sims) if match_sims else 0.0
    return {"precision": precision, "recall": recall, "f1": f1,
            "matched": matches, "pred_count": len(pred), "truth_count": len(truth),
            "avg_match_sim": avg_sim,
            "matched_pairs": matched_pairs,
            "unmatched_pred": unmatched_pred, "unmatched_truth": unmatched_truth}


# ─────────────────────────────────────────────────────────────
#  Routeur principal
# ─────────────────────────────────────────────────────────────

SCALAR_FIELDS = {"full_name", "email", "phone", "location", "linkedin", "github"}
FLAT_LIST_FIELDS = {"skills", "certifications"}
STRUCTURED_FIELDS = {
    "experiences": ("title", "company"),
    "education": ("degree", "institution"),
}


def _is_absent(v: Any) -> bool:
    """Vrai si la valeur est considérée comme absente (None, chaîne vide, liste vide)."""
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    if isinstance(v, (list, dict)) and len(v) == 0:
        return True
    return False


def score_field(field: str, pred: Any, truth: Any) -> dict:
    """
    Retourne toujours un dict {score, details} pour homogénéité dans le rapport.
    Pour les scalaires : details = {pred, truth} (valeurs brutes pour affichage frontend)
    Pour les listes   : details = {precision, recall, f1, matched, matched_pairs, ...}

    Règle null-null : si la vérité terrain est absente ET que le parser prédit
    également absent, c'est une prédiction parfaite (score = 1.0).
    Si la vérité terrain est absente mais que le parser prédit quelque chose,
    c'est une hallucination (score = 0.0).
    """
    truth_absent = _is_absent(truth)
    pred_absent  = _is_absent(pred)

    if truth_absent:
        # Le champ n'est pas attendu dans ce CV
        score = 1.0 if pred_absent else 0.0   # 1.0 = correct, 0.0 = hallucination
        return {"score": score, "type": "null_match", "pred": pred, "truth": truth}

    if field == "email":
        return {"score": score_email(pred, truth), "type": "scalar_exact",
                "pred": pred, "truth": truth}
    if field == "phone":
        return {"score": score_phone(pred, truth), "type": "scalar_phone",
                "pred": pred, "truth": truth}
    if field in ("linkedin", "github"):
        return {"score": score_url(pred, truth), "type": "scalar_url",
                "pred": pred, "truth": truth}
    if field == "full_name":
        return {"score": score_full_name(pred, truth), "type": "scalar_fuzzy",
                "pred": pred, "truth": truth}
    if field == "location":
        return {"score": score_location(pred, truth), "type": "scalar_containment",
                "pred": pred, "truth": truth}
    if field in FLAT_LIST_FIELDS:
        res = score_flat_list(pred, truth)
        return {"score": res["f1"], "type": "flat_list",
                "pred": pred, "truth": truth, **res}
    if field in STRUCTURED_FIELDS:
        primary, secondary = STRUCTURED_FIELDS[field]
        res = score_structured_list(pred, truth, primary, secondary)
        return {"score": res["f1"], "type": "structured_list",
                "pred": pred, "truth": truth, **res}
    # fallback : containment
    return {"score": containment_score(pred, truth), "type": "fallback",
            "pred": pred, "truth": truth}


# ─────────────────────────────────────────────────────────────
#  Sanity check
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Quelques cas de test manuels pour vérifier que tout se comporte bien
    cases = [
        ("full_name", "Jean Dupont", "J. Dupont"),
        ("full_name", "Camille Dupont-Leroy", "Camille Dupont Leroy"),
        ("full_name", "Thomas van der Berg", "T. van der Berg"),
        ("phone", "+33 6 12 34 56 78", "06 12 34 56 78"),
        ("phone", "+216 24 117 803", "0024117803"),
        ("location", "Paris", "Paris, France"),
        ("location", "Tunis", "Tunis, Tunisie"),
        ("linkedin", "https://www.linkedin.com/in/xyz/", "linkedin.com/in/xyz"),
        ("email", "A.B@Gmail.COM", "a.b@gmail.com"),
    ]
    print(f"{'field':<15} {'pred':<40} {'truth':<30} score")
    print("-" * 100)
    for field, pred, truth in cases:
        res = score_field(field, pred, truth)
        print(f"{field:<15} {pred:<40} {truth:<30} {res['score']:.3f}  ({res['type']})")

    # Test flat list
    print("\n--- skills (F1 avec fuzzy) ---")
    pred_skills = ["Python", "JavaScript", "Reactjs", "Postgres"]
    truth_skills = ["python", "javascript", "react.js", "postgresql", "docker"]
    res = score_field("skills", pred_skills, truth_skills)
    print(res)

    # Test structured list
    print("\n--- experiences ---")
    pred_exp = [
        {"title": "Lead Dev", "company": "Acme"},
        {"title": "Backend Engineer", "company": "Globex"},
    ]
    truth_exp = [
        {"title": "Lead Developer", "company": "Acme Inc"},
        {"title": "Backend Engineer", "company": "Globex Corp"},
    ]
    res = score_field("experiences", pred_exp, truth_exp)
    print(res)