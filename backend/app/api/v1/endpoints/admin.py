from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserAdminUpdate, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/admin/users", tags=["Administration"])


@router.get("/", response_model=list[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMINISTRATEUR)),
):
    """Liste tous les utilisateurs (paginée)."""
    return UserService.list_all(db, skip, limit)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMINISTRATEUR)),
):
    return UserService.get_by_id(db, user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: UUID,
    data: UserAdminUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMINISTRATEUR)),
):
    """Modifie le statut ou le rôle d'un utilisateur."""
    return UserService.admin_update(db, user_id, data.statut, data.role)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(Role.ADMINISTRATEUR)),
):
    UserService.delete(db, user_id, current_admin.id)
