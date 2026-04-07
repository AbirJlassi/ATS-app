"""
Service de parsing CV — wrapper autour du CVParser.

Fix critique (performance) :
    FastAPI BackgroundTasks exécute les tâches synchrones dans le même
    thread event loop qu'uvicorn. Cela bloque toutes les requêtes entrantes
    pendant le parsing (spaCy + appel Groq ~20-60s) → le polling frontend
    se retrouve en file d'attente → apparence de "rien ne se passe".

    Solution : la tâche de fond est maintenant une coroutine async qui
    délègue le travail CPU/IO-bound dans un ThreadPoolExecutor séparé
    via asyncio.run_in_executor(). L'event loop uvicorn reste libre de
    traiter les requêtes de polling pendant le parsing.

Singleton :
    Le parser est instancié UNE SEULE FOIS au démarrage pour éviter
    le cold start spaCy/Groq à chaque requête.
"""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.candidature import Candidature, ParseStatut

logger = logging.getLogger("cv_parsing_service")

# Thread pool dédié au parsing CV (tâches CPU/IO intensives)
# Limité à 2 workers pour ne pas saturer le CPU si plusieurs CVs arrivent en même temps
_PARSE_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cv_parser")

# ── Singleton du parser ───────────────────────────────────────────
# Instancié une seule fois au chargement du module.
# spaCy et Groq sont chargés ici → 0 overhead au moment du parsing.
_parser = None

def _get_parser():
    """Retourne le parser singleton, l'instancie si nécessaire."""
    global _parser
    if _parser is None:
        try:
            from app.services.cv_parser import CVParserFactory
            _parser = CVParserFactory.fast()
            logger.info("CVParser initialisé (singleton)")
        except ImportError as e:
            logger.error(
                "Dépendances du parser manquantes : %s\n"
                "Installez : pip install groq spacy pdfminer.six python-docx "
                "pillow pytesseract langdetect", e
            )
    return _parser


def warmup_parser() -> None:
    """
    Préchauffe le parser au démarrage de FastAPI.
    À appeler dans le lifespan de main.py pour que le 1er parsing
    soit aussi rapide que les suivants.
    """
    logger.info("Préchauffage du CVParser...")
    _get_parser()
    logger.info("CVParser prêt.")


def _run_parse_sync(candidature_id: UUID, filepath: str) -> None:
    """
    Logique synchrone du parsing — s'exécute dans le ThreadPoolExecutor.
    Ouvre sa propre session DB (thread-safe, pool SQLAlchemy).
    NE PAS appeler directement depuis le code async.
    """
    db: Session = SessionLocal()
    try:
        candidature = db.query(Candidature).filter(
            Candidature.id == candidature_id
        ).first()

        if not candidature:
            logger.error("Candidature %s introuvable pour parsing", candidature_id)
            return

        candidature.parse_statut = ParseStatut.EN_COURS
        db.commit()

        parser = _get_parser()
        if parser is None:
            candidature.parse_statut = ParseStatut.ECHEC
            db.commit()
            return

        try:
            cv_data     = parser.parse(filepath)
            json_result = cv_data.to_json(include_meta=False)

            candidature.cv_data      = json_result
            candidature.parse_statut = ParseStatut.TERMINE
            db.commit()

            logger.info(
                "Parsing terminé — candidature %s : %d compétences, %d expériences",
                candidature_id, len(cv_data.skills), len(cv_data.experiences),
            )

        except Exception as e:
            logger.error("Erreur parsing CV %s : %s", filepath, e, exc_info=True)
            candidature.parse_statut = ParseStatut.ECHEC
            db.commit()

    except Exception as e:
        logger.error("Erreur inattendue dans _run_parse_sync : %s", e, exc_info=True)
        db.rollback()
    finally:
        db.close()


async def parse_cv_background(candidature_id: UUID, filepath: str) -> None:
    """
    Tâche de fond ASYNC — appelée par FastAPI BackgroundTasks.

    Délègue le travail CPU/IO-bound (_run_parse_sync) dans le ThreadPoolExecutor
    dédié, libérant l'event loop uvicorn pour continuer à traiter les requêtes
    de polling du frontend pendant toute la durée du parsing.

    Sans ce mécanisme :
        BackgroundTasks exécute la fonction synchrone dans le même thread
        event loop → uvicorn bloqué → les requêtes GET /candidatures/{id}
        s'accumulent en file d'attente → apparence de freeze total.
    """
    loop = asyncio.get_event_loop()
    logger.info(
        "[async] Parsing CV lancé dans le thread pool — candidature %s",
        candidature_id,
    )
    await loop.run_in_executor(
        _PARSE_EXECUTOR,
        _run_parse_sync,
        candidature_id,
        filepath,
    )
    logger.info(
        "[async] Parsing CV terminé — candidature %s", candidature_id
    )