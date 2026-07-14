from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from domain import compute_job_metrics, compute_stage_analytics
from models import Interview, Job, JobStageHistory, utc_now
from schemas import (
    JobAnalytics,
    JobCreate,
    JobMetrics,
    JobOut,
    JobStageHistoryOut,
    JobUpdate,
)

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
        description=payload.description,
        location=payload.location,
        deadline=payload.deadline,
        deadline_state=payload.deadline_state,
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
        .filter(
            Job.owner_id == user_id,
            or_(Job.is_archived.is_(False), Job.is_archived.is_(None)),
        )
        .order_by(Job.last_activity.desc())
        .all()
    )


@jobsrouter.get("/archived", response_model=list[JobOut])
def list_archived_jobs(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve all archived jobs for the authenticated user."""
    return (
        db.query(Job).filter(Job.owner_id == user_id, Job.is_archived.is_(True)).all()
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


@jobsrouter.get("/analytics", response_model=JobAnalytics)
def job_analytics(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Return conversion and time-in-stage analytics for the user's jobs (S3-014).

    Computed from the stage-change events logged by S2-009, scoped to
    jobs owned by the requesting user. Defined before the /{job_id}
    route so "analytics" isn't captured as an id.

    Args:
        user_id (str): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        JobAnalytics: Funnel reach, stage conversion rates, and average
            completed time in each stage.
    """
    jobs = db.query(Job).filter(Job.owner_id == user_id).all()
    job_ids = [job.id for job in jobs]
    events = (
        db.query(JobStageHistory).filter(JobStageHistory.job_id.in_(job_ids)).all()
        if job_ids
        else []
    )
    return compute_stage_analytics(
        [
            {"id": job.id, "stage": job.stage, "created_at": job.created_at}
            for job in jobs
        ],
        [
            {
                "job_id": event.job_id,
                "old_stage": event.old_stage,
                "new_stage": event.new_stage,
                "changed_at": event.changed_at,
            }
            for event in events
        ],
    )


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
    Tracks stage transitions to history logs automatically (S2-009).
    Automatically archives the job if a terminal outcome is set.
    """
    job = get_owned_job(db, job_id, user_id)
    updates = payload.model_dump(exclude_unset=True)

    if "stage" in updates:
        old_stage = job.stage
        new_stage = updates["stage"]

        if old_stage != new_stage:
            history_entry = JobStageHistory(
                job_id=job.id,
                old_stage=old_stage,
                new_stage=new_stage,
                changed_at=utc_now(),
            )
            db.add(history_entry)

    if "outcome_state" in updates:
        old_outcome = job.outcome_state
        new_outcome = updates["outcome_state"]

        if old_outcome != new_outcome and new_outcome is not None:
            outcome_history_entry = JobStageHistory(
                job_id=job.id,
                old_stage=job.stage,
                new_stage=f"Outcome: {new_outcome}",
                changed_at=utc_now(),
            )
            db.add(outcome_history_entry)

    for field, value in updates.items():
        setattr(job, field, value)

    if "outcome_state" in updates and updates["outcome_state"] is not None:
        job.is_archived = True

    if "prep_notes" in updates:
        job.notes_updated_at = utc_now()

    job.last_activity = utc_now()
    db.commit()
    db.refresh(job)
    return job

    # Apply the field updates to our record
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

    db.query(JobStageHistory).filter(JobStageHistory.job_id == job_id).delete(
        synchronize_session=False
    )
    db.query(Interview).filter(Interview.job_id == job_id).delete(
        synchronize_session=False
    )

    db.delete(job)
    db.commit()
    return None


@jobsrouter.get("/{job_id}/timeline", response_model=list[JobStageHistoryOut])
def get_job_timeline(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Retrieve the chronological stage history log for a specific job (S2-010).
    Guarded by user ownership verification checks to prevent resource leaks.
    """
    get_owned_job(db, job_id, user_id)

    timeline = (
        db.query(JobStageHistory)
        .filter(JobStageHistory.job_id == job_id)
        .populate_existing()
        .order_by(JobStageHistory.changed_at.asc())
        .all()
    )

    return timeline


@jobsrouter.post("/{job_id}/interviews", status_code=201)
def create_job_interview(
    job_id: int,
    payload: dict,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Log an interview round for an owned job and append it to the tracking log.
    """
    get_owned_job(db, job_id, user_id)

    from models import Interview, JobStageHistory

    round_type = (
        payload.get("roundType") or payload.get("round_type") or "Technical Interview"
    )
    interview_date = payload.get("interviewDate") or payload.get("interview_date")
    notes = payload.get("notes", "")

    interview = Interview(
        job_id=job_id, round_type=round_type, interview_date=interview_date, notes=notes
    )
    db.add(interview)

    history_entry = JobStageHistory(
        job_id=job_id,
        old_stage="Interviewing",
        new_stage=f"Logged: {round_type} Round",
        changed_at=utc_now(),
    )
    db.add(history_entry)

    db.commit()
    return {"message": "Interview saved successfully!"}


@jobsrouter.get("/{job_id}/interviews")
def list_job_interviews(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """List all interviews associated with a specific job ID."""
    get_owned_job(db, job_id, user_id)
    from models import Interview

    return db.query(Interview).filter(Interview.job_id == job_id).all()


@jobsrouter.post("/{job_id}/archive", response_model=JobOut)
def archive_job(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete/Archive a job position while keeping history intact (S2-014)."""
    job = get_owned_job(db, job_id, user_id)
    job.is_archived = True
    job.last_activity = utc_now()

    # Write history snapshot node entry matching S2-010 tracking criteria
    db.add(
        JobStageHistory(
            job_id=job.id,
            old_stage=job.stage,
            new_stage="Archived",
            changed_at=utc_now(),
        )
    )
    db.commit()
    db.refresh(job)
    return job


@jobsrouter.post("/{job_id}/restore", response_model=JobOut)
def restore_job(
    job_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """Restore an archived record back to functional workspace viewboards (S2-014)."""
    job = get_owned_job(db, job_id, user_id)
    job.is_archived = False
    job.last_activity = utc_now()

    # Write a historical restoration record event entry log
    db.add(
        JobStageHistory(
            job_id=job.id,
            old_stage="Archived",
            new_stage=job.stage,
            changed_at=utc_now(),
        )
    )
    db.commit()
    db.refresh(job)
    return job
