"""
Route de téléchargement des CVs.
Accessible uniquement aux recruteurs et administrateurs.
"""
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models.candidature import Candidature
from app.models.user import Role, User

router = APIRouter(prefix="/cvs", tags=["Fichiers"])


@router.get("/download/{candidature_id}")
def download_cv(
    candidature_id: str,
    db:             Session = Depends(get_db),
    _:              User    = Depends(require_role(Role.RECRUTEUR, Role.ADMINISTRATEUR)),
):
    """
    Télécharge le CV d'une candidature par son ID.
    Le recruteur reçoit le fichier avec le nom original du candidat.
    """
    from uuid import UUID
    try:
        cand_uuid = UUID(candidature_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ID invalide.")

    c = db.query(Candidature).filter(Candidature.id == cand_uuid).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Candidature introuvable.")

    filepath = Path(c.cv_url_stockage)
    if not filepath.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fichier CV introuvable sur le serveur.")

    return FileResponse(
        path=str(filepath),
        filename=c.cv_nom_fichier,          # nom original du candidat
        media_type="application/octet-stream",
    )