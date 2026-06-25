from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from jobs import get_current_user_id
from models import Skill
from schemas import (
    ReorderRequest,
    SkillCreate,
    SkillOut,
    SkillUpdate,
)

skillsrouter = APIRouter(prefix="/api/skills", tags=["skills"])


def get_owned_skill(db: Session, skill_id: int, owner_id: int) -> Skill:
    """
    Fetch a skill by id, scoped to its owner.

    Cross-user access returns 404 so existence isn't leaked (S1-BR-007).

    Args:
        db (Session): Database session.
        skill_id (int): The skill's primary key.
        owner_id (int): The requesting user's id.

    Returns:
        Skill: The owned skill.

    Raises:
        HTTPException: 404 if it does not exist or is not owned by the user.
    """
    skill = (
        db.query(Skill)
        .filter(Skill.id == skill_id, Skill.owner_id == owner_id)
        .first()
    )
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


def _list_owned(db: Session, owner_id: int) -> list[Skill]:
    """Return the user's skills ordered by position."""
    return (
        db.query(Skill)
        .filter(Skill.owner_id == owner_id)
        .order_by(Skill.position)
        .all()
    )


@skillsrouter.post("", response_model=SkillOut, status_code=201)
def create_skill(
    payload: SkillCreate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a skill owned by the requesting user (S2-018).

    The new skill is appended at the end of the user's ordering.

    Args:
        payload (SkillCreate): Validated skill fields.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        SkillOut: The created skill.
    """
    position = db.query(Skill).filter(Skill.owner_id == user_id).count()
    skill = Skill(
        owner_id=user_id,
        name=payload.name,
        category=payload.category,
        proficiency=payload.proficiency,
        position=position,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@skillsrouter.get("", response_model=list[SkillOut])
def list_skills(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List the requesting user's skills in display order (S2-018).

    Args:
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[SkillOut]: The user's skills ordered by position.
    """
    return _list_owned(db, user_id)


@skillsrouter.put("/reorder", response_model=list[SkillOut])
def reorder_skills(
    payload: ReorderRequest,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Reorder the user's skills (S2-BR-017).

    Defined before /{skill_id} so "reorder" isn't matched as an id. Skill
    ids that the user does not own are ignored.

    Args:
        payload (ReorderRequest): Skill ids in their new order.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        list[SkillOut]: The reordered skills.
    """
    owned = {skill.id: skill for skill in _list_owned(db, user_id)}
    position = 0
    for skill_id in payload.order:
        skill = owned.get(skill_id)
        if skill is not None:
            skill.position = position
            position += 1
    db.commit()
    return _list_owned(db, user_id)


@skillsrouter.put("/{skill_id}", response_model=SkillOut)
def update_skill(
    skill_id: int,
    payload: SkillUpdate,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update an owned skill (S2-018).

    Args:
        skill_id (int): The skill's primary key.
        payload (SkillUpdate): Fields to change; omitted fields kept.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        SkillOut: The updated skill.
    """
    skill = get_owned_skill(db, skill_id, user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in updates.items():
        setattr(skill, field, value)
    db.commit()
    db.refresh(skill)
    return skill


@skillsrouter.delete("/{skill_id}", status_code=204)
def delete_skill(
    skill_id: int,
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete an owned skill (S2-018).

    Args:
        skill_id (int): The skill's primary key.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.
    """
    skill = get_owned_skill(db, skill_id, user_id)
    db.delete(skill)
    db.commit()
