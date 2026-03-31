from uuid import UUID
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.offre import OffreEmploi, StatutOffre
from app.models.user import User
from app.schemas.offre import OffreCreate, OffreUpdate


class OffreService:

    @staticmethod
    def create(db: Session, data: OffreCreate, recruteur: User) -> OffreEmploi:
        offre = OffreEmploi(
            **data.model_dump(),
            recruteur_id=recruteur.id,
            statut=StatutOffre.PUBLIEE,
        )
        db.add(offre)
        db.commit()
        db.refresh(offre)
        return offre

    @staticmethod
    def list_published(db: Session, domaine: Optional[str] = None) -> List[OffreEmploi]:
        """Liste les offres publiées — accessible sans authentification."""
        q = db.query(OffreEmploi).filter(OffreEmploi.statut == StatutOffre.PUBLIEE)
        if domaine:
            q = q.filter(OffreEmploi.domaine.ilike(f"%{domaine}%"))
        return q.order_by(OffreEmploi.created_at.desc()).all()

    @staticmethod
    def list_by_recruteur(db: Session, recruteur_id: UUID) -> List[OffreEmploi]:
        """Liste toutes les offres d'un recruteur (tous statuts)."""
        return (
            db.query(OffreEmploi)
            .filter(OffreEmploi.recruteur_id == recruteur_id)
            .order_by(OffreEmploi.created_at.desc())
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, offre_id: UUID) -> OffreEmploi:
        offre = db.query(OffreEmploi).filter(OffreEmploi.id == offre_id).first()
        if not offre:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
        return offre

    @staticmethod
    def update(db: Session, offre_id: UUID, data: OffreUpdate, recruteur: User) -> OffreEmploi:
        offre = OffreService.get_by_id(db, offre_id)

        # Un recruteur ne peut modifier que ses propres offres
        if offre.recruteur_id != recruteur.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous ne pouvez modifier que vos propres offres.")

        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(offre, field, value)

        db.commit()
        db.refresh(offre)
        return offre

    @staticmethod
    def delete(db: Session, offre_id: UUID, recruteur: User) -> None:
        offre = OffreService.get_by_id(db, offre_id)

        if offre.recruteur_id != recruteur.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous ne pouvez supprimer que vos propres offres.")

        db.delete(offre)
        db.commit()