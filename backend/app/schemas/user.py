from uuid import UUID
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import Role, Statut


# ── Inscription ────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email:       EmailStr
    password:    str
    role:        Role
    nom:         Optional[str] = None
    prenom:      Optional[str] = None
    telephone:   Optional[str] = None
    departement: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")
        return v


# ── Connexion ──────────────────────────────────────────────────────
class UserLogin(BaseModel):
    email:    EmailStr
    password: str


# ── Mise à jour profil ─────────────────────────────────────────────
class UserUpdate(BaseModel):
    nom:         Optional[str] = None
    prenom:      Optional[str] = None
    telephone:   Optional[str] = None
    departement: Optional[str] = None
    password:    Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")
        return v


# ── Réponses API ───────────────────────────────────────────────────
class UserOut(BaseModel):
    id:          UUID
    email:       EmailStr
    role:        Role
    statut:      Statut
    nom:         Optional[str]
    prenom:      Optional[str]
    telephone:   Optional[str]
    departement: Optional[str]
    created_at:  datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type:   str  = "bearer"
    role:         Role
    user_id:      UUID


# ── Mise à jour admin ──────────────────────────────────────────────
class UserAdminUpdate(BaseModel):
    statut: Optional[Statut] = None
    role:   Optional[Role]   = None
