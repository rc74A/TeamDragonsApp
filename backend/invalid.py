from fastapi import APIRouter, Response

authrouter = APIRouter(
  prefix="/api/auth",
  tags=["authenthication"]
)

@authrouter.post("/logout")
def logout(response: Response):
  ''' 
  We invalidate the user's session state by clearing their HTTP-only authentication cookies, as seen below
  '''

  response.delete_cookie(key="token")
  return {"message": "Logout Successful"}
