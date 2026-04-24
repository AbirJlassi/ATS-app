"""
Tâche de fond : déclenche le matching après parsing du CV.
"""
import json
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.candidature import Candidature, ParseStatut
from app.models.match_result import MatchResult

logger = logging.getLogger("matching_background")


def run_matching_background(candidature_id: UUID) -> None:
    """
    Calcule le score de matching pour une candidature dont le parsing est terminé.
    Crée ou met à jour le MatchResult associé.

    Appelée en BackgroundTask après parse_cv_background.
    """
    db: Session = SessionLocal()
    try:
        # ── Récupération des données ────────────────────────────
        candidature = db.query(Candidature).filter(
            Candidature.id == candidature_id
        ).first()

        if not candidature:
            logger.error("Candidature %s introuvable pour matching", candidature_id)
            return

        if candidature.parse_statut != ParseStatut.TERMINE:
            logger.warning(
                "Candidature %s : parsing non terminé (%s) — matching annulé",
                candidature_id, candidature.parse_statut,
            )
            return

        if not candidature.cv_data:
            logger.warning("Candidature %s : cv_data absent — matching annulé", candidature_id)
            return

        offre = candidature.offre
        if not offre:
            logger.error("Candidature %s : offre associée introuvable", candidature_id)
            return

        # ── Désérialisation cv_data ─────────────────────────────
        try:
            cv_data = json.loads(candidature.cv_data)
        except Exception as e:
            logger.error("Impossible de désérialiser cv_data : %s", e)
            return

        # ── Matching ────────────────────────────────────────────
        from app.services.matching_service import get_engine

        offre_dict = {
            "titre":                 offre.titre,
            "description":           offre.description,
            "domaine":               offre.domaine,
            "competences_requises":  offre.competences_requises or [],
            "annees_experience_min": offre.annees_experience_min or 0,
        }

        engine = get_engine()
        result = engine.match(cv_data, offre_dict, db=db)  # ← db transmis pour le cache LLM

        # ── Upsert MatchResult ──────────────────────────────────
        existing = db.query(MatchResult).filter(
            MatchResult.candidature_id == candidature_id
        ).first()

        if existing:
            mr = existing
        else:
            mr = MatchResult(candidature_id=candidature_id)
            db.add(mr)

        mr.score_total      = result.score_total
        mr.score_skills     = result.score_skills
        mr.score_experience = result.score_experience
        mr.score_semantique = result.score_semantique
        mr.score_formation  = result.score_formation
        mr.niveau           = result.niveau
        mr.skills_detail    = result.skills_detail_json()
        mr.points_forts     = result.points_forts
        mr.points_faibles   = result.points_faibles
        mr.recommandation   = result.recommandation

        db.commit()

        logger.info(
            "MatchResult sauvegardé — candidature %s : %d/100 (%s)",
            candidature_id, result.score_total, result.niveau,
        )

    except Exception as e:
        logger.error("Erreur inattendue dans run_matching_background : %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()