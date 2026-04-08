from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.candidature import Candidature, ParseStatut, StatutCandidature
from app.models.user import Role, User
from app.schemas.candidature import CandidatureOut, CandidatureStatutUpdate, deserialize_cv_data
from app.services.candidature_service import CandidatureService
from app.services.cv_parsing_service import parse_cv_background

router = APIRouter(tags=["Candidatures"])


def _enrich(c, out: CandidatureOut) -> CandidatureOut:
    """Enrichit un CandidatureOut avec les relations et cv_data désérialisé."""
    if c.candidat:
        out.candidat_nom    = c.candidat.nom
        out.candidat_prenom = c.candidat.prenom
        out.candidat_email  = c.candidat.email
    if c.offre:
        out.offre_titre   = c.offre.titre
        out.offre_domaine = c.offre.domaine
    mr = getattr(c, "match_result", None)
    if mr:
        # SQLAlchemy may return a list depending on how the backref is configured
        if isinstance(mr, list) and len(mr) > 0:
            out.match_score = mr[0].score_total
            out.match_niveau = mr[0].niveau
        elif not isinstance(mr, list):
            out.match_score = mr.score_total
            out.match_niveau = mr.niveau
    # Désérialisation explicite — fiable car on contrôle le type
    out.cv_data = deserialize_cv_data(c.cv_data)
    return out


@router.post("/offres/{offre_id}/postuler",
             response_model=CandidatureOut,
             status_code=status.HTTP_201_CREATED)
def postuler(
    offre_id:         UUID,
    background_tasks: BackgroundTasks,
    cv:               UploadFile = File(...),
    db:               Session    = Depends(get_db),
    current_user:     User       = Depends(require_role(Role.CANDIDAT)),
):
    candidature = CandidatureService.soumettre(db, offre_id, cv, current_user)
    background_tasks.add_task(
        parse_cv_background,
        candidature_id=candidature.id,
        filepath=candidature.cv_url_stockage,
    )
    out = CandidatureOut.model_validate(candidature)
    return _enrich(candidature, out)


@router.get("/candidatures/mes", response_model=list[CandidatureOut])
def mes_candidatures(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(require_role(Role.CANDIDAT)),
):
    items = CandidatureService.mes_candidatures(db, current_user.id)
    result = []
    for c in items:
        out = CandidatureOut.model_validate(c)
        result.append(_enrich(c, out))
    return result


@router.get("/offres/{offre_id}/candidatures", response_model=list[CandidatureOut])
def candidatures_offre(
    offre_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(require_role(Role.RECRUTEUR)),
):
    items = CandidatureService.candidatures_offre(db, offre_id, current_user)
    result = []
    for c in items:
        out = CandidatureOut.model_validate(c)
        result.append(_enrich(c, out))
    return result


@router.get("/candidatures/{candidature_id}", response_model=CandidatureOut)
def get_candidature(
    candidature_id: UUID,
    db:             Session = Depends(get_db),
    current_user:   User    = Depends(require_role(Role.RECRUTEUR)),
):
    c = db.query(Candidature).filter(Candidature.id == candidature_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature introuvable.")
    if c.offre.recruteur_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé.")
    out = CandidatureOut.model_validate(c)
    return _enrich(c, out)


@router.patch("/candidatures/{candidature_id}/statut", response_model=CandidatureOut)
def update_statut(
    candidature_id: UUID,
    data:           CandidatureStatutUpdate,
    db:             Session = Depends(get_db),
    current_user:   User    = Depends(require_role(Role.RECRUTEUR)),
):
    c = CandidatureService.update_statut(db, candidature_id, data.statut, current_user)
    out = CandidatureOut.model_validate(c)
    return _enrich(c, out)