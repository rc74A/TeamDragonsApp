from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from auth import authrouter
from jobs import jobsrouter

# ----- FastAPI setup -----

origins = [
    "https://team-dragons-app.vercel.app",
    "http://localhost:5173", # Local dev ONLY
]

@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_origin_regex=r"https://.*\.vercel\.app",  # Preview vercel urls
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "ACCEPT"],
    allow_headers=["Content-Type", "Authorization", "X-User-Id"],
)
app.include_router(authrouter)
app.include_router(jobsrouter)

# ----- API Endpoints ----- 

@app.get("/", tags=["root"])
async def read_root() -> dict:
    return {"message": "Backend testing"}
