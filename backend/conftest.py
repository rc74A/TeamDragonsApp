import os

# dummy variables
os.environ["SUPABASE_URL"] = "https://supabase.co"
os.environ["SUPABASE_KEY"] = "mock-key-placeholder"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app


@pytest.fixture()
def client(monkeypatch):
    """
    Provide a TestClient backed by a fresh in-memory database.

    Each test gets its own SQLite in-memory engine so tests are
    isolated; the app's get_db dependency is overridden to use it.
    The migration-gate env vars are cleared so the app lifespan always
    takes the create_all path here — pytest must never run Alembic
    against a real database, whatever the developer's shell has set.

    Yields:
        TestClient: Client for the FastAPI app under test.
    """
    monkeypatch.delenv("RUN_DB_MIGRATIONS", raising=False)
    monkeypatch.delenv("PYTHON_ENV", raising=False)
    monkeypatch.delenv("DB_HOST", raising=False)

    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(  # noqa: N806  (session factory, PascalCase by convention)
        bind=test_engine, autoflush=False, autocommit=False
    )
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
