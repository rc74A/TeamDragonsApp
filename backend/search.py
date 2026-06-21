from fastapi import APIRouter
from pydantic import BaseModel

searchrouter = APIRouter(prefix="/api/findjobs", tags=["jobs"])


class JobSearchRequest(BaseModel):
    """Search criteria used to look for matching job postings."""

    title: str
    employer: str
    keywords: list[str]
    excluded_words: list[str]


@searchrouter.put("/find_job")
def find_job(payload: JobSearchRequest):
    """
    Based on the search parameters, looks for jobs that meet the criteria,
    forwards the jobs to the frontend so user can decide whether or not to apply.

    Args:
        payload (JobSearchRequest): Search criteria, including:
        - title (str): Title for the job you're searching for.
        - employer (str) [OPTIONAL]: Jobs pertaining to a specific company.
        - keywords (list[str]): Words you do want to see in the job search.
        - excluded_words (list[str]): Words you don't want to appear in the job search.

    Returns:
        Jobs:
    """
    print("TESTING JOB FIND")
    return []
