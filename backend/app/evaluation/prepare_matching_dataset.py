"""
prepare_matching_dataset.py — Prépare le dataset de benchmark matching.

Pipeline :
  1. Télécharge le dataset HuggingFace (cnamuangtoun/resume-job-description-fit)
  2. Échantillonne stratifié : N offres × M candidats par offre (labels mixtes)
  3. Parse les JDs avec Groq → {titre, domaine, competences_requises, annees_experience_min}
  4. Parse les CVs avec le CVParser FairHire → cv_data structuré
  5. Sauvegarde le dataset préparé en JSON (prêt pour matching_evaluator.py)

Usage :
    cd backend
    python -m app.evaluation.prepare_matching_dataset

    Ou avec options :
    python -m app.evaluation.prepare_matching_dataset --n-offres 5 --n-candidats 10 --preset fast

Prérequis :
    pip install datasets --break-system-packages

Temps estimé : ~15-30 min (parsing LLM des CVs)
Le résultat est sauvegardé et réutilisable — le script ne tourne qu'une fois.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("prepare_matching_dataset")

OUTPUT_PATH = Path(__file__).parent / "datasets" / "matching_ground_truth.json"


# ─────────────────────────────────────────────────────────────
#  1. Chargement et échantillonnage du dataset HuggingFace
# ─────────────────────────────────────────────────────────────

def load_and_sample(
    n_offres: int = 5,
    n_candidats_per_offre: int = 10,
) -> list[dict]:
    """
    Charge le dataset HF et échantillonne des groupes (offre → N candidats).

    Stratégie d'échantillonnage :
      - Prend les JDs qui ont le plus de candidats avec labels diversifiés
      - Pour chaque JD, prend un mix équilibré de labels
      → Permet le ranking evaluation (≥2 candidats par offre)
    """
    try:
        from datasets import load_dataset
    except ImportError:
        logger.error(
            "La bibliothèque 'datasets' n'est pas installée.\n"
            "  pip install datasets --break-system-packages"
        )
        sys.exit(1)

    logger.info("Téléchargement du dataset HuggingFace...")
    ds = load_dataset("cnamuangtoun/resume-job-description-fit", split="test")
    logger.info("Dataset chargé : %d paires", len(ds))

    # Grouper par JD
    jd_groups: dict[str, dict] = defaultdict(lambda: {"candidates": [], "label_counts": defaultdict(int)})

    for row in ds:
        jd_text = row["job_description_text"]
        jd_hash = hash(jd_text)  # clé unique par JD
        jd_groups[jd_hash]["jd_text"] = jd_text
        jd_groups[jd_hash]["candidates"].append({
            "resume_text": row["resume_text"],
            "label": row["label"],
        })
        jd_groups[jd_hash]["label_counts"][row["label"]] += 1

    # Sélectionner les JDs avec le plus de diversité de labels
    scored = []
    for jd_hash, group in jd_groups.items():
        n_cands = len(group["candidates"])
        n_labels = len(group["label_counts"])
        if n_cands >= n_candidats_per_offre and n_labels >= 2:
            # Score = nombre de labels distincts × nombre de candidats
            scored.append((jd_hash, n_labels * n_cands, group))

    scored.sort(key=lambda x: -x[1])

    if len(scored) < n_offres:
        logger.warning(
            "Seulement %d JDs avec ≥%d candidats et ≥2 labels. On prend ce qu'on a.",
            len(scored), n_candidats_per_offre,
        )
        n_offres = len(scored)

    # Prendre les N meilleures JDs
    selected = []
    for i in range(n_offres):
        jd_hash, _, group = scored[i]
        cands = group["candidates"]

        # Échantillonnage stratifié par label
        by_label: dict[str, list] = defaultdict(list)
        for c in cands:
            by_label[c["label"]].append(c)

        sampled = []
        per_label = max(1, n_candidats_per_offre // len(by_label))
        for label, items in by_label.items():
            sampled.extend(items[:per_label])

        # Compléter si pas assez
        remaining = [c for c in cands if c not in sampled]
        while len(sampled) < n_candidats_per_offre and remaining:
            sampled.append(remaining.pop(0))

        sampled = sampled[:n_candidats_per_offre]

        selected.append({
            "offre_id": f"offre_{i+1:03d}",
            "jd_text": group["jd_text"],
            "candidates": sampled,
        })

    total_pairs = sum(len(g["candidates"]) for g in selected)
    logger.info(
        "Échantillonnage : %d offres × ~%d candidats = %d paires",
        len(selected), n_candidats_per_offre, total_pairs,
    )

    return selected


# ─────────────────────────────────────────────────────────────
#  2. Parsing des Job Descriptions avec Groq
# ─────────────────────────────────────────────────────────────

def parse_jd_with_llm(jd_text: str) -> dict:
    """
    Extrait les informations structurées d'une JD via Groq.

    Retourne : {
        "titre": str,
        "description": str (résumé court),
        "domaine": str,
        "competences_requises": [str],
        "annees_experience_min": int,
    }
    """
    try:
        from groq import Groq
    except ImportError:
        logger.error("groq non installé — pip install groq")
        return _jd_fallback(jd_text)

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        logger.warning("GROQ_API_KEY absent — fallback regex")
        return _jd_fallback(jd_text)

    client = Groq(api_key=api_key)

    prompt = f"""Extract structured information from this job description.
