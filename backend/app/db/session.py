from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # vérifie la connexion avant chaque requête
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Classe de base dont héritent tous les modèles SQLAlchemy."""
    pass


def get_db():
    """
    Dépendance FastAPI : crée une session DB par requête HTTP
    et la ferme automatiquement à la fin, même en cas d'erreur.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
