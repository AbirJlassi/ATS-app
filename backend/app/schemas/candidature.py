from uuid import UUID
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.candidature import StatutCandidature


class CandidatureOut(BaseModel):
    id:               UUID
    statut:           StatutCandidature
    cv_nom_fichier:   str
    date_postulation: datetime
    candidat_id:      UUID
    offre_id:         UUID

    # Infos offre (pour l'affichage côté candidat)
    offre_titre:   Optional[str] = None
    offre_domaine: Optional[str] = None

    # Infos candidat (pour l'affichage côté recruteur)
    candidat_nom:    Optional[str] = None
    candidat_prenom: Optional[str] = None
    candidat_email:  Optional[str] = None

    model_config = {"from_attributes": True}


class CandidatureStatutUpdate(BaseModel):
    statut: StatutCandidature