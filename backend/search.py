from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

searchrouter = APIRouter(prefix="/api/findjobs", tags=["jobs"])

class JobSearchRequest(BaseModel):
    title: str
    employer: str
    keywords: list[str]
    excluded_words: list[str]

@searchrouter.put("/find_job")
def find_job(payload: JobSearchRequest):
    print("TESTING JOB FIND")
    return []