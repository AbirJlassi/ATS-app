from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.candidature import Candidature, ParseStatut
from app.models.match_result import MatchResult
from app.models.user import Role, User
from app.schemas.match_result import MatchResultOut

router = APIRouter(prefix="/matching", tags=["Matching IA"])


@router.get("/candidatures/{candidature_id}", response_model=MatchResultOut)
def get_match_result(
    candidature_id: UUID,
    db:             Session = Depends(get_db),
    _:              User    = Depends(require_role(Role.RECRUTEUR, Role.ADMINISTRATEUR)),
):
    """Retourne le score de matching d'une candidature."""
    mr = db.query(MatchResult).filter(
        MatchResult.candidature_id == candidature_id
    ).first()
    if not mr:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Score de matching non disponible. Le parsing est peut-être en cours."
        )
    return mr


@router.post("/candidatures/{candidature_id}/recalculate",
             response_model=dict,
             status_code=status.HTTP_202_ACCEPTED)
def recalculate_match(
    candidature_id:  UUID,
    background_tasks: BackgroundTasks,
    db:              Session = Depends(get_db),
    _:               User    = Depends(require_role(Role.RECRUTEUR, Role.ADMINISTRATEUR)),
):
    """
    Relance le matching manuellement.
    Utile si l'offre a été modifiée après la candidature.
    """
    c = db.query(Candidature).filter(Candidature.id == candidature_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature introuvable.")
    if c.parse_statut != ParseStatut.TERMINE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Le parsing doit être terminé avant de lancer le matching."
        )

    from app.services.matching_background import run_matching_background
    background_tasks.add_task(run_matching_background, candidature_id)

    return {"message": "Matching relancé en arrière-plan."}


@router.get("/offres/{offre_id}/ranking", response_model=list[dict])
def get_ranking(
    offre_id: UUID,
    db:       Session = Depends(get_db),
    current:  User    = Depends(require_role(Role.RECRUTEUR, Role.ADMINISTRATEUR)),
):
    """
    Retourne le classement des candidats pour une offre,
    triés par score décroissant.
    """
    from app.models.offre import OffreEmploi
    offre = db.query(OffreEmploi).filter(OffreEmploi.id == offre_id).first()
    if not offre:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
    if offre.recruteur_id != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé.")

    # Jointure Candidature → MatchResult
    rows = (
        db.query(Candidature, MatchResult)
        .join(MatchResult, MatchResult.candidature_id == Candidature.id, isouter=True)
        .filter(Candidature.offre_id == offre_id)
        .all()
    )

    ranking = []
    for cand, mr in rows:
        entry = {
            "candidature_id":  str(cand.id),
            "candidat_nom":    cand.candidat.nom    if cand.candidat else None,
            "candidat_prenom": cand.candidat.prenom if cand.candidat else None,
            "candidat_email":  cand.candidat.email  if cand.candidat else None,
            "statut":          cand.statut,
            "parse_statut":    cand.parse_statut,
            "cv_summary":      cand.cv_summary,
            "score_total":     mr.score_total      if mr else None,
            "niveau":          mr.niveau           if mr else None,
            "score_skills":    mr.score_skills     if mr else None,
            "score_experience": mr.score_experience if mr else None,
            "score_semantique": mr.score_semantique if mr else None,
            "recommandation":  mr.recommandation   if mr else None,
        }
        ranking.append(entry)

    # Tri : candidats avec score en tête, sans score à la fin
    ranking.sort(key=lambda x: x["score_total"] or -1, reverse=True)
    return ranking