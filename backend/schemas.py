from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
