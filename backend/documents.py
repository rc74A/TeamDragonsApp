import datetime
import json
import os
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from supabase import create_client

from database import get_db
from jobs import get_current_user_id
from models import Document, DocumentVersion
from schemas import (
    DocumentDuplicateRequest,
    DocumentOut,
    DocumentPost,
    DocumentVersionOut,
)

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
    (matched by owner, doc_type, and title) to calculate the sequential version
    sequence number. Uploads files directly to cloud storage and writes immutable
    metadata rows to an Aiven MySQL DB.

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

    # Force strict content type checking, with an extension fallback for
    # browsers/OSes that send an empty or unreliable content_type
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    allowed_extensions = {".png", ".docx", ".txt"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file.content_type not in allowed_types and file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only DOCX, TXT, PDF are allowed.")

    bucket_name = "resumes" if payload.doc_type == "resume" else "cover_letters"

    # Check if a parent document already exists for this owner, type, and title.
    # Title lets a user have multiple distinct documents of the same doc_type
    # (e.g. "Backend Resume" and "Frontend Resume"), each with its own version history.
    stmt = select(Document).where(
        Document.owner_id == user_id,
        Document.doc_type == payload.doc_type,
        Document.title == payload.title,
    )
    parent_doc = db.scalars(stmt).first()

    if not parent_doc:
        # First time creating this document archetype
        parent_doc = Document(
            owner_id=user_id,
            doc_type=payload.doc_type,
            title=payload.title,
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
    timestamp = int(datetime.datetime.now().timestamp())
    safe_file_name = f"{timestamp}_v{next_version}_{payload.file_name}"
    file_path = f"users/{user_id}/{payload.doc_type}/{safe_file_name}"

    file_bytes = await file.read()

    try:
        supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type or "application/octet-stream"
            },
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


@documentrouter.get("", response_model=list[DocumentOut])
async def list_documents(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
    doc_type: Literal["resume", "cover_letter"] | None = None,
    sort_by: Literal["created_at", "file_name", "title"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
):
    """
    Lists all documents owned by the current user, one entry per distinct
    (doc_type, title) pair, each annotated with its most recent version
    and a short-lived signed preview URL.

    Documents are grouped by title, so a user can maintain several distinct
    documents of the same doc_type (e.g. "Backend Resume" and "Frontend
    Resume"), each carrying its own independent version history. Only the
    latest version of each document is returned here; call
    GET /api/documents/{document_id}/versions for full history.

    Params:
        user_id (str): Extracted authenticated user token from dependency injection.
        db (Session): Active context transaction handle tracking the local instance.
        doc_type (str | None): Optional filter to "resume" or "cover_letter".
            Omit to return both types.
        sort_by (str): Field to sort results by — "created_at", "file_name"
            (of the latest version), or "title". Defaults to "created_at".
        order (str): Sort direction, "asc" or "desc". Defaults to "desc".

    Returns:
        list[DocumentOut]: One entry per document, each including its id,
        doc_type, title, creation timestamp, and latest version details
        (version number, file name, upload timestamp, signed download URL).
        Documents with no uploaded versions are omitted.
    """
    stmt = select(Document).where(Document.owner_id == user_id)
    if doc_type:
        stmt = stmt.where(Document.doc_type == doc_type)

    documents = db.scalars(stmt).all()

    results = []
    for doc in documents:
        if not doc.versions:
            continue

        latest = doc.versions[0]
        bucket_name = "resumes" if doc.doc_type == "resume" else "cover_letters"

        try:
            signed = supabase.storage.from_(bucket_name).create_signed_url(
                latest.storage_url, 900
            )
            download_url = signed.get("signedURL")
        except Exception:
            download_url = None

        results.append(
            DocumentOut(
                id=doc.id,
                doc_type=doc.doc_type,
                title=doc.title,
                created_at=doc.created_at,
                latest_version=DocumentVersionOut(
                    id=latest.id,
                    version_number=latest.version_number,
                    file_name=latest.file_name,
                    created_at=latest.created_at,
                    download_url=download_url,
                ),
            )
        )

    reverse = order == "desc"
    if sort_by == "created_at":
        results.sort(key=lambda d: d.created_at, reverse=reverse)
    elif sort_by == "title":
        results.sort(key=lambda d: d.title.lower(), reverse=reverse)
    else:
        results.sort(key=lambda d: d.latest_version.file_name.lower(), reverse=reverse)

    return results


@documentrouter.get("/{document_id}/versions", response_model=list[DocumentVersionOut])
async def list_document_versions(
    document_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """Returns full version history for a single document, newest first."""
    stmt = select(Document).where(
        Document.id == document_id, Document.owner_id == user_id
    )
    doc = db.scalars(stmt).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    bucket_name = "resumes" if doc.doc_type == "resume" else "cover_letters"
    out = []
    for v in doc.versions:
        try:
            signed = supabase.storage.from_(bucket_name).create_signed_url(
                v.storage_url, 900
            )
            download_url = signed.get("signedURL")
        except Exception:
            download_url = None
        out.append(
            DocumentVersionOut(
                id=v.id,
                version_number=v.version_number,
                file_name=v.file_name,
                created_at=v.created_at,
                download_url=download_url,
            )
        )
    return out



@documentrouter.post("/duplicate/{document_id}", status_code=201)
async def duplicate_document_request(
    document_id: int,
    payload: DocumentDuplicateRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Duplicates an existing document archetype alongside its complete history of version nodes.

    Queries the primary document key framework using an explicit eager joinedload strategy
    to prevent lazy-loading transaction evaluation drops. Clones the core tracking entry
    and iteratively recreates every historical child version record while duplicating its
    underlying binary asset cleanly within the targeted Supabase cloud storage buckets.

    Params:
        document_id (int): The database primary key of the source document row.
        payload (DocumentDuplicateRequest): Validated model payload housing the new metadata parameters.
        user_id (str): Extracted authenticated user token from dependency injection context.
        db (Session): Active context transaction handle mapping tracking queries to the DB engine.

    Returns:
        dict: A success message payload outlining completion metrics.
    """
    stmt = (
        select(Document)
        .where(Document.id == document_id, Document.owner_id == user_id)
        .options(joinedload(Document.versions))
    )
    original_doc = db.scalars(stmt).first()

    if not original_doc:
        raise HTTPException(status_code=404, detail="Source document not found or unauthorized.")

    if not original_doc.versions:
        raise HTTPException(status_code=400, detail="Source document has no active file versions to duplicate.")

    new_parent_doc = Document(
        owner_id=user_id,
        doc_type=payload.doc_type,
        title=payload.title,
        content=original_doc.content,
        job_snapshot=original_doc.job_snapshot,
    )
    db.add(new_parent_doc)
    db.flush()

    source_bucket = "resumes" if original_doc.doc_type == "resume" else "cover_letters"
    target_bucket = "resumes" if payload.doc_type == "resume" else "cover_letters"

    # Iteratively duplicate every single background version now that the list is populated
    cloned_versions_count = 0
    for old_version in original_doc.versions:
        timestamp = int(datetime.datetime.now().timestamp())
        file_ext = os.path.splitext(old_version.file_name or "")[1].lower()
        safe_file_name = f"{timestamp}_v{old_version.version_number}{file_ext}"
        target_file_path = f"users/{user_id}/{payload.doc_type}/{safe_file_name}"

        try:
            if source_bucket == target_bucket:
                supabase.storage.from_(source_bucket).copy(old_version.storage_url, target_file_path)
            else:
                file_bytes = supabase.storage.from_(source_bucket).download(old_version.storage_url)
                supabase.storage.from_(target_bucket).upload(
                    path=target_file_path,
                    file=file_bytes,
                    file_options={"content-type": "application/octet-stream"}
                )
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Cloud storage history copy halted: {str(e)}") from None

        # Build an independent database version row node linking back to our new parent skeleton
        new_version = DocumentVersion(
            document_id=new_parent_doc.id,
            version_number=old_version.version_number, # Retains accurate historical sequence numbers (v1, v2, etc)
            file_name=old_version.file_name,
            storage_url=target_file_path,
            content=old_version.content,
            job_snapshot=old_version.job_snapshot,
        )
        db.add(new_version)
        cloned_versions_count += 1

    db.commit()

    return {
        "message": "Document and complete historical version matrix duplicated successfully",
        "new_document_id": new_parent_doc.id,
        "total_versions_cloned": cloned_versions_count
    }
