from uuid import UUID
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, field_validator

from app.models.offre import StatutOffre


# ── Création ───────────────────────────────────────────────────────
class OffreCreate(BaseModel):
    titre:                 str
    description:           str
    domaine:               str
    competences_requises:  List[str]       = []
    annees_experience_min: int             = 0
    date_debut_souhaitee:  Optional[date]  = None

    @field_validator("titre", "description", "domaine")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Ce champ ne peut pas être vide.")
        return v


# ── Mise à jour (tous les champs optionnels) ───────────────────────
class OffreUpdate(BaseModel):
    titre:                 Optional[str]       = None
    description:           Optional[str]       = None
    domaine:               Optional[str]       = None
    competences_requises:  Optional[List[str]] = None
    annees_experience_min: Optional[int]       = None
    date_debut_souhaitee:  Optional[date]      = None
    statut:                Optional[StatutOffre] = None


# ── Réponse API ────────────────────────────────────────────────────
class OffreOut(BaseModel):
    id:                    UUID
    titre:                 str
    description:           str
    domaine:               str
    competences_requises:  List[str]
    annees_experience_min: int
    date_debut_souhaitee:  Optional[date]
    statut:                StatutOffre
    recruteur_id:          UUID
    created_at:            datetime

    # Infos recruteur (nom affiché sur la fiche offre)
    recruteur_nom:    Optional[str] = None
    recruteur_prenom: Optional[str] = None

    model_config = {"from_attributes": True}