"""
Script à exécuter UNE SEULE FOIS après le premier déploiement.
Crée le compte administrateur initial directement en base de données.

Utilisation :
    docker compose exec backend python scripts/seed_admin.py
"""
import sys
import os

# Permet d'importer les modules de l'app depuis ce script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.user import User, Role, Statut
from app.core.security import hash_password


ADMIN_EMAIL    = "admin@ats.com"
ADMIN_PASSWORD = "Admin1234!"   # ← à changer immédiatement après le 1er login


def seed():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            print(f"[INFO] Le compte admin '{ADMIN_EMAIL}' existe déjà. Rien à faire.")
            return

        admin = User(
            email           = ADMIN_EMAIL,
            hashed_password = hash_password(ADMIN_PASSWORD),
            role            = Role.ADMINISTRATEUR,
            statut          = Statut.ACTIF,    # actif directement, pas de validation
            nom             = "Admin",
            prenom          = "System",
        )
        db.add(admin)
        db.commit()
        print(f"[OK] Compte admin créé : {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print("[!]  Pensez à changer le mot de passe après le premier login.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
