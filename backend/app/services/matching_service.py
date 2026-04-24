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

import hashlib

from pydantic import BaseModel, field_validator, ValidationError

# ── Singleton embeddings model ─────────────────────────────────────────────
# Chargé une seule fois pour évite le cold start (~400 MB sur disque)
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
# Alias définis dans skill_aliases.py (groupes de synonymes symétriques)
from app.services.skill_aliases import SKILL_ALIASES as _SKILL_ALIASES


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
    Estime le total d'années d'expérience en calculant l'écart entre
    la date de début de la première expérience (listée en dernier)
    et la date de fin de la dernière expérience (listée en premier).

    Ex : [2022-Présent, 2019-2022, 2017-2019] → Présent - 2017
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
        m = re.match(r"([a-zé]+)\.?\s*(\d{4})", s)
        if m:
            month_key = m.group(1)[:3]
            month = ALL_MONTHS.get(month_key)
            if month:
                return date(int(m.group(2)), month, 1)
        m = re.match(r"^(\d{4})$", s)
        if m:
            return date(int(m.group(1)), 1, 1)
        return None

    all_starts = []
    all_ends   = []

    for exp in experiences:
        period = (exp.get("period") or "").strip()
        if not period:
            continue
        parts = re.split(r"\s*[-–—/]\s*", period, maxsplit=1)
        if len(parts) < 2:
            continue
        start = parse_date(parts[0])
        end   = parse_date(parts[1])
        if start:
            all_starts.append(start)
        if end:
            all_ends.append(end)

    if not all_starts or not all_ends:
        return 0.0

    earliest_start = min(all_starts)
    latest_end     = max(all_ends)

    if latest_end < earliest_start:
        return 0.0

    months = (
        (latest_end.year  - earliest_start.year)  * 12 +
        (latest_end.month - earliest_start.month)
    )
    return round(max(0, months) / 12, 1)


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

        Méthode : intersection  pondérée.
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
    ) -> tuple[int, float]:
        """
        Score d'expérience (0-100) et années estimées.

        Returns:
            (score, years_cv) pour réutilisation sans recalcul.

        - 0 ans requis              → 100
        - candidat ≥ requis         → 100
        - candidat = requis - 1 an  → 75
        - candidat = requis - 2 ans → 40
        - candidat < requis - 2 ans → 10
        """
        years_cv = _extract_years_experience(experiences)
        logger.debug("Expérience estimée : %.1f ans (requis : %d)", years_cv, annees_min)

        if annees_min <= 0:
            return 100, years_cv

        if years_cv >= annees_min:
            return 100, years_cv
        gap = annees_min - years_cv
        if gap <= 1:   return 75, years_cv
        if gap <= 2:   return 40, years_cv
        return 10, years_cv

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
            cv_experiences:    list[dict],
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

        # Texte candidat : résumé + expériences + skills
        skills_str = ", ".join(cv_skills[:20]) if cv_skills else ""

        exp_parts = []
        for exp in cv_experiences[:5]:  # on prend les 5 plus récentes (listées en premier)
            title   = exp.get("title", "")
            company = exp.get("company", "")
            if title or company:
                exp_parts.append(f"{title} chez {company}".strip(" chez "))

        exp_str = " | ".join(exp_parts) if exp_parts else ""

        candidat_text = "\n".join(filter(None, [
            cv_summary or "",
            f"Expériences : {exp_str}" if exp_str else "",
            f"Compétences : {skills_str}" if skills_str else "",
        ])).strip()


        
        # Texte offre : titre + description + skills requis
        offre_skills_str = ", ".join(offre_skills) if offre_skills else ""
        offre_text = (
            f"{offre_titre}\n{offre_description}\n"
            f"Compétences requises : {offre_skills_str}"
        ).strip()

        if not candidat_text or not offre_text:
            return 50.0

        try:
            embeddings = embedder.encode([candidat_text, offre_text], normalize_embeddings=True)
            similarity = float(np.dot(embeddings[0], embeddings[1]))

            # Remapping sur une plage réaliste pour ce modèle sur texte RH
            # En pratique : profil hors-sujet ≈ 0.20, profil parfait ≈ 0.90
            LOW  = 0.20   # similarité minimale observée (profil totalement non-pertinent)
            HIGH = 0.90   # similarité maximale observée (profil quasi-identique à l'offre)

            clamped = max(LOW, min(HIGH, similarity))
            score   = round((clamped - LOW) / (HIGH - LOW) * 100, 1)

            logger.debug(
                "Score sémantique : %.1f (cosine=%.3f, clamped=[%.2f,%.2f])",
                score, similarity, LOW, HIGH
            )
            return score

        except Exception as e:
            logger.error("Erreur embedding : %s", e)
            return 50.0


