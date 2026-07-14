import os
from contextlib import asynccontextmanager
from profile import profilerouter

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai import airouter
from database import Base, engine
from documents import documentrouter
from education import educationrouter
from experience import experiencerouter
from jobs import jobsrouter
from migration_runner import run_migrations
from observability import logger, setup_observability
from search import searchrouter
from skills import skillsrouter

# ----- FastAPI setup -----

load_dotenv()

origins = [
    "https://team-dragons-app.vercel.app",
    "http://localhost:5173",  # Local dev ONLY
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown work around the app's lifetime."""
    # Init
    logger.info("Starting up")
    # Production runs Alembic migrations (S3-016): adopts pre-Alembic
    # databases, applies schema repairs, and records the version so
    # rollbacks are possible (S3-BR-018). DB_HOST set means production
    # MySQL (same convention database.py uses), so the gate can't be
    # missed by forgetting PYTHON_ENV on Render. Dev and tests keep the
    # fast create-missing-tables path (S1-019); set RUN_DB_MIGRATIONS=1
    # to exercise migrations locally.
    use_migrations = (
        os.getenv("DB_HOST")
        or os.getenv("PYTHON_ENV") == "production"
        or os.getenv("RUN_DB_MIGRATIONS") == "1"
    )
    db_path = "alembic migrations" if use_migrations else "create_all (dev fallback)"
    logger.info("DB startup: %s", db_path)
    if use_migrations:
        run_migrations()
        engine.dispose()
    else:
        Base.metadata.create_all(bind=engine)
        engine.dispose()

    yield

    logger.info("Shutting down")
    # Shutdown


app = FastAPI(lifespan=lifespan)
# S3-018: request ids + structured logs + clean 500s. Added before CORS
# so CORS stays outermost and error responses keep their CORS headers.
setup_observability(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://team-dragons-app.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Let cross-origin frontend code read the request id (S3-018).
    expose_headers=["X-Request-ID"],
)
app.include_router(jobsrouter)
app.include_router(profilerouter)
app.include_router(searchrouter)
app.include_router(experiencerouter)
app.include_router(educationrouter)
app.include_router(skillsrouter)
app.include_router(airouter)
app.include_router(documentrouter)

# ----- API Endpoints -----


@app.get("/", tags=["root"])
async def read_root() -> dict:
    """Health-check root endpoint."""
    return {"message": "Backend testing"}


@app.get("/version", tags=["root"])
async def read_version() -> dict:
    """
    Report the deployed commit for the CD health check (S3-017).

    Render injects RENDER_GIT_COMMIT into the environment; the deploy
    workflow compares it against the commit it just verified so a
    green run proves the new build is actually live, not a stale one.

    Returns:
        dict: The deployed commit sha, or "unknown" outside Render.
    """
    return {"commit": os.getenv("RENDER_GIT_COMMIT", "unknown")}
