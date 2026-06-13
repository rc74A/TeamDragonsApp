from fastapi import APIRouter, Response, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User

authrouter = APIRouter(
  prefix="/api/auth",
  tags=["authenthication"]
)

# ----- Classes -----

class LoginRequest(BaseModel):
    uname: str
    pwd: str

class RegisterRequest(BaseModel):
    uname: str
    pwd: str

# ----- API Endpoints ----- 

@authrouter.post("/logout")
def logout(response: Response):
  ''' 
  We invalidate the user's session state by clearing their HTTP-only authentication cookies

  Args:
      response: fastAPI post request
  
  '''

  response.delete_cookie(key="token")
  return {"message": "Logout Successful"}

@authrouter.post("/login")
def verify_hashed_login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenting encrypted username / password from frontend

    Args:
        username (str): Unique account name
        password (str): Hashed password sent to the backend

    Returns:
        bool: True if password was correct, False if not

    """
    print("TEST")

    if creds.uname == "" or creds.pwd == "":
      raise HTTPException(status_code=401, detail="Username or password cannot be empty")

    query = db.query(User).filter(User.username == creds.uname)

    if query.count() == 0:
      raise HTTPException(status_code=401, detail=f"User {creds.uname} isn't registered")

    if query.first().username != creds.uname or query.first().hashed_password != creds.pwd:
      raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {"message": "Login successful"}

@authrouter.post("/register")
def register_user(creds: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registering users to the database

    Args:
        username (str): Unique account name
        password (str): Hashed password sent to the backend

    Returns:
        bool: True if registration successful, False if not

    """
    if creds.uname == "" or creds.pwd == "":
      raise HTTPException(status_code=401, detail="Username or password cannot be empty")

    query = db.query(User).filter(User.username == creds.uname)

    if query.count() != 0:
      raise HTTPException(status_code=401, detail="Username {creds.uname} is already registered")

    # Check if password secure enough    
    # Don't forget to unencrypt using the same hashing algorithm
    # Don't forget to store the salt along with the password

    user = User(
        id=query.count(),
        username=username,
        hashed_password=password
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Registration Successful"}
