from fastapi import APIRouter
from app.api.v1.endpoints import auth, admin, offres, candidatures, files, matching, benchmark

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(offres.router)
api_router.include_router(candidatures.router)
api_router.include_router(files.router)
api_router.include_router(matching.router)
api_router.include_router(benchmark.router)
