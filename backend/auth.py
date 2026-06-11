from fastapi import APIRouter, Response
from pydantic import BaseModel

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
def verify_hashed_login(creds: LoginRequest):
    """
    Authenting encrypted username / password from frontend

    Args:
        username (str): Unique account name
        password (str): Hashed password sent to the backend

    Returns:
        bool: True if password was correct, False if not

    """

    if creds.uname == "" or creds.pwd == "":
      raise HTTPException(status_code=401, detail="Username or password cannot be empty")

    query = db.query(User).filter(User.username == creds.uname)

    if query.count() != 0:
      raise HTTPException(status_code=401, detail="User {creds.uname} isn't registered")

    if query.uname != uname or query.hashed_password != password:
      raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {"message": "Login successful"}

@authrouter.post("/register")
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
