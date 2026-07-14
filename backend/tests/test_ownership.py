"""Authorization and ownership enforcement tests (S3-020 / S3-BR-002).

Focuses on the critical paths that lacked cross-user coverage: the
job *sub-resources* (timeline, interviews, archive, restore) and the
entire documents router. Every owner-scoped endpoint must (a) reject
requests with no token and (b) return 404 — never another user's
data — when a different user targets a resource by id (S1-BR-007).
"""

import json

import jwt
import pytest


def create_test_token(clerk_str_id: str) -> dict:
    """Generate mock Authorization Bearer headers for testing."""
    payload = {"sub": clerk_str_id}
    token_string = jwt.encode(payload, "test_secret_key", algorithm="HS256")
    return {"Authorization": f"Bearer {token_string}"}


USER_1 = create_test_token("owner-1")
USER_2 = create_test_token("attacker-2")

JOB_PAYLOAD = {"title": "Engineer", "company": "Dragon Corp"}


def _make_job(client, headers=USER_1):
    """Create a job owned by the given user and return its id."""
    res = client.post("/api/jobs", json=JOB_PAYLOAD, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


# ----- Job sub-resources: cross-user access must 404 (S1-BR-007) -----

# (method, path template) for every owner-scoped job endpoint. The
# body is irrelevant: ownership is checked before the body is used.
JOB_SCOPED_ROUTES = [
    ("get", "/api/jobs/{id}"),
    ("put", "/api/jobs/{id}"),
    ("delete", "/api/jobs/{id}"),
    ("get", "/api/jobs/{id}/timeline"),
    ("get", "/api/jobs/{id}/interviews"),
    ("post", "/api/jobs/{id}/interviews"),
    ("post", "/api/jobs/{id}/archive"),
    ("post", "/api/jobs/{id}/restore"),
]


def _call(client, method, path, headers):
    """Issue a request with a minimal body for write methods."""
    fn = getattr(client, method)
    if method in ("post", "put"):
        return fn(path, json={}, headers=headers)
    return fn(path, headers=headers)


@pytest.mark.parametrize("method,template", JOB_SCOPED_ROUTES)
def test_job_subresource_denies_other_users(client, method, template):
    """User 2 targeting user 1's job by id gets 404, not user 1's data."""
    job_id = _make_job(client, USER_1)
    path = template.format(id=job_id)

    res = _call(client, method, path, USER_2)
    assert res.status_code == 404, f"{method.upper()} {template} leaked to another user"


@pytest.mark.parametrize("method,template", JOB_SCOPED_ROUTES)
def test_job_subresource_requires_a_token(client, method, template):
    """Every owner-scoped job endpoint rejects an unauthenticated call."""
    job_id = _make_job(client, USER_1)
    path = template.format(id=job_id)

    res = _call(client, method, path, {})
    assert res.status_code in (401, 403)


def test_denied_writes_do_not_mutate_the_owners_job(client):
    """A cross-user delete/archive attempt leaves the job intact."""
    job_id = _make_job(client, USER_1)

    assert client.delete(f"/api/jobs/{job_id}", headers=USER_2).status_code == 404
    assert client.post(f"/api/jobs/{job_id}/archive", headers=USER_2).status_code == 404

    # The owner still sees an active (non-archived) job.
    listed = client.get("/api/jobs", headers=USER_1).json()
    assert any(job["id"] == job_id for job in listed)


def test_job_list_and_metrics_are_owner_scoped(client):
    """User 2 never sees user 1's jobs in list/metrics aggregates."""
    _make_job(client, USER_1)

    assert client.get("/api/jobs", headers=USER_2).json() == []
    assert client.get("/api/jobs/metrics", headers=USER_2).json()["total"] == 0


# ----- Documents router: owner-scoped, Supabase stubbed out -----


@pytest.fixture
def stub_supabase(monkeypatch):
    """Replace the Supabase client so uploads never touch the network."""
    from unittest.mock import MagicMock

    fake = MagicMock()
    fake.storage.from_.return_value.create_signed_url.return_value = {
        "signedURL": "https://example.test/signed"
    }
    monkeypatch.setattr("documents.supabase", fake)
    return fake


def _upload_document(client, headers, title="My Resume"):
    """Upload one document version for a user; return its document id."""
    payload = {
        "doc_type": "resume",
        "title": title,
        "content": "resume body",
        "job_snapshot": "{}",
        "file_name": "resume.txt",
    }
    res = client.post(
        "/api/documents",
        files={"file": ("resume.txt", b"hello world", "text/plain")},
        data={"payload_str": json.dumps(payload)},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["document_id"]


# (method, path template, needs json body) for owner-scoped doc endpoints.
DOCUMENT_SCOPED_ROUTES = [
    ("get", "/api/documents/{id}/versions", False),
    ("post", "/api/documents/{id}/archive", False),
    ("post", "/api/documents/{id}/restore", False),
    ("post", "/api/documents/duplicate/{id}", True),
]


def test_document_list_requires_a_token(client):
    """Listing documents without a token is rejected."""
    assert client.get("/api/documents").status_code in (401, 403)


@pytest.mark.parametrize("method,template,needs_body", DOCUMENT_SCOPED_ROUTES)
def test_document_subresource_requires_a_token(client, method, template, needs_body):
    """Every owner-scoped document endpoint rejects an unauthenticated call."""
    fn = getattr(client, method)
    path = template.format(id=1)
    res = fn(path, json={}) if needs_body else fn(path)
    assert res.status_code in (401, 403)


@pytest.mark.parametrize("method,template,needs_body", DOCUMENT_SCOPED_ROUTES)
def test_document_subresource_denies_other_users(
    client, stub_supabase, method, template, needs_body
):
    """User 2 targeting user 1's document by id gets 404 (S1-BR-007)."""
    doc_id = _upload_document(client, USER_1)
    path = template.format(id=doc_id)
    fn = getattr(client, method)

    body = {"title": "Stolen", "doc_type": "resume"} if needs_body else None
    res = (
        fn(path, json=body, headers=USER_2) if needs_body else fn(path, headers=USER_2)
    )
    assert res.status_code == 404


def test_document_list_is_owner_scoped(client, stub_supabase):
    """User 1's uploaded document never appears in user 2's list."""
    _upload_document(client, USER_1, title="Owner Resume")

    assert client.get("/api/documents", headers=USER_2).json() == []
    owner_docs = client.get("/api/documents", headers=USER_1).json()
    assert any(doc["title"] == "Owner Resume" for doc in owner_docs)
