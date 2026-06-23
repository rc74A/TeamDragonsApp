from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from jobs import get_current_user_id
from models import Experience
from schemas import (
    ExperienceCreate,
    ExperienceOut,
    ExperienceUpdate,
    ReorderRequest,
)

experiencerouter = APIRouter(prefix="/api/experience", tags=["experience"])


def get_owned_experience(db: Session, exp_id: int, owner_id: int) -> Experience:
    """
    Fetch an experience entry by id, scoped to its owner.

    Cross-user access returns 404 so existence isn't leaked (S1-BR-007).

    Args:
        db (Session): Database session.
        exp_id (int): The entry's primary key.
        owner_id (int): The requesting user's id.

    Returns:
        Experience: The owned entry.

    Raises:
        HTTPException: 404 if it does not exist or is not owned by the user.
    """
    entry = (
        db.query(Experience)
        .filter(Experience.id == exp_id, Experience.owner_id == owner_id)
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Experience entry not found")
    return entry


def _list_owned(db: Session, owner_id: int) -> list[Experience]:
    """Return the user's entries ordered by position."""
    return (
        db.query(Experience)
        .filter(Experience.owner_id == owner_id)
        .order_by(Experience.position)
        .all()
    )


@experiencerouter.post("", response_model=ExperienceOut, status_code=201)
def create_experience(
    payload: ExperienceCreate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create an experience entry owned by the requesting user (S2-016).

    The new entry is appended at the end of the user's ordering.

    Args:
        payload (ExperienceCreate): Validated entry fields.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        ExperienceOut: The created entry.
    """
    position = db.query(Experience).filter(Experience.owner_id == user_id).count()
    entry = Experience(
        owner_id=user_id,
        entry_type=payload.entry_type,
        title=payload.title,
        organization=payload.organization,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description=payload.description,
        position=position,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@experiencerouter.get("", response_model=list[ExperienceOut])
def list_experience(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List the requesting user's experience entries in display order (S2-016).

    Args:
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[ExperienceOut]: The user's entries ordered by position.
    """
    return _list_owned(db, user_id)


@experiencerouter.put("/reorder", response_model=list[ExperienceOut])
def reorder_experience(
    payload: ReorderRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Reorder the user's experience entries (S2-BR-017).

    Defined before /{exp_id} so "reorder" isn't matched as an id. Entry
    ids that the user does not own are ignored.

    Args:
        payload (ReorderRequest): Entry ids in their new order.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[ExperienceOut]: The reordered entries.
    """
    owned = {entry.id: entry for entry in _list_owned(db, user_id)}
    position = 0
    for exp_id in payload.order:
        entry = owned.get(exp_id)
        if entry is not None:
            entry.position = position
            position += 1
    db.commit()
    return _list_owned(db, user_id)


@experiencerouter.put("/{exp_id}", response_model=ExperienceOut)
def update_experience(
    exp_id: int,
    payload: ExperienceUpdate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update an owned experience entry (S2-016).

    Args:
        exp_id (int): The entry's primary key.
        payload (ExperienceUpdate): Fields to change; omitted fields kept.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        ExperienceOut: The updated entry.
    """
    entry = get_owned_experience(db, exp_id, user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@experiencerouter.delete("/{exp_id}", status_code=204)
def delete_experience(
    exp_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete an owned experience entry (S2-016).

    Args:
        exp_id (int): The entry's primary key.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.
    """
    entry = get_owned_experience(db, exp_id, user_id)
    db.delete(entry)
    db.commit()
