"""
Modèle de cache pour les résultats du LLM Judge.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.session  import Base


class LLMCache(Base):
    __tablename__ = "llm_cache"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cache_key   = Column(String(64), unique=True, nullable=False, index=True)
    result_json = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)