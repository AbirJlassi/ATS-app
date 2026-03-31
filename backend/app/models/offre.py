import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Date, DateTime, Enum as SAEnum, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class StatutOffre(str, enum.Enum):
    BROUILLON = "BROUILLON"
    PUBLIEE   = "PUBLIEE"
    FERMEE    = "FERMEE"


class OffreEmploi(Base):
    __tablename__ = "offres"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre                = Column(String, nullable=False)
    description          = Column(String, nullable=False)
    domaine              = Column(String, nullable=False)
    competences_requises = Column(ARRAY(String), nullable=False, default=list)
    annees_experience_min = Column(Integer, default=0)
    date_debut_souhaitee  = Column(Date, nullable=True)
    statut               = Column(SAEnum(StatutOffre), default=StatutOffre.PUBLIEE, nullable=False)

    # Clé étrangère vers le recruteur qui a créé l'offre
    recruteur_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relation vers l'utilisateur recruteur
    recruteur = relationship("User", backref="offres")