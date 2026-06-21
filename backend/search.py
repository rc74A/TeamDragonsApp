from fastapi import APIRouter, Depends, Header, HTTPException

searchrouter = APIRouter(prefix="/api/findjobs", tags=["jobs"])

@searchrouter.put("/find_job")
def find_job(
    title: string,
    company: string,
    keywords: string[],
    excluded_words: string[]
):
    print("TESTING JOB FIND")
