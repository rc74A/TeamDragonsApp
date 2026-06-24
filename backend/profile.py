from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from jobs import get_current_user_id
from models import Profile, utc_now
from schemas import ProfileOut, ProfileUpdate

# Identity comes from get_current_user_id (the X-User-Id header placeholder
# shared with the jobs router). S1-015 will swap it for the session user;
# the owner-scoped logic below does not change.
profilerouter = APIRouter(prefix="/api/profile", tags=["profile"])


def empty_profile(owner_id: int) -> Profile:
    """
    Build a transient, unsaved profile with baseline defaults.

    Used to give reads a consistent shape before the user has saved
    anything. It is not added to the session, so GET has no side effects.

    Args:
        owner_id (int): The requesting user's id.

    Returns:
        Profile: An unsaved profile with empty baseline fields.
    """
    return Profile(
        owner_id=owner_id,
        full_name="",
        email="",
        phone="",
        location="",
        summary="",
        # Naive UTC to match how the DateTime column round-trips from the
        # database, so transient and persisted profiles serialize alike.
        updated_at=utc_now().replace(tzinfo=None),
    )


@profilerouter.get("", response_model=ProfileOut)
def get_profile(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get the requesting user's baseline profile (S1-BR-006).

    Args:
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        ProfileOut: The user's profile, or an empty baseline if unsaved.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    return profile if profile is not None else empty_profile(user_id)


@profilerouter.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create or update the requesting user's profile (S1-BR-009/010).

    Upserts the single profile row scoped to the requesting user, so a
    user can only ever read or write their own profile (S1-BR-007/008).
    Omitted fields keep their current value.

    Args:
        payload (ProfileUpdate): Fields to set; omitted fields are kept.
        user_id (int): Owner identity from the auth dependency.
        db (Session): Database session.

    Returns:
        ProfileOut: The saved profile.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    if profile is None:
        profile = Profile(owner_id=user_id)
        db.add(profile)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is not None:
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
