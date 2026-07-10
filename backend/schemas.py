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
    description: str = Field(default=None, max_length=500)
    deadline: date | None = Field(default=None)
    deadline_state: str | None = Field(default="No Deadline", max_length=50)
    interview_notes: str = Field(default=None, max_length=500)
    outcome_state: str | None = Field(default=None, max_length=50)
    outcome_notes: str | None = Field(default=None)

    interview_date: datetime | str | None = Field(default=None)
    notes: str | None = Field(default=None)

    _validate_title = field_validator("title")(_reject_blank)
    _validate_company = field_validator("company")(_reject_blank)
    _validate_stage = field_validator("stage")(_reject_blank)

    @field_validator("interview_date", mode="before")
    @classmethod
    def parse_flexible_interview_date(cls, value):
        """Parse incoming interview date values into structured date formats safely."""
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError("Invalid date format. Use YYYY-MM-DD HH:MM or MM/DD/YYYY")


class JobUpdate(BaseModel):
    """Request body for updating a job record; all fields optional."""

    title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    stage: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    deadline: date | None = Field(default=None)
    deadline_state: str | None = Field(default=None, max_length=50)

    outcome_state: str | None = Field(default=None, max_length=50)
    outcome_notes: str | None = Field(default=None)

    interview_date: datetime | str | None = Field(default=None)
    interview_notes: str | None = Field(default=None, max_length=500)

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

    @field_validator("interview_date", mode="before")
    @classmethod
    def parse_flexible_interview_date(cls, value):
        """Parse incoming interview date values into structured date formats safely."""
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError("Invalid date format. Use YYYY-MM-DD HH:MM or MM/DD/YYYY")


class JobOut(BaseModel):
    """Response body for a job record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: str
    title: str
    company: str
    stage: str
    location: str | None
    description: str
    deadline: date | None
    deadline_state: str | None
    created_at: datetime | str | None = None
    last_activity: datetime | str | None = None
    outcome_state: str | None = None
    outcome_notes: str | None = None
    is_archived: bool

    interview_date: datetime | None = None
    interview_notes: str
    notes_updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class JobStageHistoryOut(BaseModel):
    """Response body representing a single historical point on the job timeline."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    old_stage: str
    new_stage: str
    changed_at: datetime


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


class StageConversion(BaseModel):
    """Conversion between two consecutive funnel stages (S3-014)."""

    from_stage: str
    to_stage: str
    reached_from: int
    reached_to: int
    rate: float


class StageDwell(BaseModel):
    """Average completed time spent in one stage (S3-014)."""

    stage: str
    avg_days: float
    samples: int


class JobAnalytics(BaseModel):
    """Conversion and time-in-stage analytics from stage events (S3-014)."""

    funnel: dict[str, int]
    conversion: list[StageConversion]
    time_in_stage: list[StageDwell]


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
    owner_id: str
    school: str
    degree: str
    field_of_study: str
    start_date: str
    end_date: str
    gpa: str
    description: str
    position: int


# ----- Skills (S2-018) -----

# Allowed proficiency levels. An empty string means "unspecified"; any
# other value must be one of these (S2-BR-016). The team's requirements
# doc names the rule but not the vocabulary, so this is the testable
# interpretation: a level scale, mirroring how entry_type is constrained.
PROFICIENCY_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}


def _validate_proficiency(value: str | None) -> str | None:
    """
    Restrict proficiency to an allowed level when one is given (S2-BR-016).

    Args:
        value (str | None): The raw proficiency, or None if omitted.

    Returns:
        str | None: The value unchanged (blank/None means unspecified).

    Raises:
        ValueError: If a non-blank value is not an allowed level.
    """
    if value and value not in PROFICIENCY_LEVELS:
        allowed = ", ".join(sorted(PROFICIENCY_LEVELS))
        raise ValueError(f"must be one of: {allowed}")
    return value


class SkillCreate(BaseModel):
    """Request body for creating a skill (S2-018).

    `name` is required and non-blank; `category` and `proficiency` are
    optional (S2-BR-016).
    """

    name: str = Field(max_length=100)
    category: str = Field(default="", max_length=100)
    proficiency: str = Field(default="", max_length=20)

    _validate_name = field_validator("name")(_reject_blank)
    _validate_proficiency = field_validator("proficiency")(_validate_proficiency)


class SkillUpdate(BaseModel):
    """Request body for updating a skill; all fields optional."""

    name: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    proficiency: str | None = Field(default=None, max_length=20)

    _validate_proficiency = field_validator("proficiency")(_validate_proficiency)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        """Reject a blank name only when one is provided."""
        return None if value is None else _reject_blank(value)


class SkillOut(BaseModel):
    """Response body for a skill."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: str
    name: str
    category: str
    proficiency: str
    position: int


# ----- Job Search -----


class JobSearchRequest(BaseModel):
    """Search criteria used to look for matching job postings."""

    title: str
    employer: str
    keywords: list[str]
    excluded_words: list[str]


class FoundJob(BaseModel):
    """A job posting returned to the frontend."""

    id: str
    title: str
    employer: str
    description: str
    apply_link: str
    salary: float
    employment_type: str
    country: str
    state: str
    city: str


# ----- Resume -----


# Gemini structured output for tailoring
class TailoredProfile(BaseModel):
    """Users profile tailored to match the specific job"""

    full_name: str
    email: str
    phone: str
    location: str
    summary: str  # AI rewrites this; all other fields pass through unchanged


class TailoredExperience(BaseModel):
    """Users expereicnce tailored to match the specific job"""

    entry_type: str
    title: str
    organization: str
    start_date: str
    end_date: str
    description: str


class TailoredSkill(BaseModel):
    """Users skills tailored to match the specific job"""

    name: str
    category: str
    proficiency: str


class TailoredEducation(BaseModel):
    """Education tailored to the specific job"""

    school: str
    degree: str
    field_of_study: str
    start_date: str
    end_date: str
    gpa: str
    description: str  # AI rewrites this to highlight relevant coursework/projects


class TailoredResume(BaseModel):
    """Generated resume from profile and job information"""

    profile: TailoredProfile
    experience: list[TailoredExperience]
    skills: list[TailoredSkill]
    education: list[TailoredEducation]


class SaveResumeRequest(BaseModel):
    """Infomration for saving the resume to the db"""

    job: FoundJob
    resume: TailoredResume


class SavedResume(BaseModel):
    """Infomration for saving the resume to the db"""

    job: FoundJob
    resume: TailoredResume


class RewriteResumeRequest(BaseModel):
    """All information needed to request a rewrite of a resume"""

    job: FoundJob
    existing_resume: TailoredResume
    rewrite_prompt: str


# Cover Letter


class CoverLetter(BaseModel):
    """Information generated by ai for cover letter"""

    full_name: str
    email: str
    phone: str
    location: str
    date: str
    hiring_manager: str
    company: str
    job_title: str
    body: str


class SaveCoverLetterRequest(BaseModel):
    """Infomration needed for cover letter request"""

    job: FoundJob
    cover_letter: CoverLetter


class SavedCoverLetter(BaseModel):
    """Infomration for saving the cover letter to the db"""

    job: FoundJob
    cover_letter: CoverLetter


class RewriteCoverLetterRequest(BaseModel):
    """All information needed to request a rewrite of a cover letter"""

    job: FoundJob
    existing_cover_letter: CoverLetter
    rewrite_prompt: str
