from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    last activity date. Also stores advanced information.
    """

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(200), nullable=True)
    stage: Mapped[str] = mapped_column(String(50), nullable=False, default="Saved")
    last_activity: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    deadline_state: Mapped[str] = mapped_column(
        String(50), nullable=True, default="No Deadline"
    )
    outcome_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    outcome_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


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
    owner_id: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
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
    owner_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
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


class Education(Base):
    """
    An education record on a user's profile (S2-017).

    Owned by one user (S1-BR-006). `school` and `degree` are required
    fields (S2-BR-015); the rest are optional. Ordered by `position`.
    """

    __tablename__ = "educations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    school: Mapped[str] = mapped_column(String(200), nullable=False)
    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    field_of_study: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    start_date: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    end_date: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    gpa: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )


class Skill(Base):
    """
    A skill on a user's profile (S2-018).

    Owned by one user (S1-BR-006). `name` is required; `category` and
    `proficiency` are optional (S2-BR-016). Ordered by `position`.
    """

    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    proficiency: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )


class JobStageHistory(Base):
    """
    An automated tracking log recording a job's stage changes over time (S2-009).

    Captures chronological data points to construct the job activity timeline (S2-010)
    and preserve state transition paths.
    """

    __tablename__ = "job_stage_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    old_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    new_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )


class Document(Base):
    """
    Generic document for saved documents,
    This is especially useful for saved resumes and cover letters.
    """

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)  # NEW
    content: Mapped[str] = mapped_column(Text, nullable=False)
    job_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now()
    )

    versions: Mapped[list["DocumentVersion"]] = relationship(
        "DocumentVersion",
        back_populates="document",
        order_by="DocumentVersion.version_number.desc()",
    )


class DocumentVersion(Base):
    """
    Holds the metadata, text content, and cloud storage pointers
    for every individual iteration of a document.
    """

    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )

    # Versioning metadata
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_url: Mapped[str] = mapped_column(String(2048), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)
    job_snapshot: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now()
    )

    # Relationship back to the parent document
    document: Mapped["Document"] = relationship("Document", back_populates="versions")


class Interview(Base):
    """Database model representing an interview schedule."""

    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    round_type = Column(String(64), nullable=False)
    interview_date = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
