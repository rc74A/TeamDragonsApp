import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def build_database_url() -> str:
    """
    Build the SQLAlchemy database URL from environment variables.

    Uses the MySQL settings from .env (DB_HOST, DB_USER, DB_PASSWORD,
    DB_NAME, DB_PORT) when DB_HOST is set. Falls back to a local SQLite
    file so the app and tests run without a MySQL server (dev/CI).

    Returns:
        str: A SQLAlchemy connection URL.
    """
    host = os.getenv("DB_HOST")
    if host:
        user = os.getenv("DB_USER", "root")
        password = os.getenv("DB_PASSWORD", "")
        name = os.getenv("DB_NAME", "ATS_JOB_SEEKER")
        port = os.getenv("DB_PORT", "3306")
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}"
    return "sqlite:///./ats_local.db"


DATABASE_URL = build_database_url()

engine = create_engine(
    DATABASE_URL,
    # SQLite needs this flag to allow FastAPI's threaded request handling.
    connect_args={"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db():
    """
    FastAPI dependency that yields a database session.

    Yields:
        Session: A SQLAlchemy session, closed after the request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
