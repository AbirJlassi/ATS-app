import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Enum as SAEnum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class StatutCandidature(str, enum.Enum):
    SOUMISE          = "SOUMISE"
    EN_COURS_EXAMEN  = "EN_COURS_EXAMEN"
    ACCEPTEE         = "ACCEPTEE"
    REFUSEE          = "REFUSEE"


class Candidature(Base):
    __tablename__ = "candidatures"

    # Contrainte : un candidat ne peut postuler qu'une fois par offre
    __table_args__ = (
        UniqueConstraint("candidat_id", "offre_id", name="uq_candidature_candidat_offre"),
    )

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statut           = Column(SAEnum(StatutCandidature), default=StatutCandidature.SOUMISE, nullable=False)
    cv_nom_fichier   = Column(String, nullable=False)   # nom original : "CV_Jean.pdf"
    cv_url_stockage  = Column(String, nullable=False)   # chemin serveur : "storage/cvs/uuid.pdf"

    candidat_id = Column(UUID(as_uuid=True), ForeignKey("users.id",  ondelete="CASCADE"), nullable=False)
    offre_id    = Column(UUID(as_uuid=True), ForeignKey("offres.id", ondelete="CASCADE"), nullable=False)

    date_postulation = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                               onupdate=lambda: datetime.now(timezone.utc))

    # Relations
    candidat = relationship("User",         backref="candidatures", foreign_keys=[candidat_id])
    offre    = relationship("OffreEmploi",  backref="candidatures")