# ── Couche 3 — LLM Judge ──────────────────────────────────────────────────
"""
LLMJudge — version améliorée
Couche 3 du moteur de matching :
- Modèle : llama-3.3-70b-versatile (Groq)
- Few-shots : 2 exemples (profil fort + profil faible)
- Validation Pydantic du JSON de sortie
- Cache DB via hash(cv_data + offre_contenu)
"""




# ── Schéma de validation de la sortie LLM ─────────────────────────────────
class LLMExplanation(BaseModel):
    points_forts:   str
    points_faibles: str
    recommandation: str

    @field_validator("recommandation")
    @classmethod
    def check_recommandation(cls, v: str) -> str:
        valides = [
            "Entretien recommandé",
            "À considérer avec réserve",
            "Profil insuffisant",
        ]
        if not any(v.startswith(r) for r in valides):
            raise ValueError(
                f"Recommandation invalide : '{v}'. "
                f"Attendu : {valides}"
            )
        return v

    @field_validator("points_forts", "points_faibles")
    @classmethod
    def check_non_vide(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Le champ ne peut pas être vide.")
        return v.strip()


# ── Calcul du hash de cache ────────────────────────────────────────────────
def _compute_cache_key(cv_data: dict, offre: dict) -> str:
    """
    Produit un hash SHA-256 stable sur le contenu réel du CV et de l'offre.

    Pourquoi hasher le CONTENU et pas juste offre_id + candidature_id ?
    ─────────────────────────────────────────────────────────────────────
    • offre_id reste le même si le recruteur modifie les compétences requises
      → l'ancien résultat en cache serait caduc mais on ne le saurait pas.
    • candidature_id change si la candidature est supprimée/recréée, même si
      le CV est identique → on ferait un appel LLM inutile.

    Le hash porte sur les données qui influencent RÉELLEMENT la sortie du LLM :
    - côté CV      : skills, experiences, education, summary
    - côté offre   : titre, description, competences_requises, domaine

    Stabilité : json.dumps avec sort_keys=True garantit le même hash
    indépendamment de l'ordre des clés dans les dicts Python.
    """
    cv_fingerprint = {
        "skills":      sorted(cv_data.get("skills", [])),
        "summary":     (cv_data.get("summary") or "").strip(),
        "experiences": cv_data.get("experiences", []),
        "education":   cv_data.get("education", []),
    }
    offre_fingerprint = {
        "titre":               (offre.get("titre") or "").strip(),
        "description":         (offre.get("description") or "").strip(),
        "competences_requises": sorted(offre.get("competences_requises") or []),
        "domaine":             (offre.get("domaine") or "").strip(),
    }
    payload = json.dumps(
        {"cv": cv_fingerprint, "offre": offre_fingerprint},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ── Few-shots ──────────────────────────────────────────────────────────────
# Deux exemples injectés dans le prompt pour ancrer le format et le ton.
# Règle : un exemple fort (score ≥ 80), un exemple faible (score ≤ 40).
# Ces exemples sont fictifs mais réalistes — ils montrent au modèle
# la granularité attendue et empêchent les réponses génériques.
_FEW_SHOTS = """
=== EXEMPLE 1 — Profil fort (score 87/100, niveau EXCELLENT) ===
POSTE : Ingénieur Backend Senior (Informatique)
PROFIL :
- Résumé : Ingénieur avec 7 ans d'expérience en Python et architecture microservices.
- Expériences : Lead Dev chez Dataiku (2020-Présent), Ingénieur Backend chez Criteo (2017-2020)
- Formation : Master Informatique — Télécom Paris (2017)
- Compétences correspondantes : Python, FastAPI, PostgreSQL, Docker, Kubernetes
- Compétences manquantes : Kafka
- Expérience requise : 5 ans (candidat : 7 ans)

Réponse attendue :
{
  "points_forts": "Profil senior très solide avec 7 ans d'expérience directement pertinente en Python et microservices. Passage en leadership technique chez Dataiku confirme la capacité à monter en responsabilité.",
  "points_faibles": "Absence de Kafka peut nécessiter une courte montée en compétence, mais le background distributed systems compense largement.",
  "recommandation": "Entretien recommandé — profil au-dessus du seuil sur presque tous les critères."
}

=== EXEMPLE 2 — Profil faible (score 28/100, niveau FAIBLE) ===
POSTE : Développeur Full-Stack React/Node.js (Informatique)
PROFIL :
- Résumé : Développeur junior avec 1 an d'expérience en PHP et WordPress.
- Expériences : Développeur Web chez Agence XY (2023-Présent)
- Formation : BTS SIO — Lycée Technique Lyon (2022)
- Compétences correspondantes : HTML, CSS
- Compétences manquantes : React, Node.js, TypeScript, REST API, Git
- Expérience requise : 3 ans (candidat : 1 an)

Réponse attendue :
{
  "points_forts": "Maîtrise des bases front-end (HTML/CSS) et première expérience professionnelle en agence.",
  "points_faibles": "Écart important sur les technologies cœur du poste (React, Node.js, TypeScript absents) et expérience insuffisante de 2 ans par rapport au minimum requis.",
  "recommandation": "Profil insuffisant pour ce poste — à reconsidérer dans 18-24 mois après montée en compétences."
}
"""


# ── LLM Judge ─────────────────────────────────────────────────────────────
class LLMJudge:
    """
    Génère une explication en langage naturel du score de matching.
    Cache les résultats en DB pour éviter les appels LLM redondants.
    """

    MODEL = "llama-3.3-70b-versatile"

    def explain(
        self,
        score_total:       int,
        niveau:            str,
        skills_matchees:   list[str],
        skills_manquantes: list[str],
        annees_cv:         float,
        annees_requises:   int,
        offre_titre:       str,
        offre_domaine:     str,
        cv_summary:        Optional[str],
        cv_experiences:    list[dict],
        cv_education:      list[dict],
        # ── nouveaux paramètres pour le cache ──
        cv_data:           Optional[dict] = None,
        offre:             Optional[dict] = None,
        db=None,                                    # Session SQLAlchemy
    ) -> dict[str, str]:

        # ── 1. Tentative de lecture cache ───────────────────────
        cache_key: Optional[str] = None
        if cv_data and offre and db:
            cache_key = _compute_cache_key(cv_data, offre)
            cached = _read_cache(db, cache_key)
            if cached:
                logger.info("LLM Judge : résultat en cache (key=%s…)", cache_key[:12])
                return cached

        # ── 2. Construction du prompt ───────────────────────────
        exp_lines = []
        for exp in cv_experiences[:5]:
            title   = exp.get("title", "")
            company = exp.get("company", "")
            period  = exp.get("period", "")
            exp_lines.append(f"  • {title} chez {company} ({period})".strip(" chez ()"))
        exp_str = "\n".join(exp_lines) or "  • Non disponible"

        edu_lines = []
        for edu in cv_education[:3]:
            degree = edu.get("degree", "")
            inst   = edu.get("institution", "")
            year   = edu.get("year", "")
            edu_lines.append(f"  • {degree} — {inst} ({year})".strip(" — ()"))
        edu_str = "\n".join(edu_lines) or "  • Non disponible"

        prompt = f"""Tu es un expert RH senior. Tu évalues des candidats pour des postes précis.
Voici deux exemples de ce qui est attendu :

{_FEW_SHOTS}

=== MAINTENANT, ÉVALUE CE CANDIDAT ===
POSTE : {offre_titre} ({offre_domaine})
SCORE GLOBAL : {score_total}/100 ({niveau})

PROFIL CANDIDAT :
- Résumé         : {cv_summary or 'Non disponible'}
- Expériences ({annees_cv} ans au total) :
{exp_str}
- Formation :
{edu_str}
- Compétences correspondantes : {', '.join(skills_matchees) if skills_matchees else 'aucune'}
- Compétences manquantes      : {', '.join(skills_manquantes) if skills_manquantes else 'aucune'}
- Expérience requise          : {annees_requises} ans

Réponds UNIQUEMENT en JSON valide avec exactement ces 3 clés :
{{
  "points_forts":   "1-2 phrases sur les atouts du candidat pour CE poste",
  "points_faibles": "1-2 phrases sur les lacunes (ou 'Aucun point faible majeur' si score > 80)",
  "recommandation": "Commence OBLIGATOIREMENT par l'une de ces trois phrases exactes : 'Entretien recommandé', 'À considérer avec réserve', 'Profil insuffisant' — puis complète en une phrase."
}}

Sois factuel et base-toi uniquement sur les données fournies. Aucun texte hors du JSON."""

        # ── 3. Appel Groq ────────────────────────────────────────
        try:
            from groq import Groq
            client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        except Exception as e:
            logger.warning("Groq indisponible : %s", e)
            return self._fallback_explanation(score_total, skills_matchees, skills_manquantes)

        try:
            raw = client.chat.completions.create(
                model=self.MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=400,                    # augmenté pour éviter la troncature
                stop=["}"],                        # stoppe proprement après la fermeture JSON
            ).choices[0].message.content

            # Groq avec stop="}] ne capture pas le "}" final — on le réinjecte
            raw = raw.strip()
            if not raw.endswith("}"):
                raw += "}"

            # Nettoyage des éventuels backticks markdown
            cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
            start   = cleaned.find("{")
            end     = cleaned.rfind("}") + 1
            parsed  = json.loads(cleaned[start:end])

        except Exception as e:
            logger.error("Erreur appel LLM : %s", e)
            return self._fallback_explanation(score_total, skills_matchees, skills_manquantes)

        # ── 4. Validation Pydantic ───────────────────────────────
        try:
            validated = LLMExplanation(**parsed)
            result = {
                "points_forts":   validated.points_forts,
                "points_faibles": validated.points_faibles,
                "recommandation": validated.recommandation,
            }
        except ValidationError as e:
            logger.warning(
                "Validation LLM échouée (%s) — tentative de correction automatique",
                e.error_count()
            )
            # Correction automatique : si la recommandation ne commence pas bien,
            # on la force à partir du score plutôt que de tout rejeter
            result = self._repair_explanation(parsed, score_total, skills_matchees, skills_manquantes)

        # ── 5. Écriture cache ────────────────────────────────────
        if cache_key and db:
            _write_cache(db, cache_key, result)

        logger.info("LLM Judge OK — modèle=%s cache_key=%s", self.MODEL, (cache_key or "n/a")[:12])
        return result

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _repair_explanation(
        raw: dict,
        score: int,
        matchees: list[str],
        manquantes: list[str],
    ) -> dict[str, str]:
        """
        Tente de récupérer un résultat partiel plutôt que de tomber en fallback total.
        Corrige uniquement la recommandation si elle est mal formée.
        """
        reco_correcte = (
            "Entretien recommandé" if score >= 70
            else "À considérer avec réserve" if score >= 50
            else "Profil insuffisant"
        )
        return {
            "points_forts":   raw.get("points_forts", "").strip() or (
                f"Maîtrise de {', '.join(matchees[:3])}." if matchees
                else "Profil à évaluer manuellement."
            ),
            "points_faibles": raw.get("points_faibles", "").strip() or (
                f"Compétences manquantes : {', '.join(manquantes[:3])}." if manquantes
                else "Aucun point faible majeur détecté."
            ),
            "recommandation": reco_correcte,
        }

    @staticmethod
    def _fallback_explanation(
        score: int,
        matchees: list[str],
        manquantes: list[str],
    ) -> dict[str, str]:
        """Explication générique si le LLM est totalement indisponible."""
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


# ── Fonctions de cache DB ──────────────────────────────────────────────────
# On réutilise ta session SQLAlchemy existante.
# Le modèle LLMCache est à ajouter dans app/models/ (voir ci-dessous).

def _read_cache(db, cache_key: str) -> Optional[dict]:
    try:
        from app.models.llm_cache import LLMCache
        row = db.query(LLMCache).filter(LLMCache.cache_key == cache_key).first()
        if row:
            return json.loads(row.result_json)
    except Exception as e:
        logger.warning("Lecture cache LLM échouée : %s", e)
    return None


def _write_cache(db, cache_key: str, result: dict) -> None:
    try:
        from app.models.llm_cache import LLMCache
        existing = db.query(LLMCache).filter(LLMCache.cache_key == cache_key).first()
        if not existing:
            db.add(LLMCache(
                cache_key=cache_key,
                result_json=json.dumps(result, ensure_ascii=False),
            ))
            db.commit()
    except Exception as e:
        logger.warning("Écriture cache LLM échouée : %s", e)
        db.rollback()





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

    def match(self, cv_data: dict, offre: dict, db=None) -> MatchScore:
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
        score_exp, annees_cv = self.rules.compute_experience_score(cv_experiences, annees_min)
        score_edu = self.rules.compute_formation_score(cv_education, offre_domaine)

        # ── Couche 2 : Embeddings ───────────────────────────────
        logger.info("Matching couche 2 — embeddings sémantiques")
        score_sem = self.embedder.compute(
            cv_summary, cv_skills, cv_experiences, offre_titre, offre_desc, offre_skills
        )
        # ── Score final ─────────────────────────────────────────
        score_total = self.rules.compute_final_score(
            score_skills, score_exp, score_sem, score_edu
        )
        niveau = MatchScore.niveau_from_score(score_total)

        # ── Couche 3 : LLM Judge ────────────────────────────────
        logger.info("Matching couche 3 — LLM Judge (explication)")
        explanation = self.judge.explain(
            score_total, niveau, matchees, manquantes,
            annees_cv, annees_min, offre_titre, offre_domaine,
            cv_summary, cv_experiences, cv_education,
            cv_data=cv_data,
            offre=offre,
            db=db,
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