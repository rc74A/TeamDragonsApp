from fastapi import APIRouter, Response, Cookie, HTTPException, status

authrouter = APIRouter(
  prefix="/api/auth",
  tags=["authenthication"]
)

def verify(token: str = Cookie(None)):
  '''
  Checks and verifies if the token/cookie exists for the user
  '''
  if not token:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Access denied. Unauthenticated session state"
    )
  return token

@authrouter.post("/logout")
def logout(response: Response):
  ''' 
  We invalidate the user's session state by clearing their HTTP-only authentication cookies, as seen below
  '''

  response.delete_cookie(key="token")
  return {"message": "Logout Successful"}
