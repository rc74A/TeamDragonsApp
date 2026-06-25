from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from jobs import get_current_user_id
from models import Education
from schemas import (
    EducationCreate,
    EducationOut,
    EducationUpdate,
    ReorderRequest,
)

educationrouter = APIRouter(prefix="/api/education", tags=["education"])


def get_owned_education(db: Session, edu_id: int, owner_id: int) -> Education:
    """
    Fetch an education record by id, scoped to its owner.

    Cross-user access returns 404 so existence isn't leaked (S1-BR-007).

    Args:
        db (Session): Database session.
        edu_id (int): The record's primary key.
        owner_id (int): The requesting user's id.

    Returns:
        Education: The owned record.

    Raises:
        HTTPException: 404 if it does not exist or is not owned by the user.
    """
    record = (
        db.query(Education)
        .filter(Education.id == edu_id, Education.owner_id == owner_id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Education record not found")
    return record


def _list_owned(db: Session, owner_id: int) -> list[Education]:
    """Return the user's education records ordered by position."""
    return (
        db.query(Education)
        .filter(Education.owner_id == owner_id)
        .order_by(Education.position)
        .all()
    )


@educationrouter.post("", response_model=EducationOut, status_code=201)
def create_education(
    payload: EducationCreate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create an education record owned by the requesting user (S2-017).

    The new record is appended at the end of the user's ordering.

    Args:
        payload (EducationCreate): Validated record fields.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        EducationOut: The created record.
    """
    position = db.query(Education).filter(Education.owner_id == user_id).count()
    record = Education(
        owner_id=user_id,
        school=payload.school,
        degree=payload.degree,
        field_of_study=payload.field_of_study,
        start_date=payload.start_date,
        end_date=payload.end_date,
        gpa=payload.gpa,
        description=payload.description,
        position=position,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@educationrouter.get("", response_model=list[EducationOut])
def list_education(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List the requesting user's education records in display order (S2-017).

    Args:
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[EducationOut]: The user's records ordered by position.
    """
    return _list_owned(db, user_id)


@educationrouter.put("/reorder", response_model=list[EducationOut])
def reorder_education(
    payload: ReorderRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Reorder the user's education records (S2-BR-017).

    Defined before /{edu_id} so "reorder" isn't matched as an id. Record
    ids that the user does not own are ignored.

    Args:
        payload (ReorderRequest): Record ids in their new order.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[EducationOut]: The reordered records.
    """
    owned = {record.id: record for record in _list_owned(db, user_id)}
    position = 0
    for edu_id in payload.order:
        record = owned.get(edu_id)
        if record is not None:
            record.position = position
            position += 1
    db.commit()
    return _list_owned(db, user_id)


@educationrouter.put("/{edu_id}", response_model=EducationOut)
def update_education(
    edu_id: int,
    payload: EducationUpdate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update an owned education record (S2-017).

    Args:
        edu_id (int): The record's primary key.
        payload (EducationUpdate): Fields to change; omitted fields kept.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        EducationOut: The updated record.
    """
    record = get_owned_education(db, edu_id, user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@educationrouter.delete("/{edu_id}", status_code=204)
def delete_education(
    edu_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete an owned education record (S2-017).

    Args:
        edu_id (int): The record's primary key.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.
    """
    record = get_owned_education(db, edu_id, user_id)
    db.delete(record)
    db.commit()
