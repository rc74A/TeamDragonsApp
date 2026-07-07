import datetime
import json
import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from supabase import create_client

from database import get_db
from jobs import get_current_user_id
from models import Document, DocumentVersion
from schemas import DocumentPost

documentrouter = APIRouter(prefix="/api/documents", tags=["documents"])

SUPABASE_URL = "https://acnfzbtvpovzzyqwgbys.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_PRIV_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@documentrouter.post("", status_code=201)
async def upload_document_request(
    file: Annotated[UploadFile, File(...)],
    payload_str: Annotated[str, Form(...)],
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Uploads a physical document to Supabase storage and archives its data layout.

    Parses a multipart form containing metadata details and an associated binary
    document. Verifies if an overarching parent document tracking record exists
    to calculate the sequential version sequence number. Uploads files directly
    to cloud storage and writes immutable metadata rows to an Aiven MySQL DB.

    Params:
        file (UploadFile): The raw document asset uploaded via the form request.
        payload_str (str): JSON-serialized string matching the DocumentPost structure.
        user_id (str): Extracted authenticated user token from dependency injection.
        db (Session): Active context transaction handle tracking the local instance.

    Returns:
        dict: Confirmation map outlining newly generated
        entity parameters and access vectors.
    """
    try:
        payload_dict = json.loads(payload_str)
        payload = DocumentPost(**payload_dict)
    except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid JSON format in payload_str"
        ) from None

    # Force strict content type checking
    allowed_types = ["application/pdf", "image/png", "image/jpeg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, detail="Only PDF, PNG, or JPEG files are allowed."
        )

    bucket_name = "resumes" if payload.doc_type == "resume" else "cover_letters"

    # Check if a parent document already exists for this owner and type
    # For a truer match, you could also track a
    # document "title" or "id" from the frontend
    stmt = select(Document).where(
        Document.owner_id == user_id, Document.doc_type == payload.doc_type
    )
    parent_doc = db.scalars(stmt).first()

    if not parent_doc:
        # First time creating this document archetype
        parent_doc = Document(
            owner_id=user_id,
            doc_type=payload.doc_type,
            content=payload.content,  # Keep fallback aggregate text on parent
            job_snapshot=payload.job_snapshot,
        )
        db.add(parent_doc)
        db.flush()  # Populates parent_doc.id immediately before committing
        next_version = 1
    else:
        # Document exists; calculate the next version number cleanly
        if parent_doc.versions:
            next_version = parent_doc.versions[0].version_number + 1
        else:
            next_version = 1

        # Update parent aggregates to reflect the newest version text
        parent_doc.content = payload.content
        parent_doc.job_snapshot = payload.job_snapshot

    # Unique storage identifier for supabase files
    timestamp = int(datetime.now().timestamp())
    safe_file_name = f"{timestamp}_v{next_version}_{payload.file_name}"
    file_path = f"users/{user_id}/{payload.doc_type}/{safe_file_name}"

    file_bytes = await file.read()

    try:
        supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/pdf"},
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=502, detail=f"Cloud storage upload failed: {str(e)}"
        ) from None

    new_version = DocumentVersion(
        document_id=parent_doc.id,
        version_number=next_version,
        file_name=payload.file_name,
        storage_url=file_path,
        content=payload.content,
        job_snapshot=payload.job_snapshot,
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    # Short lived preview
    signed_url_data = supabase.storage.from_(bucket_name).create_signed_url(
        file_path, 900
    )

    return {
        "message": "Document version saved successfully",
        "document_id": parent_doc.id,
        "version_id": new_version.id,
        "version_number": new_version.version_number,
        "download_url": signed_url_data.get("signedURL"),
    }
