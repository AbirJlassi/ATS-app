import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, String, Enum as SAEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Role(str, enum.Enum):
    CANDIDAT       = "CANDIDAT"
    RECRUTEUR      = "RECRUTEUR"
    ADMINISTRATEUR = "ADMINISTRATEUR"


class Statut(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    ACTIF      = "ACTIF"
    SUSPENDU   = "SUSPENDU"


class User(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email            = Column(String, unique=True, index=True, nullable=False)
    hashed_password  = Column(String, nullable=False)
    role             = Column(SAEnum(Role),   nullable=False)
    statut           = Column(SAEnum(Statut), default=Statut.EN_ATTENTE, nullable=False)

    # Champs de profil communs
    nom          = Column(String, nullable=True)
    prenom       = Column(String, nullable=True)
    telephone    = Column(String, nullable=True)
    departement  = Column(String, nullable=True)   # spécifique aux recruteurs

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
