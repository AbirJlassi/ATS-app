from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserLogin, UserOut, UserRegister, UserUpdate
from app.services.user_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Inscription.
    Le compte est créé avec le statut EN_ATTENTE — un admin devra le valider.
    """
    return AuthService.register(db, data)


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Connexion — retourne un token JWT + le rôle."""
    return AuthService.login(db, data.email, data.password)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_active_user)):
    """Retourne le profil de l'utilisateur connecté."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    """Mise à jour des informations de profil."""
    return AuthService.update_profile(db, current_user, data)
