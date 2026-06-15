from fastapi import APIRouter, Response, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import os
from jose import jwt

from database import get_db
from models import User

authrouter = APIRouter(prefix="/api/auth", tags=["authenthication"])

# ----- Token Logic -----

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-only-fallback-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  

def create_access_token(data: dict, expires_delta: timedelta | None = None):
  """Create a signed JWT access token with an expiry claim."""
  to_encode = data.copy()
  expire = datetime.now(timezone.UTC) + (
    expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
  )
  to_encode.update({"exp": expire})
  return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
  """Decode and verify a JWT access token, raising if invalid or expired."""
  return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# ----- Classes -----


class LoginRequest(BaseModel):
    """Login request body: username and hashed password."""

    uname: str
    pwd: str


class RegisterRequest(BaseModel):
    """Registration request body: username, email, and hashed password."""

    uname: str
    email: str
    pwd: str


# ----- API Endpoints -----


@authrouter.post("/logout")
def logout(response: Response):
    """
    Invalidate the user's session by clearing their HTTP-only
    authentication cookies.

    Args:
        response (Response): FastAPI response used to clear the cookie.
    """
    response.delete_cookie(key="token")
    return {"message": "Logout Successful"}


@authrouter.post("/login")
def verify_hashed_login(
    creds: LoginRequest, response: Response, db: Session = Depends(get_db)
  ):
    """
    Authenting encrypted username / password from frontend, additionally creates
    a cookie for the user to keep track of logged in state and permissions

    Args:
        creds (LoginRequest): Username (uname) and hashed password (pwd).
        db (Session): Database session.

    Returns:
        dict: A success message when the credentials are valid.

    Raises:
        HTTPException: 401 if fields are empty, the user is not found,
            or the password does not match.
    """
    if creds.uname == "" or creds.pwd == "":
        raise HTTPException(
            status_code=401, detail="Username or password cannot be empty"
        )

    query = db.query(User).filter(User.username == creds.uname)

    if query.count() == 0:
        raise HTTPException(
            status_code=401, detail=f"User '{creds.uname}' isn't registered"
        )

    if (
        query.first().username != creds.uname
        or query.first().hashed_password != creds.pwd
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user = query.first()
    if user.username != creds.uname or user.hashed_password != creds.pwd:
      raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(data={"sub": creds.uname})

    response.set_cookie(
      key="token",
      value=token,
      httponly=True,
      secure=True,
      samesite="none",
      max_age=60*60*24    # 24 hours
    )
    
    return {"message": "Login successful"}


@authrouter.post("/register")
def register_user(creds: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registering users to the database

    Args:
        creds (RegisterRequest): Username (uname), email, and hashed
            password (pwd).
        db (Session): Database session.

    Returns:
        dict: A success message when registration succeeds.

    Raises:
        HTTPException: 401 if fields are empty or the username is taken.
    """
    if creds.uname == "" or creds.pwd == "":
        raise HTTPException(
            status_code=401, detail="Username or password cannot be empty"
        )

    query = db.query(User).filter(User.username == creds.uname)

    if query.count() != 0:
        raise HTTPException(
            status_code=401, detail=f"Username {creds.uname} is already registered"
        )

    # Check if password secure enough
    # Don't forget to unencrypt using the same hashing algorithm
    # Don't forget to store the salt along with the password

    user = User(
        # Id auto assigned
        username=creds.uname,
        email=creds.email,
        hashed_password=creds.pwd,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Registration Successful"}

def validate_user_logged_in(request: Request):
  """Verify the request has a valid auth token cookie and return its payload."""
  token = request.cookies.get("token")

  if not token:
    raise HTTPException(status_code=401, detail="Not logged in, permission denied.")
  try:
    payload = decode_access_token(token)
  except Exception:
    raise HTTPException(status_code=401, detail="Login expired, please try again")
  return payload

@authrouter.get("/me")
def get_me(payload: dict = Depends(validate_user_logged_in)):
  """Return the username of the currently authenticated user."""
  return {"username": payload["sub"]}
