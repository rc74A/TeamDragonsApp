from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from invalid import authrouter
from jobs import jobsrouter
from pydantic import BaseModel

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
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization", "X-User-Id"],
)
app.include_router(authrouter)
app.include_router(jobsrouter)

# ----- Classes -----

class LoginRequest(BaseModel):
    uname: str
    pwd: str

class RegisterRequest(BaseModel):
    uname: str
    pwd: str

# ----- API Endpoints ----- 

@app.get("/", tags=["root"])
async def read_root() -> dict:
    return {"message": "Backend testing"}

@app.post("/api/login")
def verify_hashed_login(creds: LoginRequest):
    """
    Authenting encrypted username / password from frontend

    Args:
        username (str): Unique account name
        password (str): Hashed password sent to the backend

    Returns:
        bool: True if password was correct, False if not

    """


    # 1.) Check if username exists in db, if not return false
    # 2.) Check if hashed password exists in db, if not return false
        #
    # 3.) If neither returned false, return true
    print("Testing")
    valid = (creds.uname == "test" and creds.pwd == "test")
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"message": "Login successful"}

@app.post("/api/register")
def register_user(creds: RegisterRequest):
    """
    Registering users to the database

    Args:
        username (str): Unique account name
        password (str): Hashed password sent to the backend

    Returns:
        bool: True if registration successful, False if not

    """
    # 1.) Check if username already exists in DB, if so return false
    # 2.) Check if password is secure enough, if not return false
    # 3.) If both checks register in the db
        # Don't forget to unencrypt using the same hashing algorithm
        # Don't forget to store the salt along with the password
    # 4.) Return true
    return True




# Merge Jasons Login Invalidation
# Merge Joel's Database 