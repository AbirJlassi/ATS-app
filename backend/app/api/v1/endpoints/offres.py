from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_role
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.offre import OffreCreate, OffreOut, OffreUpdate
from app.services.offre_service import OffreService

router = APIRouter(prefix="/offres", tags=["Offres"])


@router.post("/", response_model=OffreOut, status_code=status.HTTP_201_CREATED)
def create_offre(
    data: OffreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Crée une nouvelle offre — Recruteur uniquement."""
    return OffreService.create(db, data, current_user)


@router.get("/", response_model=list[OffreOut])
def list_offres(
    domaine: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Liste les offres publiées — accessible sans authentification."""
    offres = OffreService.list_published(db, domaine)
    # Enrichir avec les infos du recruteur
    result = []
    for o in offres:
        out = OffreOut.model_validate(o)
        if o.recruteur:
            out.recruteur_nom    = o.recruteur.nom
            out.recruteur_prenom = o.recruteur.prenom
        result.append(out)
    return result


@router.get("/mes-offres", response_model=list[OffreOut])
def mes_offres(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Liste toutes les offres du recruteur connecté."""
    return OffreService.list_by_recruteur(db, current_user.id)


@router.get("/{offre_id}", response_model=OffreOut)
def get_offre(
    offre_id: UUID,
    db: Session = Depends(get_db),
):
    """Détail d'une offre — accessible sans authentification."""
    offre = OffreService.get_by_id(db, offre_id)
    out = OffreOut.model_validate(offre)
    if offre.recruteur:
        out.recruteur_nom    = offre.recruteur.nom
        out.recruteur_prenom = offre.recruteur.prenom
    return out


@router.patch("/{offre_id}", response_model=OffreOut)
def update_offre(
    offre_id: UUID,
    data: OffreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Modifie une offre — Recruteur propriétaire uniquement."""
    return OffreService.update(db, offre_id, data, current_user)


@router.delete("/{offre_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offre(
    offre_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(Role.RECRUTEUR)),
):
    """Supprime une offre — Recruteur propriétaire uniquement."""
    OffreService.delete(db, offre_id, current_user)