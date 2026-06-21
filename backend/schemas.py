import re
from datetime import datetime

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

    _validate_title = field_validator("title")(_reject_blank)
    _validate_company = field_validator("company")(_reject_blank)
    _validate_stage = field_validator("stage")(_reject_blank)


class JobUpdate(BaseModel):
    """Request body for updating a job record; all fields optional."""

    title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    stage: str | None = Field(default=None, max_length=50)

    @field_validator("title", "company", "stage")
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
    owner_id: int
    title: str
    company: str
    stage: str
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

    owner_id: int
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
