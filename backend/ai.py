from concurrent.futures import ThreadPoolExecutor
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from jobs import get_current_user_id
from models import Education, Experience, Profile, Skill
from schemas import (
    TailoredEducation,
    TailoredExperience,
    TailoredProfile,
    TailoredResume,
    TailoredSkill,
)

airouter = APIRouter(prefix="/api/ai", tags=["ai"])

load_dotenv()
MODEL = "gemini-2.5-flash"

# These prompts were obviously made with claude cuz I'm lazy
EDUCATION_PROMPT = """
You are a professional resume writer. Your task is to tailor the EDUCATION section
of a resume to best match the target role.

INSTRUCTIONS:
- Highlight degrees, majors, minors, or certifications most relevant to the role
- Surface relevant coursework, projects, or academic honors if they strengthen the fit
- Reorder items to put the most relevant credential first
- Remove or de-emphasize details that are irrelevant to this role
- Keep all facts truthful — do not invent or embellish
- Output ONLY the tailored Education section in clean plain text,
    ready to paste into a resume
- Use this format for each entry:
    [Degree] in [Field], [Institution] — [Year]
    Relevant Coursework: ...  (include only if relevant)
    Honors/Awards: ...        (include only if relevant)

EDUCATION:
{education}

POSITION INFORMATION:
{position_info}
"""

SKILLS_PROMPT = """
You are a professional resume writer. Your task is to tailor the SKILLS section
of a resume to best match the target role.

INSTRUCTIONS:
- Prioritize skills that are explicitly mentioned
    or strongly implied in the job description
- Group skills into logical categories (e.g. Languages, Frameworks, Tools, Soft Skills)
- Remove skills that are entirely irrelevant to this role to avoid dilution
- Do not invent skills the candidate has not listed — only reorder and filter
- Keep the output concise: no more than 5 categories,
    no more than 6 items per category
- Output ONLY the tailored Skills section in clean plain text,
    ready to paste into a resume

CANDIDATE SKILLS:
{skills}

POSITION INFORMATION:
{position_info}
"""

PROFILE_PROMPT = """
You are a professional resume writer. Your task is to tailor the PROFILE section
of a resume to best match the target role.

The profile section contains two parts:
1. CONTACT INFO — name, email, phone, location,
2. PROFESSIONAL SUMMARY —
    a 2–3 sentence pitch that positions the candidate for this specific role

INSTRUCTIONS FOR CONTACT INFO:
- Keep all contact details exactly as provided — do not alter or fabricate any
- Include a LinkedIn or portfolio URL only if one was provided
- Omit any fields that were not provided

INSTRUCTIONS FOR PROFESSIONAL SUMMARY:
- Write a 2–3 sentence summary tailored to this specific role and company
- Lead with the candidate's years of experience and core identity
    (e.g. "Full-stack engineer with 5+ years...")
- Weave in 2–3 key strengths that directly address the job description
- Close with a forward-looking statement about what they bring to this role
- Do not use buzzwords like "results-driven," "passionate," or "ninja"
- Output ONLY the tailored Profile section in clean plain text,
    ready to paste into a resume

CANDIDATE PROFILE INFO:
{profile_info}

POSITION INFORMATION:
{position_info}
"""

EXPERIENCE_PROMPT = """
You are a professional resume writer. Your task is to tailor the WORK EXPERIENCE section
of a resume to best match the target role.

INSTRUCTIONS:
- Rewrite bullet points to emphasize
    responsibilities and achievements most relevant to this role
- Lead each bullet with a strong action verb
    (e.g. "Engineered," "Led," "Reduced," "Launched")
- Quantify impact wherever the data is available
    (e.g. "reduced load time by 40%")
- Remove or compress bullets that are irrelevant to this role
- Keep each bullet to one line (max ~120 characters)
- Preserve all employer names, job titles, locations,
    and dates exactly as provided — do not alter facts
- Do not invent metrics or responsibilities that weren't in the original
- Maintain reverse-chronological order
- Output ONLY the tailored Experience section in clean plain text,
    ready to paste into a resume
- Use this format per role:
    [Job Title] | [Company] | [Location] | [Start Date] – [End Date]
    • [Bullet]
    • [Bullet]

CANDIDATE EXPERIENCE:
{experience}

POSITION INFORMATION:
{position_info}
"""