Respond ONLY with valid JSON, no explanation.

{{
  "titre": "Job title (short, e.g. 'Senior Data Engineer')",
  "description": "2-3 sentence summary of the role",
  "domaine": "Domain (e.g. 'Informatique', 'Finance', 'Marketing', 'RH', 'Ingénierie')",
  "competences_requises": ["skill1", "skill2", ...],
  "annees_experience_min": <integer, 0 if not specified>
}}

JOB DESCRIPTION:
{jd_text[:3000]}"""

    try:
        raw = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=500,
        ).choices[0].message.content

        cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        start = cleaned.find("{")
        end   = cleaned.rfind("}") + 1
        result = json.loads(cleaned[start:end])

        return {
            "titre":                 result.get("titre", "Untitled"),
            "description":           result.get("description", jd_text[:200]),
            "domaine":               result.get("domaine", "Autre"),
            "competences_requises":  result.get("competences_requises", []),
            "annees_experience_min": int(result.get("annees_experience_min", 0)),
        }

    except Exception as e:
        logger.error("Erreur parsing JD avec LLM : %s", e)
        return _jd_fallback(jd_text)


def _jd_fallback(jd_text: str) -> dict:
    """Extraction basique par heuristiques si le LLM échoue."""
    lines = jd_text.strip().split("\n")
    titre = lines[0][:100] if lines else "Untitled"

    # Chercher les années d'expérience
    years = 0
    m = re.search(r"(\d+)\+?\s*(?:years?|ans?)\s*(?:of\s+)?(?:experience|expérience)", jd_text, re.I)
    if m:
        years = int(m.group(1))

    return {
        "titre": titre,
        "description": jd_text[:300],
        "domaine": "Autre",
        "competences_requises": [],
        "annees_experience_min": years,
    }


# ─────────────────────────────────────────────────────────────
#  3. Parsing des CVs avec le CVParser FairHire
# ─────────────────────────────────────────────────────────────

def parse_cv_text(resume_text: str, preset: str = "fast") -> dict | None:
    """
    Parse un CV texte avec le CVParser FairHire.
    Retourne le cv_data dict ou None si échec.
    """
    try:
        from app.services.cv_parser import CVParserFactory
        factory_method = getattr(CVParserFactory, preset)
        parser = factory_method()
        cv_data = parser.parse_text(resume_text)
        return json.loads(cv_data.to_json())
    except Exception as e:
        logger.error("Erreur parsing CV : %s", e)
        return None


# ─────────────────────────────────────────────────────────────
#  4. Pipeline complet
# ─────────────────────────────────────────────────────────────

def prepare_dataset(
    n_offres: int = 5,
    n_candidats: int = 10,
    preset: str = "fast",
) -> list[dict]:
    """
    Pipeline complet : échantillonne → parse JDs → parse CVs → sauvegarde.
    """
    # Étape 1 : échantillonnage
    groups = load_and_sample(n_offres, n_candidats)

    # Étape 2 : parse les JDs
    logger.info("═══ Parsing des %d Job Descriptions avec Groq ═══", len(groups))
    for i, group in enumerate(groups):
        logger.info("  JD %d/%d : %s...", i + 1, len(groups), group["jd_text"][:60])
        group["offre"] = parse_jd_with_llm(group["jd_text"])
        logger.info(
            "    → %s | %d skills | %d ans exp",
            group["offre"]["titre"],
            len(group["offre"]["competences_requises"]),
            group["offre"]["annees_experience_min"],
        )

    # Étape 3 : parse les CVs
    total_cv = sum(len(g["candidates"]) for g in groups)
    logger.info("═══ Parsing des %d CVs avec CVParser (preset=%s) ═══", total_cv, preset)

    # Instancier le parser UNE SEULE FOIS (singleton)
    try:
        from app.services.cv_parser import CVParserFactory
        factory_method = getattr(CVParserFactory, preset)
        parser = factory_method()
    except Exception as e:
        logger.error("Impossible d'instancier le CVParser : %s", e)
        sys.exit(1)

    cv_count = 0
    cv_errors = 0
    for group in groups:
        parsed_candidates = []
        for j, cand in enumerate(group["candidates"]):
            cv_count += 1
            logger.info(
                "  CV %d/%d (offre %s) — label=%s",
                cv_count, total_cv, group["offre_id"], cand["label"],
            )
            try:
                cv_data_obj = parser.parse_text(cand["resume_text"])
                cv_data = json.loads(cv_data_obj.to_json())

                parsed_candidates.append({
                    "cv_id": f"{group['offre_id']}_cv_{j+1:02d}",
                    "cv_data": cv_data,
                    "label": cand["label"],
                })
            except Exception as e:
                logger.error("    ✗ Erreur : %s", e)
                cv_errors += 1

        group["candidats"] = parsed_candidates

    logger.info(
        "Parsing terminé : %d/%d CVs réussis (%d erreurs)",
        cv_count - cv_errors, cv_count, cv_errors,
    )

    # Étape 4 : nettoyer et sauvegarder
    output = []
    for group in groups:
        if not group.get("candidats"):
            continue
        output.append({
            "offre_id":  group["offre_id"],
            "offre":     group["offre"],
            "candidats": group["candidats"],
        })

    # Sauvegarder
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    total_pairs = sum(len(g["candidats"]) for g in output)
    logger.info(
        "✓ Dataset sauvegardé : %s (%d offres, %d paires)",
        OUTPUT_PATH, len(output), total_pairs,
    )

    return output


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Prépare le dataset de benchmark matching depuis HuggingFace."
    )
    parser.add_argument("--n-offres", type=int, default=5,
                        help="Nombre d'offres à échantillonner (default: 5)")
    parser.add_argument("--n-candidats", type=int, default=10,
                        help="Nombre de candidats par offre (default: 10)")
    parser.add_argument("--preset", type=str, default="fast",
                        choices=["fast", "accurate", "fastest", "best", "multilingual"],
                        help="Preset du CVParser (default: fast)")
    args = parser.parse_args()

    prepare_dataset(
        n_offres=args.n_offres,
        n_candidats=args.n_candidats,
        preset=args.preset,
    )


if __name__ == "__main__":
    import traceback
    try:
        main()
    except Exception as e:
        traceback.print_exc()
        input("Appuie sur Entrée pour fermer...")