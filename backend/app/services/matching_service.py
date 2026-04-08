"""
Matching Engine — Architecture 3 couches
=========================================

Couche 1 — Règles métier   : skills, expérience, formation  (déterministe)
Couche 2 — Embeddings      : sentence-transformers          (sémantique)
Couche 3 — LLM Judge       : Groq                           (explication)

Score final = 35% skills + 25% expérience + 25% sémantique + 15% formation
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("matching_service")


# ── Singleton embeddings model ─────────────────────────────────────────────
# Chargé une seule fois pour éviter le cold start (~400 MB sur disque)
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            # paraphrase-multilingual — supporte FR + EN + AR, 768 dimensions
            _embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("SentenceTransformer chargé (paraphrase-multilingual-MiniLM-L12-v2)")
        except ImportError:
            logger.error(
                "sentence-transformers non installé.\n"
                "pip install sentence-transformers"
            )
    return _embedder


def warmup_embedder() -> None:
    """Préchauffe le modèle d'embeddings au démarrage de FastAPI."""
    logger.info("Préchauffage du modèle d'embeddings...")
    _get_embedder()
    logger.info("Embeddings prêt.")


# ── Normalisation des compétences ──────────────────────────────────────────
# Dictionnaire d'alias pour unifier les variantes orthographiques
_SKILL_ALIASES: dict[str, str] = {
    "reactjs": "react", "react.js": "react", "react js": "react",
    "vuejs": "vue", "vue.js": "vue",
    "angularjs": "angular", "angular.js": "angular",
    "nodejs": "node", "node.js": "node",
    "nextjs": "next", "next.js": "next",
    "typescript": "ts", "javascript": "js",
    "postgresql": "postgres", "mysql": "sql", "mariadb": "sql",
    "mongodb": "mongo",
    "scikit-learn": "sklearn", "scikit learn": "sklearn",
    "machine learning": "ml", "deep learning": "dl",
    "natural language processing": "nlp",
    "amazon web services": "aws",
    "google cloud platform": "gcp",
    "microsoft azure": "azure",
    "fastapi": "fastapi", "fast api": "fastapi",
    "spring boot": "spring", "springboot": "spring",
}


