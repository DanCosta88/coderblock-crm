"""
Database Configuration
SQLAlchemy setup for PostgreSQL on NeonDB.
Supports both per-project databases (public schema) and legacy
schema-isolated mode (POSTGRES_SCHEMA env var).
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from core.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=300,
)

_USE_SCHEMA = getattr(settings, "POSTGRES_SCHEMA", "public") != "public"


if _USE_SCHEMA:
    @event.listens_for(engine, "connect")
    def set_search_path_on_connect(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute(f"SET search_path TO {settings.POSTGRES_SCHEMA}")
        cursor.close()

    @event.listens_for(engine, "checkout")
    def set_search_path_on_checkout(dbapi_connection, connection_record, connection_proxy):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute(f"SET search_path TO {settings.POSTGRES_SCHEMA}")
            cursor.close()
        except Exception:
            connection_record.invalidate()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI endpoints to get database session."""
    db = SessionLocal()
    try:
        if _USE_SCHEMA:
            db.execute(text(f"SET search_path TO {settings.POSTGRES_SCHEMA}"))
        yield db
    finally:
        try:
            db.close()
        except Exception:
            pass
