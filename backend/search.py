import os

import requests
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

load_dotenv()
headers = {"X-API-Key": os.getenv("JSEARCH_API_KEY")}

searchrouter = APIRouter(prefix="/api/findjobs", tags=["jobs"])


class JobSearchRequest(BaseModel):
    """Search criteria used to look for matching job postings."""

    title: str
    employer: str
    keywords: list[str]
    excluded_words: list[str]


class FoundJob(BaseModel):
    """A job posting returned to the frontend."""

    id: str
    title: str
    employer: str
    description: str
    apply_link: str
    salary: float
    employment_type: str
    country: str
    state: str
    city: str


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
    parts = [payload.title, payload.employer] + payload.keywords
    excluded = " ".join(f"-{w}" for w in payload.excluded_words)
    unified_search = " ".join(p for p in parts if p) + " " + excluded

    response = requests.request(
        "GET",
        "https://api.openwebninja.com/jsearch/search-v2",
        params={"query": unified_search},
        headers=headers,
    )

    if not response.ok:
        return []

    data = response.json()
    jobs = data.get("data", {}).get("jobs", [])

    return [
        FoundJob(
            id=job.get("job_id", ""),
            title=job.get("job_title", ""),
            employer=job.get("employer_name", ""),
            description=job.get("job_description", ""),
            apply_link=job.get("job_apply_link", ""),
            salary=job.get("job_min_salary") or job.get("job_max_salary") or 0,
            employment_type=job.get("job_employment_type", ""),
            country=job.get("job_country") or "",
            state=job.get("job_state") or "",
            city=job.get("job_city") or "",
        )
        for job in jobs
    ]
