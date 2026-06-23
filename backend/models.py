from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utc_now() -> datetime:
    """
    Get the current UTC time.

    Returns:
        datetime: Timezone-aware current time in UTC.
    """
    return datetime.now(UTC)


class Job(Base):
    """
    A job application record owned by a single user (S1-BR-006).

    Baseline fields follow S1-BR-014: title, company, stage, and the
    last activity date.
    """

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), nullable=False, default="Saved")
    last_activity: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )


class Profile(Base):
    """
    A user's baseline profile: identity/contact fields and a summary.

    One profile per user, isolated by owner identity (S1-BR-006). The
    baseline fields form the Sprint 1 profile (S1-BR-009); all are
    optional so a partial profile can be saved and its completion
    tracked later (S1-BR-011 / S1-023).
    """

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now, onupdate=utc_now
    )


class Experience(Base):
    """
    An employment or project entry on a user's profile (S2-016).

    Owned by one user (S1-BR-006). Entries are ordered by `position` so
    the user can reorder them (S2-BR-017).
    """

    __tablename__ = "experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    entry_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="employment"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    organization: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    start_date: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    end_date: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )
