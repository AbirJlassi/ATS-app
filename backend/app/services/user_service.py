from uuid import UUID
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, Role, Statut
from app.schemas.user import UserRegister, UserUpdate


class AuthService:
    """Logique métier liée à l'authentification."""

    @staticmethod
    def register(db: Session, data: UserRegister) -> User:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cet email est déjà utilisé.",
            )
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            role=data.role,
            statut=Statut.EN_ATTENTE,
            nom=data.nom,
            prenom=data.prenom,
            telephone=data.telephone,
            departement=data.departement,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def login(db: Session, email: str, password: str) -> dict:
        user = db.query(User).filter(User.email == email).first()

        # Message générique intentionnel : ne pas révéler si l'email existe
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants incorrects.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if user.statut == Statut.EN_ATTENTE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre compte est en attente de validation par un administrateur.",
            )
        if user.statut == Statut.SUSPENDU:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre compte a été suspendu. Contactez l'administrateur.",
            )
        return {
            "access_token": create_access_token(user.id),
            "token_type":   "bearer",
            "role":         user.role,
            "user_id":      user.id,
        }

    @staticmethod
    def update_profile(db: Session, user: User, data: UserUpdate) -> User:
        updates = data.model_dump(exclude_unset=True)
        if "password" in updates:
            updates["hashed_password"] = hash_password(updates.pop("password"))
        for field, value in updates.items():
            setattr(user, field, value)
        db.commit()
        db.refresh(user)
        return user


class UserService:
    """Logique métier liée à la gestion des utilisateurs (admin)."""

    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable.")
        return user

    @staticmethod
    def list_all(db: Session, skip: int = 0, limit: int = 50) -> List[User]:
        return db.query(User).offset(skip).limit(limit).all()

    @staticmethod
    def admin_update(
        db: Session,
        user_id: UUID,
        statut: Optional[Statut] = None,
        role: Optional[Role] = None,
    ) -> User:
        user = UserService.get_by_id(db, user_id)
        if statut is not None:
            user.statut = statut
        if role is not None:
            user.role = role
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete(db: Session, user_id: UUID, current_user_id: UUID) -> None:
        if user_id == current_user_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Vous ne pouvez pas supprimer votre propre compte.",
            )
        user = UserService.get_by_id(db, user_id)
        db.delete(user)
        db.commit()
