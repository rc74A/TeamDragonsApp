from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "https://team-dragons-app.vercel.app",
    "", # Local dev ONLY
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Preview vercel urls
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/login")
def verify_hashed_login(username: str, password: str):
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
    return True

@app.get("/api/register")
def register_user(username: str, password: str):
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
