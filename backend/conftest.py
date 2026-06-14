import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app


@pytest.fixture()
def client():
    """
    Provide a TestClient backed by a fresh in-memory database.

    Each test gets its own SQLite in-memory engine so tests are
    isolated; the app's get_db dependency is overridden to use it.

    Yields:
        TestClient: Client for the FastAPI app under test.
    """
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