def fmt_profile(p: Profile) -> str:
    """Formatting for profile, so resume tailoring is easier"""
    return (
        f"Name:     {p.full_name}\n"
        f"Email:    {p.email}\n"
        f"Phone:    {p.phone}\n"
        f"Location: {p.location}\n"
        f"Summary:  {p.summary}"
    )


def fmt_experience(rows: list[Experience]) -> str:
    """Formatting for experience, so resume tailoring is easier"""
    entries = []
    for e in rows:
        entries.append(
            f"[{e.entry_type.upper()}] {e.title} at {e.organization}\n"
            f"  {e.start_date} – {e.end_date}\n"
            f"  {e.description}"
        )
    return "\n\n".join(entries)


def fmt_skills(rows: list[Skill]) -> str:
    """Formatting for skills, so resume tailoring is easier"""
    return "\n".join(
        f"- {s.name} | category: {s.category or 'none'}"
        f" | proficiency: {s.proficiency or 'unspecified'}"
        for s in rows
    )


def fmt_education(rows: list[Education]) -> str:
    """Formatting for education, so resume tailoring is easier"""
    entries = []
    for e in rows:
        entries.append(
            f"{e.degree} in {e.field_of_study or 'N/A'}, {e.school}\n"
            f"  {e.start_date} – {e.end_date} | GPA: {e.gpa or 'N/A'}\n"
            f"  {e.description}"
        )
    return "\n\n".join(entries)


def call_gemini(prompt: str, schema: type) -> dict:
    """Simple wrapper function for the gemini api call"""
    client = genai.Client()
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    return response.parsed


# Included here instead of schemas since its so small
class ResumeRequest(BaseModel):
    """Information about the actual position resume is requested"""

    position_info: str


@airouter.post("/create_resume", response_model=TailoredResume)
def create_resume(
    body: ResumeRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Creates a resume based off of the user's inputted data in the profile
    section of the application.

    Args:
        body (ResumeRequest): Actual job information, to be combined with
        profile information to tailor the resume
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        CreatedResume: Resume represented as a json, the frontend might
        decide to format this as a png or jpg, etc.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=422,
            detail=(
                "Profile not found."
                "Please complete your profile before generating a resume."
            ),
        )
    experience = db.query(Experience).filter(Experience.owner_id == user_id).all()
    if not experience:
        raise HTTPException(
            status_code=422,
            detail=(
                "No experience entries found."
                "Please add experience before generating a resume."
            ),
        )
    skills = db.query(Skill).filter(Skill.owner_id == user_id).all()
    if not skills:
        raise HTTPException(
            status_code=422,
            detail=("No skills found.Please add skills before generating a resume."),
        )
    education = db.query(Education).filter(Education.owner_id == user_id).all()
    if not education:
        raise HTTPException(
            status_code=422,
            detail=(
                "No education found.Please add education before generating a resume"
            ),
        )

    position_info = body.position_info

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_education = executor.submit(
            call_gemini,
            EDUCATION_PROMPT.format(
                education=fmt_education(education), position_info=position_info
            ),
            list[TailoredEducation],
        )
        future_experience = executor.submit(
            call_gemini,
            EXPERIENCE_PROMPT.format(
                experience=fmt_experience(experience), position_info=position_info
            ),
            list[TailoredExperience],
        )
        future_skills = executor.submit(
            call_gemini,
            SKILLS_PROMPT.format(
                skills=fmt_skills(skills), position_info=position_info
            ),
            list[TailoredSkill],
        )
        future_profile = executor.submit(
            call_gemini,
            PROFILE_PROMPT.format(
                profile_info=fmt_profile(profile), position_info=position_info
            ),
            TailoredProfile,
        )

        tailored_education = future_education.result()
        tailored_experience = future_experience.result()
        tailored_skills = future_skills.result()
        tailored_profile = future_profile.result()

    tailored_resume = TailoredResume(
        profile=tailored_profile,
        experience=tailored_experience,
        skills=tailored_skills,
        education=tailored_education,
    )
    print(tailored_resume.model_dump_json(indent=2))
    return TailoredResume(
        profile=tailored_profile,
        experience=tailored_experience,
        skills=tailored_skills,
        education=tailored_education,
    )
