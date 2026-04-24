import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class BenchmarkKind(str, enum.Enum):
    PARSER   = "PARSER"       # évaluation du parser de CV
    MATCHING = "MATCHING"     # évaluation du matching (à venir)


class BenchmarkStatut(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"   # run créé, pas encore démarré
    EN_COURS   = "EN_COURS"     # thread d'exécution actif
    TERMINE    = "TERMINE"      # scores disponibles
    ECHEC      = "ECHEC"        # erreur pendant l'exécution


class BenchmarkRun(Base):
    """
    Un run de benchmark = une exécution du parser/matching sur l'ensemble
    du dataset de vérité terrain.

    Stockage hybride :
      - colonnes dénormalisées (global_score, field_summary) pour l'affichage
        en liste et les filtres SQL ;
      - colonne JSONB `detail` pour le résultat complet par CV.
    """
    __tablename__ = "benchmark_runs"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind         = Column(SAEnum(BenchmarkKind),   default=BenchmarkKind.PARSER,      nullable=False)
    statut       = Column(SAEnum(BenchmarkStatut), default=BenchmarkStatut.EN_ATTENTE, nullable=False)

    # ── Configuration du run ─────────────────────────────────────
    model_name    = Column(String,  nullable=True)   # ex. "llama-3.1-8b-instant"
    parser_preset = Column(String,  nullable=True)   # ex. "fast", "accurate"
    dataset_name  = Column(String,  nullable=False)  # ex. "parser_ground_truth.json"
    dataset_size  = Column(Integer, nullable=False)

    # ── Dates ────────────────────────────────────────────────────
    created_at   = Column(DateTime(timezone=True),
                          default=lambda: datetime.now(timezone.utc), nullable=False)
    started_at   = Column(DateTime(timezone=True), nullable=True)
    finished_at  = Column(DateTime(timezone=True), nullable=True)

    # ── Résultats (dénormalisés pour requêtage rapide) ───────────
    global_score  = Column(Float,  nullable=True)
    field_summary = Column(JSONB,  nullable=True)   # {"email": 0.95, "skills": 0.88, ...}

    # ── Résultat complet (JSONB, exploitable pour le rapport) ────
    detail        = Column(JSONB,  nullable=True)

    # ── Erreurs ──────────────────────────────────────────────────
    error_message = Column(Text, nullable=True)

    # ── Traçabilité ──────────────────────────────────────────────
    triggered_by  = Column(UUID(as_uuid=True),
                           ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True)
    triggered_by_user = relationship("User", foreign_keys=[triggered_by])
