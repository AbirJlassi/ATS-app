from uuid import UUID
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models.benchmark_run import BenchmarkKind, BenchmarkStatut


# ── Entrée : création d'un run ────────────────────────────────────

class BenchmarkRunCreate(BaseModel):
    kind:          BenchmarkKind = BenchmarkKind.PARSER
    parser_preset: str           = "fast"
    model_name:    Optional[str] = None


# ── Sortie : résumé (liste des runs) ──────────────────────────────

class BenchmarkRunSummary(BaseModel):
    id:             UUID
    kind:           BenchmarkKind
    statut:         BenchmarkStatut

    model_name:     Optional[str]
    parser_preset:  Optional[str]
    dataset_name:   str
    dataset_size:   int

    created_at:     datetime
    started_at:     Optional[datetime]
    finished_at:    Optional[datetime]

    global_score:   Optional[float]
    field_summary:  Optional[dict[str, float]]
    error_message:  Optional[str]

    model_config = {"from_attributes": True}


# ── Sortie : détail complet (avec JSON par CV) ────────────────────

class BenchmarkRunDetail(BenchmarkRunSummary):
    detail: Optional[dict[str, Any]] = None