def _normalize_skill(skill: str) -> str:
    """Normalise un skill : lowercase, strip, résolution des alias."""
    normalized = skill.strip().lower()
    normalized = re.sub(r"[^\w\s\.\+\#]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return _SKILL_ALIASES.get(normalized, normalized)


def _normalize_skills(skills: list[str]) -> set[str]:
    return {_normalize_skill(s) for s in skills if s.strip()}


# ── Extraction des années d'expérience depuis les expériences parsées ──────
def _extract_years_experience(experiences: list[dict]) -> float:
    """
    Estime le total d'années d'expérience à partir des expériences extraites.

    Stratégie :
        1. Cherche les périodes de type "Jan 2020 - Présent" ou "2019 - 2022"
        2. Calcule la durée de chaque poste
        3. Somme sans chevauchements (heuristique : on somme simplement)
    """
    from datetime import date
    import re

    MONTHS_FR = {
        "jan": 1, "fev": 2, "fév": 2, "mar": 3, "avr": 4,
        "mai": 5, "jun": 6, "jul": 7, "jui": 7, "aou": 8, "aoû": 8,
        "sep": 9, "oct": 10, "nov": 11, "dec": 12, "déc": 12,
    }
    MONTHS_EN = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    ALL_MONTHS = {**MONTHS_FR, **MONTHS_EN}
    PRESENT_WORDS = {"présent", "present", "aujourd'hui", "actuel", "current", "now"}

    def parse_date(s: str) -> Optional[date]:
        s = s.strip().lower()
        if s in PRESENT_WORDS:
            return date.today()
        # "jan 2022" ou "janvier 2022"
        m = re.match(r"([a-zé]+)\.?\s*(\d{4})", s)
        if m:
            month_key = m.group(1)[:3]
            month = ALL_MONTHS.get(month_key)
            if month:
                return date(int(m.group(2)), month, 1)
        # "2022" seul
        m = re.match(r"^(\d{4})$", s)
        if m:
            return date(int(m.group(1)), 1, 1)
        return None

    total_months = 0

    for exp in experiences:
        period = (exp.get("period") or "").strip()
        if not period:
            continue
        # Séparateur : " - ", " – ", " — ", " / "
        parts = re.split(r"\s*[-–—/]\s*", period, maxsplit=1)
        if len(parts) < 2:
            continue
        start = parse_date(parts[0])
        end   = parse_date(parts[1])
        if start and end and end >= start:
            months = (end.year - start.year) * 12 + (end.month - start.month)
            total_months += max(0, months)

    return round(total_months / 12, 1)


# ── Dataclass résultat ─────────────────────────────────────────────────────
@dataclass
class MatchScore:
    score_total:      int
    niveau:           str
    score_skills:     int
    score_experience: int
    score_semantique: float
    score_formation:  int
    skills_matchees:  list[str]  = field(default_factory=list)
    skills_manquantes: list[str] = field(default_factory=list)
    points_forts:     str        = ""
    points_faibles:   str        = ""
    recommandation:   str        = ""

    def skills_detail_json(self) -> str:
        return json.dumps({
            "matchees":   self.skills_matchees,
            "manquantes": self.skills_manquantes,
        }, ensure_ascii=False)

    @staticmethod
    def niveau_from_score(score: int) -> str:
        if score >= 80: return "EXCELLENT"
        if score >= 60: return "BON"
        if score >= 40: return "PARTIEL"
        return "FAIBLE"


# ── Couche 1 — Règles métier ───────────────────────────────────────────────
class RulesLayer:
    """
    Calcule les scores déterministes à partir des données structurées.
    Aucun ML, aucune API — résultats reproductibles et auditables.
    """

    # Poids des sous-scores dans le score final
    W_SKILLS     = 0.35
    W_EXPERIENCE = 0.25
    W_SEMANTIQUE = 0.25
    W_FORMATION  = 0.15

    def compute_skills_score(
        self,
        cv_skills: list[str],
        offre_skills: list[str],
    ) -> tuple[int, list[str], list[str]]:
        """
        Score de correspondance des compétences (0-100).

        Méthode : intersection Jaccard pondérée.
        - On normalise les deux listes (alias, lowercase)
        - On compte les skills de l'offre couverts par le CV
        - Bonus si le CV a plus de skills que requis (max +10pts)
        """
        if not offre_skills:
            return 100, [], []

        cv_norm    = _normalize_skills(cv_skills)
        offre_norm = _normalize_skills(offre_skills)

        matchees   = [s for s in offre_skills
                      if _normalize_skill(s) in cv_norm]
        manquantes = [s for s in offre_skills
                      if _normalize_skill(s) not in cv_norm]

        coverage = len(matchees) / len(offre_norm)
        score    = int(coverage * 100)

        # Bonus compétences supplémentaires (CV plus riche que requis)
        bonus = min(10, max(0, len(cv_norm) - len(offre_norm)) * 2)
        score = min(100, score + bonus)

        return score, matchees, manquantes

    def compute_experience_score(
        self,
        experiences: list[dict],
        annees_min: int,
    ) -> int:
        """
        Score d'expérience (0-100).

        - 0 ans requis              → 100
        - candidat ≥ requis         → 100
        - candidat = requis - 1 an  → 75
        - candidat = requis - 2 ans → 40
        - candidat < requis - 2 ans → 10
        """
        if annees_min <= 0:
            return 100

        years_cv = _extract_years_experience(experiences)
        logger.debug("Expérience estimée : %.1f ans (requis : %d)", years_cv, annees_min)

        if years_cv >= annees_min:
            return 100
        gap = annees_min - years_cv
        if gap <= 1:   return 75
        if gap <= 2:   return 40
        return 10

    def compute_formation_score(
        self,
        education: list[dict],
        offre_domaine: str,
    ) -> int:
        """
        Score de formation (0-100).

        Heuristique :
        - Diplôme détecté → 40 pts de base
        - Domaine du diplôme proche du domaine de l'offre → +40 pts
        - Master/PhD → +20 pts supplémentaires
        """
        if not education:
            return 30  # pas d'info → score neutre

        score    = 40  # diplôme présent
        offre_kw = set(offre_domaine.lower().split())

        for edu in education:
            degree  = (edu.get("degree")      or "").lower()
            inst    = (edu.get("institution") or "").lower()
            combined = f"{degree} {inst}"

            # Niveau de diplôme
            if any(w in degree for w in ("master", "ingénieur", "engineer", "phd", "doctorat", "mba")):
                score = min(100, score + 20)

            # Correspondance domaine
            domain_words = {
                "informatique": {"informatique", "info", "computer", "software", "numérique", "digital"},
                "finance":      {"finance", "compta", "comptabilité", "économie", "gestion"},
                "marketing":    {"marketing", "communication", "digital", "commerce"},
                "rh":           {"rh", "ressources", "humaines", "gestion"},
                "ingénierie":   {"ingénieur", "engineer", "mécanique", "électrique", "civil"},
            }

            for domain, keywords in domain_words.items():
                if domain in offre_domaine.lower() and any(k in combined for k in keywords):
                    score = min(100, score + 40)
                    break

            break  # on ne prend que le premier diplôme (le plus récent)

        return min(100, score)

    def compute_final_score(
        self,
        score_skills:     int,
        score_experience: int,
        score_semantique: float,
        score_formation:  int,
    ) -> int:
        total = (
            score_skills     * self.W_SKILLS
            + score_experience * self.W_EXPERIENCE
            + score_semantique * self.W_SEMANTIQUE
            + score_formation  * self.W_FORMATION
        )
        return round(total)


# ── Couche 2 — Embeddings sémantiques ─────────────────────────────────────
class EmbeddingLayer:
    """
    Calcule la similarité sémantique entre le profil candidat et l'offre.

    Encode deux textes de synthèse et calcule leur cosine similarity.
    Capture les équivalences que les règles manquent :
        "développeur backend" ≈ "ingénieur API REST"
        "machine learning" ≈ "intelligence artificielle"
    """

    def compute(
        self,
        cv_summary:        Optional[str],
        cv_skills:         list[str],
        offre_titre:       str,
        offre_description: str,
        offre_skills:      list[str],
    ) -> float:
        """
        Retourne un score sémantique entre 0 et 100.
        Retourne 50 (neutre) si le modèle n'est pas disponible.
        """
        embedder = _get_embedder()
        if embedder is None:
            logger.warning("Embedder indisponible → score sémantique neutre (50)")
            return 50.0

        import numpy as np

        # Texte candidat : résumé + skills
        skills_str  = ", ".join(cv_skills[:20]) if cv_skills else ""
        candidat_text = f"{cv_summary or ''}\nCompétences : {skills_str}".strip()

        # Texte offre : titre + description + skills requis
        offre_skills_str = ", ".join(offre_skills) if offre_skills else ""
        offre_text = (
            f"{offre_titre}\n{offre_description}\n"
            f"Compétences requises : {offre_skills_str}"
        ).strip()

        if not candidat_text or not offre_text:
            return 50.0

        try:
            embeddings  = embedder.encode([candidat_text, offre_text], normalize_embeddings=True)
            similarity  = float(np.dot(embeddings[0], embeddings[1]))
            # Cosine similarity ∈ [-1, 1] → ramené à [0, 100]
            score = round((similarity + 1) / 2 * 100, 1)
            logger.debug("Score sémantique : %.1f (cosine=%.3f)", score, similarity)
            return score

        except Exception as e:
            logger.error("Erreur embedding : %s", e)
            return 50.0


# ── Couche 3 — LLM Judge ──────────────────────────────────────────────────
class LLMJudge:
    """
    Génère une explication en langage naturel du score de matching.

    Reçoit les scores et les données brutes → produit :
    - points_forts    : ce que le candidat apporte
    - points_faibles  : ce qui manque
    - recommandation  : action suggérée au recruteur
    """

    def explain(
        self,
        score_total:      int,
        niveau:           str,
        skills_matchees:  list[str],
        skills_manquantes: list[str],
        annees_cv:        float,
        annees_requises:  int,
        offre_titre:      str,
        offre_domaine:    str,
        cv_summary:       Optional[str],
    ) -> dict[str, str]:
        """
        Retourne {"points_forts": ..., "points_faibles": ..., "recommandation": ...}
        Retourne des valeurs par défaut si Groq n'est pas disponible.
        """
        try:
            from groq import Groq
            client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        except Exception as e:
            logger.warning("Groq indisponible pour l'explication : %s", e)
            return self._fallback_explanation(
                score_total, skills_matchees, skills_manquantes
            )

        prompt = f"""Tu es un expert RH. Génère une évaluation concise d'un candidat pour un poste.

POSTE : {offre_titre} ({offre_domaine})
SCORE GLOBAL : {score_total}/100 ({niveau})

DONNÉES :
- Compétences correspondantes : {', '.join(skills_matchees) if skills_matchees else 'aucune'}
- Compétences manquantes      : {', '.join(skills_manquantes) if skills_manquantes else 'aucune'}
- Expérience candidat         : {annees_cv} ans  |  Requis : {annees_requises} ans
- Résumé candidat             : {cv_summary or 'Non disponible'}

Réponds UNIQUEMENT en JSON valide avec exactement ces 3 clés :
{{
  "points_forts":   "1-2 phrases sur les atouts du candidat pour CE poste",
  "points_faibles": "1-2 phrases sur les lacunes pour CE poste (ou 'Aucun point faible majeur' si score > 80)",
  "recommandation": "Une phrase d'action pour le recruteur : Entretien recommandé / À considérer avec réserve / Profil insuffisant"
}}

Sois factuel, précis, et base-toi uniquement sur les données fournies."""

        try:
            raw = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=250,
            ).choices[0].message.content

            cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
            start   = cleaned.find("{")
            end     = cleaned.rfind("}") + 1
            result  = json.loads(cleaned[start:end])

            return {
                "points_forts":    result.get("points_forts",    ""),
                "points_faibles":  result.get("points_faibles",  ""),
                "recommandation":  result.get("recommandation",  ""),
            }

        except Exception as e:
            logger.error("Erreur LLM Judge : %s", e)
            return self._fallback_explanation(
                score_total, skills_matchees, skills_manquantes
            )

    @staticmethod
    def _fallback_explanation(
        score: int,
        matchees: list[str],
        manquantes: list[str],
    ) -> dict[str, str]:
        """Explication générique si le LLM est indisponible."""
        forts = (
            f"Maîtrise de {', '.join(matchees[:3])}."
            if matchees else "Profil à évaluer manuellement."
        )
        faibles = (
            f"Compétences manquantes : {', '.join(manquantes[:3])}."
            if manquantes else "Aucun point faible majeur détecté."
        )
        reco = (
            "Entretien recommandé." if score >= 70
            else "À considérer avec réserve." if score >= 50
            else "Profil insuffisant pour ce poste."
        )
        return {"points_forts": forts, "points_faibles": faibles, "recommandation": reco}


