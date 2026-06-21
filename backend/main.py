from contextlib import asynccontextmanager
from profile import profilerouter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from jobs import jobsrouter

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
    # Baseline migration approach (S1-019): create missing tables on
    # startup. Replace with real migrations (e.g. Alembic) when the
    # schema starts changing.
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

# ----- API Endpoints -----


@app.get("/", tags=["root"])
async def read_root() -> dict:
    """Health-check root endpoint."""
    return {"message": "Backend testing"}
