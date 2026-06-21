from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Job, utc_now
from schemas import JobCreate, JobOut, JobUpdate

jobsrouter = APIRouter(prefix="/api/jobs", tags=["jobs"])


def get_current_user_id(
    x_user_id: Annotated[int | None, Header()] = None,
) -> int:
    """
    Resolve the requesting user's identity.

    Placeholder until S1-011 session handling lands: the frontend sends
    an X-User-Id header. S1-015 will replace this with the session user,
    keeping ownership checks server-side (S1-BR-008) either way.

    Args:
        x_user_id (int | None): Value of the X-User-Id request header.

    Returns:
        int: The authenticated user's id.

    Raises:
        HTTPException: 401 if the header is missing or not a positive int.
    """
    if x_user_id is None or x_user_id < 1:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: missing or invalid X-User-Id header",
        )
    return x_user_id


def get_owned_job(db: Session, job_id: int, owner_id: int) -> Job:
    """
    Fetch a job by id, scoped to its owner.

    Cross-user reads return 404 rather than 403 so record existence is
    not leaked to other users (S1-BR-007).

    Args:
        db (Session): Database session.
        job_id (int): The job's primary key.
        owner_id (int): The requesting user's id.

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
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a job record owned by the requesting user (S1-BR-013).

    Args:
        payload (JobCreate): Validated job fields.
        user_id (int): Owner identity from the auth dependency.
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
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List the requesting user's job records, most recent activity first.

    Args:
        user_id (int): Owner identity from the auth dependency.
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


@jobsrouter.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve a single job record owned by the requesting user.

    Args:
        job_id (int): The job's primary key.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobOut: The job record.
    """
    return get_owned_job(db, job_id, user_id)


@jobsrouter.put("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    payload: JobUpdate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update an owned job record and refresh its last activity time.

    Args:
        job_id (int): The job's primary key.
        payload (JobUpdate): Fields to change; omitted fields keep
            their current values.
        user_id (int): Owner identity from the auth dependency.
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
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):

"""Deletes a singular job record with guarded ownership checks (S2-015)

    Args:
        job_id (int): The job's primary key
        user_id (int): Owner identity resolved securely from the header/session
        db (Session): Database Session

    Returns:
        None: Returns an empty body with a 204 Error status code on success."""
    job = get_owned_job(db, job_id, user_id)
    db.delete(job)
    db.commit()
    return None