# ── Orchestrateur principal ────────────────────────────────────────────────
class MatchingEngine:
    """
    Orchestre les 3 couches et retourne un MatchScore complet.

    Usage :
        engine = MatchingEngine()
        result = engine.match(cv_data_dict, offre_dict)
    """

    def __init__(self):
        self.rules    = RulesLayer()
        self.embedder = EmbeddingLayer()
        self.judge    = LLMJudge()

    def match(self, cv_data: dict, offre: dict) -> MatchScore:
        """
        Lance le matching complet.

        Args:
            cv_data : dict issu de CVData.to_json() (parsé depuis la DB)
            offre   : dict avec titre, description, domaine,
                      competences_requises, annees_experience_min
        """
        # ── Extraction des données ──────────────────────────────
        cv_skills     = cv_data.get("skills", [])
        cv_experiences = cv_data.get("experiences", [])
        cv_education  = cv_data.get("education", [])
        cv_summary    = cv_data.get("summary") or ""

        offre_skills  = offre.get("competences_requises", [])
        offre_titre   = offre.get("titre", "")
        offre_desc    = offre.get("description", "")
        offre_domaine = offre.get("domaine", "")
        annees_min    = int(offre.get("annees_experience_min", 0) or 0)

        # ── Couche 1 : Règles ───────────────────────────────────
        logger.info("Matching couche 1 — règles métier")
        score_skills, matchees, manquantes = self.rules.compute_skills_score(
            cv_skills, offre_skills
        )
        score_exp = self.rules.compute_experience_score(cv_experiences, annees_min)
        score_edu = self.rules.compute_formation_score(cv_education, offre_domaine)

        # ── Couche 2 : Embeddings ───────────────────────────────
        logger.info("Matching couche 2 — embeddings sémantiques")
        score_sem = self.embedder.compute(
            cv_summary, cv_skills, offre_titre, offre_desc, offre_skills
        )

        # ── Score final ─────────────────────────────────────────
        score_total = self.rules.compute_final_score(
            score_skills, score_exp, score_sem, score_edu
        )
        niveau = MatchScore.niveau_from_score(score_total)

        # ── Couche 3 : LLM Judge ────────────────────────────────
        logger.info("Matching couche 3 — LLM Judge (explication)")
        annees_cv = _extract_years_experience(cv_experiences)
        explanation = self.judge.explain(
            score_total, niveau, matchees, manquantes,
            annees_cv, annees_min, offre_titre, offre_domaine, cv_summary,
        )

        logger.info(
            "Matching terminé — score=%d (%s) | skills=%d/%d | exp=%.1f/%d ans | sem=%.1f",
            score_total, niveau,
            len(matchees), len(offre_skills),
            annees_cv, annees_min,
            score_sem,
        )

        return MatchScore(
            score_total      = score_total,
            niveau           = niveau,
            score_skills     = score_skills,
            score_experience = score_exp,
            score_semantique = round(score_sem, 1),
            score_formation  = score_edu,
            skills_matchees  = matchees,
            skills_manquantes = manquantes,
            points_forts     = explanation["points_forts"],
            points_faibles   = explanation["points_faibles"],
            recommandation   = explanation["recommandation"],
        )


# ── Singleton engine ───────────────────────────────────────────────────────
_engine: Optional[MatchingEngine] = None


def get_engine() -> MatchingEngine:
    global _engine
    if _engine is None:
        _engine = MatchingEngine()
    return _engine