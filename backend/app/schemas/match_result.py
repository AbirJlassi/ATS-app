from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
import json

from pydantic import BaseModel, field_validator


class SkillsDetail(BaseModel):
    matchees:   List[str] = []
    manquantes: List[str] = []


class MatchResultOut(BaseModel):
    id:               UUID
    candidature_id:   UUID
    score_total:      int
    niveau:           str
    score_skills:     int
    score_experience: int
    score_semantique: float
    score_formation:  int
    skills_detail:    Optional[SkillsDetail] = None
    points_forts:     Optional[str]          = None
    points_faibles:   Optional[str]          = None
    recommandation:   Optional[str]          = None
    computed_at:      datetime

    model_config = {"from_attributes": True}

    @field_validator("skills_detail", mode="before")
    @classmethod
    def parse_skills_detail_str(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v