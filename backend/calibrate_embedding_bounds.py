"""
calibrate_embedding_bounds.py — Calibration empirique des bornes [LOW, HIGH]
                                 du remapping de la couche embedding.

Objectif : mesurer la distribution réelle des similarités cosinus BRUTES
produites par le modèle sur des paires CV-offre, puis en déduire des bornes
qui couvrent la majorité des cas réels.

Deux sources de données :
  - SOURCE A : dataset matching_ground_truth.json (paires HuggingFace préparées)
  - SOURCE B : base PostgreSQL FairHire (candidatures réelles avec offres)

Le script :
  1. Reconstruit les textes CV et offre EXACTEMENT comme EmbeddingLayer
  2. Encode les deux textes avec le même modèle (paraphrase-multilingual-MiniLM-L12-v2)
  3. Calcule la similarité cosinus BRUTE (produit scalaire de vecteurs normalisés)
  4. Agrège toutes les similarités
  5. Calcule les statistiques descriptives (min, max, mean, median, std, percentiles)
  6. Affiche un histogramme ASCII
  7. Sauvegarde les similarités brutes + le rapport JSON

Usage :
    cd backend
    python calibrate_embedding_bounds.py              # les deux sources
    python calibrate_embedding_bounds.py --dataset    # seulement source A
    python calibrate_embedding_bounds.py --database   # seulement source B
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────────────────────
#  Fix PYTHONPATH : ajoute le répertoire courant (backend/)
#  pour que `from app.xxx import yyy` fonctionne
# ─────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path.cwd()))
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("calibrate")

DATASET_PATH = Path("app/evaluation/datasets/matching_ground_truth.json")
OUTPUT_DIR = Path("app/evaluation/calibration_output")


# ─────────────────────────────────────────────────────────────
#  Reconstruction des textes EXACTEMENT comme EmbeddingLayer
#  (NE PAS MODIFIER cette logique — doit matcher matching_service.py)
# ─────────────────────────────────────────────────────────────

def build_cv_text(cv_data: dict) -> str:
    """
    Reconstruit le texte CV pour l'embedding.
    ALIGNÉ EXACTEMENT sur EmbeddingLayer.compute() dans matching_service.py.

    Format :
      <summary>
      Expériences : <title> chez <company> | <title> chez <company> | ...
      Compétences : skill1, skill2, ..., skill20
    """
    cv_summary     = cv_data.get("summary") or ""
    cv_skills      = cv_data.get("skills") or []
    cv_experiences = cv_data.get("experiences") or []

    # Skills : max 20, séparés par ", "
    skills_str = ", ".join(cv_skills[:20]) if cv_skills else ""

    # Expériences : max 5, format "title chez company" joint par " | "
    exp_parts = []
    for exp in cv_experiences[:5]:
        title   = exp.get("title", "")
        company = exp.get("company", "")
        if title or company:
            exp_parts.append(f"{title} chez {company}".strip(" chez "))
    exp_str = " | ".join(exp_parts) if exp_parts else ""

    # Assemblage avec \n, filter(None, ...) supprime les lignes vides
    candidat_text = "\n".join(filter(None, [
        cv_summary,
        f"Expériences : {exp_str}" if exp_str else "",
        f"Compétences : {skills_str}" if skills_str else "",
    ])).strip()

    return candidat_text


def build_offre_text(
    titre: str,
    description: str,
    competences_requises: list,
) -> str:
    """
    Reconstruit le texte offre pour l'embedding.
    ALIGNÉ EXACTEMENT sur EmbeddingLayer.compute() dans matching_service.py.

    Format :
      <titre>
      <description>
      Compétences requises : skill1, skill2, ...
    """
    offre_skills_str = ", ".join(competences_requises) if competences_requises else ""
    offre_text = (
        f"{titre}\n{description}\n"
        f"Compétences requises : {offre_skills_str}"
    ).strip()

    return offre_text


# ─────────────────────────────────────────────────────────────
#  Calcul de la similarité cosinus BRUTE
# ─────────────────────────────────────────────────────────────

class RawEmbeddingComputer:
    """
    Calcule la similarité cosinus brute entre CV et offre.
    Pas de remapping, pas de clipping, pas de transformation — juste la valeur crue.
    """

    def __init__(self):
        logger.info("Chargement du modèle sentence-transformers...")
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        logger.info("Modèle chargé.")

    def compute_raw_similarity(self, cv_text: str, offre_text: str) -> Optional[float]:
        """
        Retourne la similarité cosinus brute ∈ [-1, 1] (en pratique [0, 1]
        pour du texte normalisé), ou None en cas d'erreur / texte vide.

        ALIGNÉ EXACTEMENT sur EmbeddingLayer.compute() :
          - encode en batch de 2 textes
          - normalize_embeddings=True
          - similarity = np.dot(embeddings[0], embeddings[1])
        """
        if not cv_text.strip() or not offre_text.strip():
            return None

        try:
            import numpy as np
            embeddings = self.model.encode(
                [cv_text, offre_text],
                normalize_embeddings=True,
            )
            similarity = float(np.dot(embeddings[0], embeddings[1]))
            return similarity
        except Exception as e:
            logger.error("Erreur calcul similarité : %s", e)
            return None


# ─────────────────────────────────────────────────────────────
#  Source A : dataset matching_ground_truth.json
# ─────────────────────────────────────────────────────────────

def collect_from_dataset(computer: RawEmbeddingComputer) -> list[dict]:
    """
    Parcourt toutes les paires du dataset et calcule la similarité brute.
    Retourne : [{similarity, cv_id, offre_id, label, source}, ...]
    """
    if not DATASET_PATH.exists():
        logger.error("Dataset introuvable : %s", DATASET_PATH)
        return []

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    results = []
    total = sum(len(g.get("candidats", [])) for g in dataset)
    logger.info("Source A : %d paires dans %s", total, DATASET_PATH.name)

    i = 0
    for group in dataset:
        offre = group["offre"]
        offre_text = build_offre_text(
            offre.get("titre", ""),
            offre.get("description", ""),
            offre.get("competences_requises", []),
        )
        offre_id = group.get("offre_id")

        for cand in group.get("candidats", []):
            i += 1
            cv_text = build_cv_text(cand.get("cv_data", {}))
            similarity = computer.compute_raw_similarity(cv_text, offre_text)

            if similarity is not None:
                results.append({
                    "source":     "dataset",
                    "cv_id":      cand.get("cv_id"),
                    "offre_id":   offre_id,
                    "label":      cand.get("label"),
                    "similarity": round(similarity, 6),
                })

            if i % 10 == 0:
                logger.info("  %d/%d paires traitées", i, total)

    logger.info("Source A : %d similarités calculées", len(results))
    return results


# ─────────────────────────────────────────────────────────────
#  Source B : base PostgreSQL (candidatures réelles)
# ─────────────────────────────────────────────────────────────

def collect_from_database(computer: RawEmbeddingComputer) -> list[dict]:
    """
    Parcourt toutes les candidatures de la base qui ont un cv_data parsé,
    et calcule la similarité brute avec l'offre associée.
    """
    try:
        # IMPORTANT : importer TOUS les modèles avant d'utiliser Candidature
        # pour que SQLAlchemy puisse résoudre les relations (User, Offre, etc.)
        from app.db.session import SessionLocal
        from app.models import user          # noqa: F401
        from app.models import offre         # noqa: F401
        from app.models import candidature   # noqa: F401
        from app.models import match_result  # noqa: F401
        try:
            from app.models import benchmark_run  # noqa: F401
        except ImportError:
            pass  # optionnel
        from app.models.candidature import Candidature, ParseStatut
    except ImportError as e:
        logger.error("Impossible d'importer les modèles : %s", e)
        logger.error("(Le script doit être lancé depuis le répertoire backend/)")
        return []

    db = SessionLocal()
    results = []

    try:
        candidatures = (
            db.query(Candidature)
            .filter(Candidature.parse_statut == ParseStatut.TERMINE)
            .filter(Candidature.cv_data.isnot(None))
            .all()
        )

        logger.info("Source B : %d candidatures parsées dans la base", len(candidatures))

        if not candidatures:
            logger.warning("Aucune candidature avec parsing terminé — source B vide")
            return []

        for i, candidature in enumerate(candidatures, 1):
            try:
                cv_data = json.loads(candidature.cv_data)
            except Exception as e:
                logger.warning("Candidature %s : cv_data non parsable (%s)", candidature.id, e)
                continue

            offre = candidature.offre
            if not offre:
                continue

            cv_text = build_cv_text(cv_data)
            offre_text = build_offre_text(
                offre.titre or "",
                offre.description or "",
                offre.competences_requises or [],
            )

            similarity = computer.compute_raw_similarity(cv_text, offre_text)

            if similarity is not None:
                results.append({
                    "source":        "database",
                    "candidature_id": str(candidature.id),
                    "offre_id":      str(offre.id),
                    "offre_titre":   offre.titre,
                    "similarity":    round(similarity, 6),
                })

            if i % 10 == 0:
                logger.info("  %d/%d candidatures traitées", i, len(candidatures))

    finally:
        db.close()

    logger.info("Source B : %d similarités calculées", len(results))
    return results


# ─────────────────────────────────────────────────────────────
#  Analyse statistique
# ─────────────────────────────────────────────────────────────

def compute_percentiles(values: list[float], percentiles: list[int]) -> dict[int, float]:
    """
    Calcule les percentiles d'une liste de valeurs, sans dépendance externe.
    Méthode : linear interpolation (équivalent numpy.percentile).
    """
    if not values:
        return {p: 0.0 for p in percentiles}

    sorted_vals = sorted(values)
    n = len(sorted_vals)
    result = {}

    for p in percentiles:
        # Position fractionnaire dans la liste triée
        k = (p / 100) * (n - 1)
        f = int(k)
        c = min(f + 1, n - 1)

        if f == c:
            result[p] = sorted_vals[f]
        else:
            # Interpolation linéaire
            d = k - f
            result[p] = sorted_vals[f] * (1 - d) + sorted_vals[c] * d

    return result


def compute_stats(values: list[float]) -> dict:
    """Statistiques descriptives : min, max, mean, median, std, percentiles."""
    if not values:
        return {}

    n = len(values)
    sorted_vals = sorted(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    std = variance ** 0.5
    median = sorted_vals[n // 2] if n % 2 == 1 else (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2

    percentiles = compute_percentiles(values, [1, 5, 10, 25, 50, 75, 90, 95, 99])

    return {
        "n":          n,
        "min":        round(min(values), 4),
        "max":        round(max(values), 4),
        "mean":       round(mean, 4),
        "median":     round(median, 4),
        "std":        round(std, 4),
        "percentiles": {str(p): round(v, 4) for p, v in percentiles.items()},
    }


# ─────────────────────────────────────────────────────────────
#  Histogramme ASCII
# ─────────────────────────────────────────────────────────────

def render_histogram(values: list[float], n_bins: int = 20, width: int = 50) -> str:
    """
    Produit un histogramme ASCII de la distribution des valeurs.
    """
    if not values:
        return "(aucune donnée)"

    lo, hi = min(values), max(values)
    if hi == lo:
        return f"Toutes les valeurs = {lo}"

    bin_width = (hi - lo) / n_bins
    bins = [0] * n_bins

    for v in values:
        idx = min(int((v - lo) / bin_width), n_bins - 1)
        bins[idx] += 1

    max_count = max(bins)
    lines = []
    lines.append(f"Distribution (n={len(values)}, min={lo:.3f}, max={hi:.3f})")
    lines.append("─" * (width + 25))

    for i, count in enumerate(bins):
        bin_start = lo + i * bin_width
        bin_end   = lo + (i + 1) * bin_width
        bar_len   = int(count / max_count * width) if max_count > 0 else 0
        bar = "█" * bar_len
        lines.append(f"  [{bin_start:.3f}, {bin_end:.3f})  {bar:<{width}}  {count:>4}")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────
#  Rapport final
# ─────────────────────────────────────────────────────────────

def analyze_and_report(
    similarities: list[dict],
    source_name: str,
) -> dict:
    """
    Analyse une liste de similarités et produit un rapport.
    """
    values = [s["similarity"] for s in similarities]

    print("\n" + "═" * 80)
    print(f"ANALYSE — SOURCE : {source_name.upper()}")
    print("═" * 80)

    if not values:
        print("  (aucune donnée)")
        return {}

    stats = compute_stats(values)

    # Affichage statistiques
    print(f"\n  Nombre de paires  : {stats['n']}")
    print(f"  Min               : {stats['min']:.4f}")
    print(f"  Max               : {stats['max']:.4f}")
    print(f"  Moyenne           : {stats['mean']:.4f}")
    print(f"  Médiane           : {stats['median']:.4f}")
    print(f"  Écart-type        : {stats['std']:.4f}")

    print("\n  Percentiles :")
    for p in [1, 5, 10, 25, 50, 75, 90, 95, 99]:
        print(f"    P{p:>2}             : {stats['percentiles'][str(p)]:.4f}")

    # Histogramme
    print("\n  Histogramme :")
    print(render_histogram(values, n_bins=20, width=50))

    # Recommandation de bornes
    p10 = stats["percentiles"]["10"]
    p90 = stats["percentiles"]["90"]
    p05 = stats["percentiles"]["5"]
    p95 = stats["percentiles"]["95"]

    print("\n  " + "─" * 60)
    print("  BORNES RECOMMANDÉES (basées sur les percentiles) :")
    print("  " + "─" * 60)
    print(f"    Option conservatrice (P5 → P95)  : [{p05:.2f}, {p95:.2f}]  (couvre 90% des cas)")
    print(f"    Option standard     (P10 → P90)  : [{p10:.2f}, {p90:.2f}]  (couvre 80% des cas)")
    print(f"    Bornes actuelles en prod         : [0.20, 0.90]")

    # Comparaison avec les bornes actuelles
    in_range = sum(1 for v in values if 0.20 <= v <= 0.90)
    pct_in_range = in_range / len(values) * 100

    print(f"\n  Couverture des bornes actuelles [0.20, 0.90] : {in_range}/{len(values)} ({pct_in_range:.1f}%)")

    # Verdict
    print("\n  " + "─" * 60)
    print("  VERDICT :")
    print("  " + "─" * 60)
    if pct_in_range >= 75:
        print(f"    ✓ Les bornes [0.20, 0.90] couvrent {pct_in_range:.0f}% des paires.")
        print("    → Bornes acceptables pour ce dataset.")
    elif pct_in_range >= 60:
        print(f"    ⚠ Les bornes [0.20, 0.90] ne couvrent que {pct_in_range:.0f}% des paires.")
        print(f"    → Considérer [{p10:.2f}, {p90:.2f}] pour meilleure couverture.")
    else:
        print(f"    ✗ Les bornes [0.20, 0.90] sont MAL ALIGNÉES ({pct_in_range:.0f}% de couverture).")
        print(f"    → Recommandation forte : utiliser [{p10:.2f}, {p90:.2f}].")

    return {
        "source": source_name,
        "stats": stats,
        "current_bounds": [0.20, 0.90],
        "current_coverage_pct": round(pct_in_range, 2),
        "recommended_bounds_p10_p90": [round(p10, 2), round(p90, 2)],
        "recommended_bounds_p5_p95":  [round(p05, 2), round(p95, 2)],
    }


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Calibration empirique des bornes du remapping embedding."
    )
    parser.add_argument("--dataset", action="store_true",
                        help="Seulement source A (matching_ground_truth.json)")
    parser.add_argument("--database", action="store_true",
                        help="Seulement source B (base PostgreSQL)")
    args = parser.parse_args()

    # Par défaut : les deux sources
    do_dataset = args.dataset or (not args.dataset and not args.database)
    do_database = args.database or (not args.dataset and not args.database)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    computer = RawEmbeddingComputer()

    reports = {}

    # Source A : dataset
    if do_dataset:
        dataset_similarities = collect_from_dataset(computer)
        if dataset_similarities:
            reports["dataset"] = analyze_and_report(dataset_similarities, "matching_ground_truth.json")

            # Sauvegarder les similarités brutes
            with open(OUTPUT_DIR / "similarities_dataset.json", "w", encoding="utf-8") as f:
                json.dump(dataset_similarities, f, ensure_ascii=False, indent=2)
            logger.info("Similarités dataset sauvegardées dans %s", OUTPUT_DIR / "similarities_dataset.json")

    # Source B : base
    if do_database:
        db_similarities = collect_from_database(computer)
        if db_similarities:
            reports["database"] = analyze_and_report(db_similarities, "base PostgreSQL")

            with open(OUTPUT_DIR / "similarities_database.json", "w", encoding="utf-8") as f:
                json.dump(db_similarities, f, ensure_ascii=False, indent=2)
            logger.info("Similarités base sauvegardées dans %s", OUTPUT_DIR / "similarities_database.json")

    # Rapport final
    if reports:
        with open(OUTPUT_DIR / "calibration_report.json", "w", encoding="utf-8") as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)

        print("\n" + "═" * 80)
        print("RAPPORT SAUVEGARDÉ")
        print("═" * 80)
        print(f"  → {OUTPUT_DIR / 'calibration_report.json'}")
        print(f"  → {OUTPUT_DIR / 'similarities_*.json'}")
        print()
    else:
        print("\n✗ Aucune donnée collectée. Vérifie les sources.")
        sys.exit(1)


if __name__ == "__main__":
    main()