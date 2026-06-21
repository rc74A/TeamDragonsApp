from fastapi import APIRouter, Depends, Header, HTTPException

searchrouter = APIRouter(prefix="/api/jobs", tags=["jobs"])

@searchrouter.put("/find_job")
def find_job(
    search_term: string,
    excluded_words: string[],
    required_words: string[]
):
