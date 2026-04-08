import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Float, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class MatchResult(Base):
    """
    Résultat du matching entre une candidature et l'offre associée.
    Un enregistrement par candidature — mis à jour si le matching est relancé.
    """
    __tablename__ = "match_results"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Clé étrangère unique : une candidature → un seul match result
    candidature_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidatures.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # ── Scores détaillés (0-100) ───────────────────────────────
    score_total      = Column(Integer,  nullable=False)
    score_skills     = Column(Integer,  nullable=False, default=0)
    score_experience = Column(Integer,  nullable=False, default=0)
    score_semantique = Column(Float,    nullable=False, default=0.0)
    score_formation  = Column(Integer,  nullable=False, default=0)

    # ── Niveau global ──────────────────────────────────────────
    # EXCELLENT | BON | PARTIEL | FAIBLE
    niveau           = Column(String(20), nullable=False)

    # ── Détails skills ─────────────────────────────────────────
    # JSON : {"matchees": ["python", "react"], "manquantes": ["aws"]}
    skills_detail    = Column(Text, nullable=True)

    # ── Explication LLM ───────────────────────────────────────
    points_forts     = Column(Text, nullable=True)
    points_faibles   = Column(Text, nullable=True)
    recommandation   = Column(Text, nullable=True)

    computed_at      = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relation
    candidature = relationship("Candidature", backref="match_result", uselist=False)