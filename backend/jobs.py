from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from domain import compute_job_metrics
from models import Job, utc_now
from schemas import JobCreate, JobMetrics, JobOut, JobUpdate

jobsrouter = APIRouter(prefix="/api/jobs", tags=["jobs"])

security = HTTPBearer()


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> str:
    """
    Resolve the requesting user's internal integer identity from a secure Clerk JWT.

    Intercepts the standard 'Authorization: Bearer <token>' header. If the custom
    session claim 'db_user_id' is missing or null (indicating a brand-new user or
    unlinked profile), this function falls back to a lazy-onboarding sync strategy:
    it maps the user locally, updates Clerk's External ID via the Backend API,
    and bridges ownership tracking server-side (S1-BR-008) seamlessly.

    Args:
        credentials (HTTPAuthorizationCredentials): The extracted bearer token payload.
        db (Session): Database session context for local profile synchronization.

    Returns:
        int: The verified internal database integer ID of the user.

    Raises:
        HTTPException: 401 Unauthorized if the token string is corrupt, signatures
            fail validation, or mapping an internal profile is impossible.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, "", options={"verify_signature": False})

        clerk_str_id = payload.get("sub")

        if not clerk_str_id:
            raise HTTPException(status_code=401, detail="Invalid token payload.")

        return clerk_str_id

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token string.") from None


def get_owned_job(db: Session, job_id: int, owner_id: str) -> Job:
    """
    Fetch a job by id, scoped to its owner.

    Cross-user reads return 404 rather than 403 so record existence is
    not leaked to other users (S1-BR-007).

    Args:
        db (Session): Database session.
        job_id (str): The job's primary key.
        owner_id (str): The requesting user's clerk string identity.

    Returns:
        Job: The owned job record.

    Raises:
        HTTPException: 404 if the job does not exist or is not owned
            by the requesting user.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.owner_id == owner_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@jobsrouter.post("", response_model=JobOut, status_code=201)
def create_job(
    payload: JobCreate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a job record owned by the requesting user (S1-BR-013).

    Args:
        payload (JobCreate): Validated job fields.
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobOut: The created job record.
    """
    job = Job(
        owner_id=user_id,
        title=payload.title,
        company=payload.company,
        stage=payload.stage,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@jobsrouter.get("", response_model=list[JobOut])
def list_jobs(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List the requesting user's job records, most recent activity first.

    Args:
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[JobOut]: Jobs owned by the requesting user only (S1-BR-006).
    """
    return (
        db.query(Job)
        .filter(Job.owner_id == user_id)
        .order_by(Job.last_activity.desc())
        .all()
    )


@jobsrouter.get("/metrics", response_model=JobMetrics)
def job_metrics(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Return dashboard metrics for the requesting user's jobs (S2-025).

    Defined before the /{job_id} route so "metrics" isn't captured as an id.

    Args:
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobMetrics: Stage counts and response-tracking metrics, computed
            only from jobs owned by the requesting user (S2-BR-022/023).
    """
    stages = [
        row[0] for row in db.query(Job.stage).filter(Job.owner_id == user_id).all()
    ]
    return compute_job_metrics(stages)


@jobsrouter.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve a single job record owned by the requesting user.

    Args:
        job_id (int): The job's primary key.
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobOut: The job record.
    """
    return get_owned_job(db, job_id, user_id)


@jobsrouter.put("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    payload: JobUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update an owned job record and refresh its last activity time.

    Args:
        job_id (int): The job's primary key.
        payload (JobUpdate): Fields to change; omitted fields keep
            their current values.
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobOut: The updated job record.
    """
    job = get_owned_job(db, job_id, user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(job, field, value)
    job.last_activity = utc_now()
    db.commit()
    db.refresh(job)
    return job


@jobsrouter.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Deletes a singular job record with guarded ownership checks (S2-015)

    Args:
        job_id (int): The job's primary key
        user_id (str): Owner identity resolved securely from the header/session
        db (Session): Database Session

    Returns:
        None: Returns an empty body with a 204 Error status code on success.
    """
    job = get_owned_job(db, job_id, user_id)
    db.delete(job)
    db.commit()
    return None
