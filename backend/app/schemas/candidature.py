from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
import json

from pydantic import BaseModel, field_validator

from app.models.candidature import StatutCandidature, ParseStatut


# ── Données CV parsées ─────────────────────────────────────────────
class CVExperience(BaseModel):
    title:       Optional[str] = None
    company:     Optional[str] = None
    location:    Optional[str] = None
    period:      Optional[str] = None
    description: Optional[str] = None


class CVEducation(BaseModel):
    degree:      Optional[str] = None
    institution: Optional[str] = None
    location:    Optional[str] = None
    period:      Optional[str] = None


class CVLanguage(BaseModel):
    language: Optional[str] = None
    level:    Optional[str] = None


class CVDataOut(BaseModel):
    full_name:      Optional[str]      = None
    email:          Optional[str]      = None
    phone:          Optional[str]      = None
    location:       Optional[str]      = None
    linkedin:       Optional[str]      = None
    github:         Optional[str]      = None
    summary:        Optional[str]      = None
    skills:         List[str]          = []
    languages:      List[CVLanguage]   = []
    experiences:    List[CVExperience] = []
    education:      List[CVEducation]  = []
    certifications: List[str]          = []


# ── Réponse candidature ────────────────────────────────────────────
class CandidatureOut(BaseModel):
    id:               UUID
    statut:           StatutCandidature
    parse_statut:     ParseStatut
    cv_nom_fichier:   str
    date_postulation: datetime
    candidat_id:      UUID
    offre_id:         UUID

    offre_titre:   Optional[str] = None
    offre_domaine: Optional[str] = None

    candidat_nom:    Optional[str] = None
    candidat_prenom: Optional[str] = None
    candidat_email:  Optional[str] = None

    match_score:  Optional[int] = None
    match_niveau: Optional[str] = None

    cv_data: Optional[CVDataOut] = None

    @field_validator("cv_data", mode="before")
    @classmethod
    def parse_cv_data_str(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    model_config = {"from_attributes": True}


class CandidatureStatutUpdate(BaseModel):
    statut: StatutCandidature


# ── Helper de désérialisation ──────────────────────────────────────
def deserialize_cv_data(raw: Any) -> Optional[CVDataOut]:
    """
    Convertit le JSON string stocké en base vers CVDataOut.
    Utilisé explicitement dans chaque endpoint — pas de magic validator.
    """
    if not raw:
        return None
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
            return CVDataOut(**data)
        except Exception:
            return None
    if isinstance(raw, dict):
        try:
            return CVDataOut(**raw)
        except Exception:
            return None
    return None