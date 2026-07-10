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
from models import Document, Education, Experience, Profile, Skill
from schemas import (
    CoverLetter,
    RewriteCoverLetterRequest,
    RewriteResumeRequest,
    SaveCoverLetterRequest,
    SaveResumeRequest,
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

COVER_LETTER_PROMPT = """
You are a professional cover letter writer. Write a tailored cover letter
for the candidate based on their profile and the target role.

INSTRUCTIONS:
- Write 3–4 paragraphs: opening hook, relevant experience,
  why this company, closing call to action
- Be specific to the job description — reference the role and company by name
- Draw on the candidate's actual experience, skills, and education —
  do not invent anything
- Keep a professional but personable tone — avoid buzzwords and clichés
- Each paragraph should be separated by a blank line
- Do not include salutation, sign-off, or contact info — those are handled separately
- Return today's date in the format "Month DD, YYYY" for the date field
- For hiring_manager, use an empty string if unknown

CANDIDATE PROFILE:
{profile_info}

CANDIDATE EXPERIENCE:
{experience}

CANDIDATE SKILLS:
{skills}

CANDIDATE EDUCATION:
{education}

POSITION INFORMATION:
{position_info}
"""

REWRITE_COVER_LETTER_PROMPT = """
You are a professional cover letter writer. Rewrite the existing cover letter
based on the candidate's instructions while keeping it tailored to the role.

INSTRUCTIONS:
- Apply the rewrite instructions exactly as requested
- Keep all facts truthful — do not invent experience or skills
- Maintain 3–4 paragraphs unless the instructions say otherwise
- Keep a professional but personable tone — avoid buzzwords and clichés
- Each paragraph should be separated by a blank line
- Do not include salutation, sign-off, or contact info — those are handled separately
- Preserve the date, hiring_manager, company, and job_title from the original
- Only rewrite the body unless explicitly told otherwise

EXISTING COVER LETTER:
{existing_cover_letter}

REWRITE INSTRUCTIONS:
{rewrite_prompt}

CANDIDATE PROFILE:
{profile_info}

CANDIDATE EXPERIENCE:
{experience}

CANDIDATE SKILLS:
{skills}

CANDIDATE EDUCATION:
{education}

POSITION INFORMATION:
{position_info}
"""

REWRITE_RESUME_PROMPT = """
You are an expert executive resume writer and career coach. Rewrite the candidate's
existing resume data based on their instructions while
    keeping it strictly tailored to the role.

INSTRUCTIONS:
- Apply the rewrite instructions exactly as requested.
- Keep all facts 100% truthful — do not invent experience, metrics, titles, or skills.
- Use strong action verbs at the start of every experience bullet point.
- Format achievements using the STAR methodology
    (Situation, Task, Action, Result) wherever possible.
- Keep a crisp, professional, and high-impact tone —
    eliminate passive phrases (e.g., "responsible for") and generic fluff.
- Preserve the underlying timeline, company names, job titles,
    and dates from the original unless explicitly told otherwise.
- Only rewrite the content areas
    (Summary, Experience Bullets, or Project Descriptions) affected by the instructions.

EXISTING RESUME DATA:
{existing_resume}

REWRITE INSTRUCTIONS:
{rewrite_prompt}

CANDIDATE PROFILE:
{profile_info}

CANDIDATE EXPERIENCE:
{experience}

CANDIDATE SKILLS:
{skills}

CANDIDATE EDUCATION:
{education}

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


@airouter.post("/rewrite_resume", response_model=TailoredResume)
def rewrite_resume(
    body: RewriteResumeRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Modifes an existing resume based off of the user's inputted
    suggestions of improvement

    Args:
        body (RewriteResumeRequest): Previous resume combined with
        prompt for suggested improvements
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        TailoredResume: resume represented as json, the frontend might
        decide to format this as a png or jpg, etc.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    print("BEFORE")
    if not profile:
        raise HTTPException(
            status_code=422,
            detail=(
                "Profile not found. "
                "Please complete your profile before generating a cover letter."
            ),
        )
    print("HERE")
    experience = db.query(Experience).filter(Experience.owner_id == user_id).all()
    skills = db.query(Skill).filter(Skill.owner_id == user_id).all()
    education = db.query(Education).filter(Education.owner_id == user_id).all()

    new_resume = call_gemini(
        REWRITE_RESUME_PROMPT.format(
            existing_resume=body.existing_resume.model_dump_json(),
            rewrite_prompt=body.rewrite_prompt,
            profile_info=fmt_profile(profile),
            experience=fmt_experience(experience),
            skills=fmt_skills(skills),
            education=fmt_education(education),
            position_info=body.job.description,
        ),
        TailoredResume,
    )

    print(new_resume.model_dump_json(indent=2))
    return new_resume


@airouter.post("/save_resume", status_code=201)
def save_resume(
    body: SaveResumeRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Given the generated resume and the found job,
    issues a command to the database that saves both in one structure

    Args:
        body (SaveResumeRequest): Actual job information, mixed with
        resume
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        HTTP status codes
    """
    try:
        doc = Document(
            owner_id=user_id,
            doc_type="resume",
            content=body.resume.model_dump_json(),
            job_snapshot=body.job.model_dump_json(),
        )
        db.add(doc)
        db.commit()
        return {"detail": "Resume saved successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save resume.") from e


@airouter.post("/create_cover_letter", response_model=CoverLetter)
def create_cover_letter(
    body: ResumeRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Creates a cover letter based off of the user's inputted data
    in the profile section of the application.

    Args:
        body (ResumeRequest): Actual job information, to be combined with
        profile information to tailor the cover letter
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        CoverLetter: Cover letter represented as json, the frontend might
        decide to format this as a png or jpg, etc.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=422,
            detail=(
                "Profile not found. "
                "Please complete your profile before generating a cover letter."
            ),
        )
    experience = db.query(Experience).filter(Experience.owner_id == user_id).all()
    skills = db.query(Skill).filter(Skill.owner_id == user_id).all()
    education = db.query(Education).filter(Education.owner_id == user_id).all()

    position_info = body.position_info

    cover_letter = call_gemini(
        COVER_LETTER_PROMPT.format(
            profile_info=fmt_profile(profile),
            experience=fmt_experience(experience),
            skills=fmt_skills(skills),
            education=fmt_education(education),
            position_info=position_info,
        ),
        CoverLetter,
    )

    print(cover_letter.model_dump_json(indent=2))
    return cover_letter


@airouter.post("/rewrite_cover_letter", response_model=CoverLetter)
def rewrite_cover_letter(
    body: RewriteCoverLetterRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Modifes an existing cover letter based off of the user's inputted
    suggestions of improvement

    Args:
        body (RewriteCoverLetterRequest): Previous cover letter combined with
        prompt for suggested improvements
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        CoverLetter: Cover letter represented as json, the frontend might
        decide to format this as a png or jpg, etc.
    """
    profile = db.query(Profile).filter(Profile.owner_id == user_id).first()
    print("BEFORE")
    if not profile:
        raise HTTPException(
            status_code=422,
            detail=(
                "Profile not found. "
                "Please complete your profile before generating a cover letter."
            ),
        )
    print("HERE")
    experience = db.query(Experience).filter(Experience.owner_id == user_id).all()
    skills = db.query(Skill).filter(Skill.owner_id == user_id).all()
    education = db.query(Education).filter(Education.owner_id == user_id).all()

    cover_letter = call_gemini(
        REWRITE_COVER_LETTER_PROMPT.format(
            existing_cover_letter=body.existing_cover_letter.model_dump_json(),
            rewrite_prompt=body.rewrite_prompt,
            profile_info=fmt_profile(profile),
            experience=fmt_experience(experience),
            skills=fmt_skills(skills),
            education=fmt_education(education),
            position_info=body.job.description,
        ),
        CoverLetter,
    )

    print(cover_letter.model_dump_json(indent=2))
    return cover_letter


@airouter.post("/save_cover_letter", status_code=201)
def save_cover_letter(
    body: SaveCoverLetterRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Given the generated cover letter and the found job,
    issues a command to the database that saves both in one structure

    Args:
        body (SaveCoverLetterRequest): Actual job information, mixed with
        cover letter
        user_id: Used to find the users profile information
        db (Session): Database session, where the data is extracted from
    Returns:
        HTTP status codes
    """
    try:
        doc = Document(
            owner_id=user_id,
            doc_type="cover_letter",
            content=body.cover_letter.model_dump_json(),
            job_snapshot=body.job.model_dump_json(),
        )
        db.add(doc)
        db.commit()
        return {"detail": "Cover letter saved successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail="Failed to save cover letter."
        ) from e


class ResearchRequest(BaseModel):
    """Input payload mapping from the Dashboard AI Brief button action"""

    company_name: str
    job_title: str
    location: str | None = None
    job_description: str | None = None
    user_context: str | None = ""


@airouter.post("/research")
def generate_company_research(
    body: ResearchRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    """
    Generates an expert, location-aware corporate interview briefing
    tailored to the specific title, raw job description requirements,
    and custom user-provided context focus areas.
    """
    # Build out a dynamic instruction block depending on if user_context exists
    user_section_instruction = ""
    if body.user_context and body.user_context.strip():
        # Broken into smaller strings to pass the 88 character line limit (E501)
        user_section_instruction = (
            "SECTION 5: USER FOCUS & TARGETED Q&A\n"
            "Directly address, analyze, and answer the user's specific "
            f"request or question: \"{body.user_context.strip()}\""
        )

    # Build out the final targeted prompt pieces to avoid strict E501 limits
    p_intro = (
        "You are an expert career coach and corporate intelligence researcher. "
        "Provide a comprehensive, highly actionable interview preparation "
        "briefing for a candidate."
    )
    p_fallback = (
        "No explicit description provided. "
        "Analyze general expectations for this title."
    )
    p_desc = body.job_description or p_fallback
    p_warn = (
        "CRITICAL INSTRUCTION: Do NOT use any markdown syntax or special "
        "formatting symbols. Do not use asterisks (**), hashtags (#), or "
        "dashes for bullet points. Write exclusively in plain text using "
        "clear capitalization for section headers."
    )
    p_struct = (
        "Please provide the research structured exactly with these plain "
        "text headers, separating sections with a blank line:"
    )
    p_fluff = (
        "Keep the tone professional, objective, direct, and crisp. "
        "Do not include introductory conversational fluff."
    )

    prompt = f"""{p_intro}

Target Parameters:
- Company: {body.company_name}
- Role Title: {body.job_title}
- Location context: {body.location or "Not Specified"}

Raw Job Description Requirements:
\"\"\"
{p_desc}
\"\"\"

{p_warn}

{p_struct}
SECTION 1: COMPANY MISSION & REGIONAL CULTURE
SECTION 2: CORE TECH STACK & SKILLS MATRIX
SECTION 3: KEY STRATEGIC FOCUS OR RECENT TRENDS
SECTION 4: 3 PRECISION QUESTIONS TO ASK THE INTERVIEWER
{user_section_instruction}

{p_fluff}"""

    try:
        client = genai.Client()
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
        return response.text
    except Exception as e:
        # Added 'from None' to satisfy the B904 error rule
        raise HTTPException(
            status_code=500, detail=f"Gemini API Error: {str(e)}"
        ) from None
    