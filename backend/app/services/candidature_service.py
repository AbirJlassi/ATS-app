import os
import uuid
from typing import List

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.candidature import Candidature, StatutCandidature
from app.models.offre import OffreEmploi, StatutOffre
from app.models.user import User


class CandidatureService:

    @staticmethod
    def _validate_file(file: UploadFile) -> None:
        """Vérifie le format et la taille du CV."""
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in settings.allowed_extensions:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Format non accepté. Formats valides : {', '.join(settings.allowed_extensions)}",
            )

    @staticmethod
    def _save_file(file: UploadFile, original_name: str) -> str:
        """Enregistre le fichier et retourne son chemin de stockage."""
        os.makedirs(settings.CV_STORAGE_PATH, exist_ok=True)

        ext       = os.path.splitext(original_name)[1].lower()
        filename  = f"{uuid.uuid4()}{ext}"
        filepath  = os.path.join(settings.CV_STORAGE_PATH, filename)

        content = file.file.read()

        # Vérification taille
        max_bytes = settings.MAX_CV_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Fichier trop volumineux. Taille maximum : {settings.MAX_CV_SIZE_MB} Mo",
            )

        with open(filepath, "wb") as f:
            f.write(content)

        return filepath

    @staticmethod
    def soumettre(db: Session, offre_id: uuid.UUID,
                  file: UploadFile, candidat: User) -> Candidature:

        # Vérifier que l'offre existe et est publiée
        offre = db.query(OffreEmploi).filter(OffreEmploi.id == offre_id).first()
        if not offre:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
        if offre.statut != StatutOffre.PUBLIEE:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cette offre n'accepte plus de candidatures.")

        # Vérifier qu'il n'a pas déjà postulé
        existing = db.query(Candidature).filter(
            Candidature.candidat_id == candidat.id,
            Candidature.offre_id    == offre_id,
        ).first()
        if existing:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "Vous avez déjà postulé à cette offre.")

        # Valider et sauvegarder le fichier
        original_name = file.filename or "cv"
        CandidatureService._validate_file(file)
        filepath = CandidatureService._save_file(file, original_name)

        candidature = Candidature(
            candidat_id     = candidat.id,
            offre_id        = offre_id,
            statut          = StatutCandidature.SOUMISE,
            cv_nom_fichier  = original_name,
            cv_url_stockage = filepath,
        )
        db.add(candidature)
        db.commit()
        db.refresh(candidature)
        return candidature

    @staticmethod
    def mes_candidatures(db: Session, candidat_id: uuid.UUID) -> List[Candidature]:
        return (
            db.query(Candidature)
            .filter(Candidature.candidat_id == candidat_id)
            .order_by(Candidature.date_postulation.desc())
            .all()
        )

    @staticmethod
    def candidatures_offre(db: Session, offre_id: uuid.UUID,
                           recruteur: User) -> List[Candidature]:
        """Liste les candidatures d'une offre — vérifie que le recruteur en est propriétaire."""
        offre = db.query(OffreEmploi).filter(OffreEmploi.id == offre_id).first()
        if not offre:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
        if offre.recruteur_id != recruteur.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé.")

        return (
            db.query(Candidature)
            .filter(Candidature.offre_id == offre_id)
            .order_by(Candidature.date_postulation.desc())
            .all()
        )

    @staticmethod
    def update_statut(db: Session, candidature_id: uuid.UUID,
                      statut: StatutCandidature, recruteur: User) -> Candidature:
        """Le recruteur met à jour le statut d'une candidature."""
        c = db.query(Candidature).filter(Candidature.id == candidature_id).first()
        if not c:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature introuvable.")
        if c.offre.recruteur_id != recruteur.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès non autorisé.")

        c.statut = statut
        db.commit()
        db.refresh(c)
        return c