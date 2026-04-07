from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Exécuté au démarrage et à l'arrêt de FastAPI.
    On préchauffe le parser ici pour que le 1er parsing soit immédiat.
    """
    # ── Démarrage ──────────────────────────────────────────────────
    try:
        from app.services.cv_parsing_service import warmup_parser
        warmup_parser()   # charge spaCy + Groq en mémoire une seule fois
    except Exception as e:
        # Ne pas faire planter l'app si le parser n'est pas installé
        import logging
        logging.getLogger("main").warning("Parser non disponible au démarrage : %s", e)

    yield  # l'app tourne ici

    # ── Arrêt ──────────────────────────────────────────────────────
    # rien à nettoyer pour l'instant


app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME}