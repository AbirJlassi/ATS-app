from typing import List
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    PROJECT_NAME: str = "ATS Intelligent"
    API_V1_STR:   str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = ["http://localhost:5173"]

    # Base de données
    POSTGRES_DB:       str = "ats_db"
    POSTGRES_USER:     str = "ats_user"
    POSTGRES_PASSWORD: str = "ats_password"
    POSTGRES_HOST:     str = "localhost"
    POSTGRES_PORT:     str = "5432"
    DATABASE_URL:      str = "postgresql://ats_user:ats_password@localhost:5432/ats_db"

    # JWT
    SECRET_KEY:                  str = "dev_secret_key_change_in_production"
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Stockage CV
    CV_STORAGE_PATH:       str = "./storage/cvs"
    MAX_CV_SIZE_MB:        int = 5
    ALLOWED_CV_EXTENSIONS: str = ".pdf,.docx,.doc"

    @property
    def allowed_extensions(self) -> List[str]:
        return [e.strip() for e in self.ALLOWED_CV_EXTENSIONS.split(",")]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()