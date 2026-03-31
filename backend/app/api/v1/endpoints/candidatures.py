from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.candidature import StatutCandidature
from app.models.user import Role, User
from app.schemas.candidature import CandidatureOut, CandidatureStatutUpdate
from app.services.candidature_service import CandidatureService

router = APIRouter(tags=["Candidatures"])


@router.post("/offres/{offre_id}/postuler",
             response_model=CandidatureOut,
             status_code=status.HTTP_201_CREATED)
def postuler(
    offre_id: UUID,
    cv: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.CANDIDAT)),
):
    """Soumet une candidature avec CV pour une offre donnée."""
    return CandidatureService.soumettre(db, offre_id, cv, current_user)


@router.get("/candidatures/mes", response_model=list[CandidatureOut])
def mes_candidatures(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.CANDIDAT)),
):
    """Retourne toutes les candidatures du candidat connecté."""
    items = CandidatureService.mes_candidatures(db, current_user.id)
    result = []
    for c in items:
        out = CandidatureOut.model_validate(c)
        if c.offre:
            out.offre_titre  = c.offre.titre
            out.offre_domaine = c.offre.domaine
        result.append(out)
    return result


@router.get("/offres/{offre_id}/candidatures", response_model=list[CandidatureOut])
def candidatures_offre(
    offre_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Liste les candidatures reçues pour une offre — Recruteur propriétaire."""
    items = CandidatureService.candidatures_offre(db, offre_id, current_user)
    result = []
    for c in items:
        out = CandidatureOut.model_validate(c)
        if c.candidat:
            out.candidat_nom    = c.candidat.nom
            out.candidat_prenom = c.candidat.prenom
            out.candidat_email  = c.candidat.email
        result.append(out)
    return result


@router.patch("/candidatures/{candidature_id}/statut", response_model=CandidatureOut)
def update_statut(
    candidature_id: UUID,
    data: CandidatureStatutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Met à jour le statut d'une candidature — Recruteur propriétaire de l'offre."""
    return CandidatureService.update_statut(db, candidature_id, data.statut, current_user)