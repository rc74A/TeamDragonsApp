import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _reject_blank(value: str) -> str:
    """
    Strip surrounding whitespace and reject empty strings.

    Args:
        value (str): The raw field value.

    Returns:
        str: The stripped value.

    Raises:
        ValueError: If the value is empty or whitespace-only.
    """
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be empty")
    return stripped


# ----- Jobs -----


class JobCreate(BaseModel):
    """Request body for creating a job record."""

    title: str = Field(max_length=200)
    company: str = Field(max_length=200)
    stage: str = Field(default="Saved", max_length=50)
    location: str | None = Field(default=None, max_length=200)
    deadline: date | None = Field(default=None)
    deadline_state: str | None = Field(default="No Deadline", max_length=50)

    _validate_title = field_validator("title")(_reject_blank)
    _validate_company = field_validator("company")(_reject_blank)
    _validate_stage = field_validator("stage")(_reject_blank)


class JobUpdate(BaseModel):
    """Request body for updating a job record; all fields optional."""

    title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    stage: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=200)
    deadline: date | None = Field(default=None)
    deadline_state: str | None = Field(default=None, max_length=50)

    @field_validator("title", "company", "stage", "location", "deadline_state")
    @classmethod
    def validate_not_blank(cls, value: str | None) -> str | None:
        """
        Apply the blank-rejection rule to provided values only.

        Args:
            value (str | None): The raw field value, or None if omitted.

        Returns:
            str | None: The stripped value, or None if omitted.
        """
        if value is None:
            return None
        return _reject_blank(value)


class JobOut(BaseModel):
    """Response body for a job record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: str
    title: str
    company: str
    stage: str
    location: str | None
    deadline: date | None
    deadline_state: str | None
    last_activity: datetime
    created_at: datetime


# ----- Profile -----


class ProfileUpdate(BaseModel):
    """
    Request body for creating/updating the current user's profile.

    All fields are optional so a partial profile can be saved; omitted
    fields keep their current value (S1-BR-009 / S1-BR-010).
    """

    full_name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, max_length=5000)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        """
        Validate email format when a non-empty value is provided.

        Args:
            value (str | None): The raw email value, or None if omitted.

        Returns:
            str | None: The trimmed email, or None if omitted. An empty
                string is allowed (an unfilled baseline field).

        Raises:
            ValueError: If a non-empty value is not a valid email address.
        """
        if value is None:
            return None
        trimmed = value.strip()
        if trimmed and not _EMAIL_PATTERN.match(trimmed):
            raise ValueError("must be a valid email address")
        return trimmed


class ProfileOut(BaseModel):
    """Response body for a user's baseline profile."""

    model_config = ConfigDict(from_attributes=True)

    owner_id: str
    full_name: str
    email: str
    phone: str
    location: str
    summary: str
    updated_at: datetime


# ----- Metrics -----


class JobMetrics(BaseModel):
    """Dashboard metrics computed from a user's jobs (S2-025)."""

    total: int
    by_stage: dict[str, int]
    applications: int
    responses: int
    offers: int
    response_rate: float


# ----- Experience -----

ENTRY_TYPES = {"employment", "project"}


def _validate_entry_type(value: str | None) -> str | None:
    """
    Restrict entry_type to the allowed kinds.

    Args:
        value (str | None): The raw entry_type, or None if omitted.

    Returns:
        str | None: The value unchanged, or None if omitted.

    Raises:
        ValueError: If a non-None value is not 'employment' or 'project'.
    """
    if value is not None and value not in ENTRY_TYPES:
        raise ValueError("must be 'employment' or 'project'")
    return value


class ExperienceCreate(BaseModel):
    """Request body for creating an experience entry (S2-016)."""

    entry_type: str = Field(default="employment", max_length=20)
    title: str = Field(max_length=200)
    organization: str = Field(default="", max_length=200)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=5000)

    _validate_title = field_validator("title")(_reject_blank)
    _validate_type = field_validator("entry_type")(_validate_entry_type)


class ExperienceUpdate(BaseModel):
    """Request body for updating an experience entry; all fields optional."""

    entry_type: str | None = Field(default=None, max_length=20)
    title: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=5000)

    _validate_type = field_validator("entry_type")(_validate_entry_type)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        """Reject a blank title only when one is provided."""
        return None if value is None else _reject_blank(value)


class ExperienceOut(BaseModel):
    """Response body for an experience entry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: str
    entry_type: str
    title: str
    organization: str
    start_date: str
    end_date: str
    description: str
    position: int


class ReorderRequest(BaseModel):
    """Request body for reordering: entry ids in their new order."""

    order: list[int]


# ----- Education (S2-017) -----


class EducationCreate(BaseModel):
    """Request body for creating an education record (S2-017).

    `school` and `degree` are required, non-blank fields (S2-BR-015).
    """

    school: str = Field(max_length=200)
    degree: str = Field(max_length=200)
    field_of_study: str = Field(default="", max_length=200)
    start_date: str = Field(default="", max_length=40)
    end_date: str = Field(default="", max_length=40)
    gpa: str = Field(default="", max_length=20)
    description: str = Field(default="", max_length=5000)

    _validate_school = field_validator("school")(_reject_blank)
    _validate_degree = field_validator("degree")(_reject_blank)


class EducationUpdate(BaseModel):
    """Request body for updating an education record; all fields optional."""

    school: str | None = Field(default=None, max_length=200)
    degree: str | None = Field(default=None, max_length=200)
    field_of_study: str | None = Field(default=None, max_length=200)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    gpa: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("school", "degree")
    @classmethod
    def validate_required_text(cls, value: str | None) -> str | None:
        """Reject a blank required field only when one is provided."""
        return None if value is None else _reject_blank(value)


class EducationOut(BaseModel):
    """Response body for an education record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    school: str
    degree: str
    field_of_study: str
    start_date: str
    end_date: str
    gpa: str
    description: str
    position: int
