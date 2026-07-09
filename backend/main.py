import os
from contextlib import asynccontextmanager
from profile import profilerouter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai import airouter
from database import Base, engine
from education import educationrouter
from experience import experiencerouter
from jobs import jobsrouter
from migration_runner import run_migrations
from search import searchrouter
from skills import skillsrouter

# ----- FastAPI setup -----

origins = [
    "https://team-dragons-app.vercel.app",
    "http://localhost:5173",  # Local dev ONLY
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown work around the app's lifetime."""
    # Init
    print("Starting Up")
    # Production runs Alembic migrations (S3-016): adopts pre-Alembic
    # databases, applies schema repairs, and records the version so
    # rollbacks are possible (S3-BR-018). Dev and tests keep the fast
    # create-missing-tables path (S1-019); set RUN_DB_MIGRATIONS=1 to
    # exercise migrations locally.
    if os.getenv("PYTHON_ENV") == "production" or os.getenv("RUN_DB_MIGRATIONS") == "1":
        run_migrations()
    else:
        Base.metadata.create_all(bind=engine)

    yield

    print("Shutting Down")
    # Shutdown


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://team-dragons-app.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(jobsrouter)
app.include_router(profilerouter)
app.include_router(searchrouter)
app.include_router(experiencerouter)
app.include_router(educationrouter)
app.include_router(skillsrouter)
app.include_router(airouter)

# ----- API Endpoints -----


@app.get("/", tags=["root"])
async def read_root() -> dict:
    """Health-check root endpoint."""
    return {"message": "Backend testing"}
