import jwt


# ----- Helper to generate compliant test tokens -----
def create_test_token(clerk_str_id: str) -> dict:
    """Generate mock Authorization Bearer headers for testing."""
    payload = {"sub": clerk_str_id}
    # Encode with an empty string key to match options={"verify_signature": False}
    token_string = jwt.encode(payload, "test_secret_key", algorithm="HS256")
    return {"Authorization": f"Bearer {token_string}"}


USER_1 = create_test_token("1")
USER_2 = create_test_token("2")

JOB_PAYLOAD = {
    "title": "Software Engineer",
    "company": "Dragon Corp",
    "description": "Description",
}


def test_create_and_retrieve_job(client):
    """Happy path: a created job is stored and retrievable (S1-BR-013)."""
    created = client.post("/api/jobs", json=JOB_PAYLOAD, headers=USER_1)
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Software Engineer"
    assert body["company"] == "Dragon Corp"
    assert body["stage"] == "Saved"
    assert body["description"] == "Description"

    # 🔄 FIX 2: Owner ID is now verified and returned as a string
    assert body["owner_id"] == "1"
    assert body["last_activity"] is not None

    # Separate request proves persistence beyond the create call.
    listed = client.get("/api/jobs", headers=USER_1)
    assert listed.status_code == 200
    jobs = listed.json()
    assert len(jobs) == 1
    assert jobs[0]["id"] == body["id"]

    fetched = client.get(f"/api/jobs/{body['id']}", headers=USER_1)
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Software Engineer"


def test_update_job_persists_and_bumps_activity(client):
    """Editing an owned job persists changes (S1-BR-013)."""
    job = client.post("/api/jobs", json=JOB_PAYLOAD, headers=USER_1).json()

    updated = client.put(
        f"/api/jobs/{job['id']}",
        json={"stage": "Applied"},
        headers=USER_1,
    )
    assert updated.status_code == 200
    assert updated.json()["stage"] == "Applied"
    assert updated.json()["title"] == "Software Engineer"
    assert updated.json()["last_activity"] >= job["last_activity"]

    fetched = client.get(f"/api/jobs/{job['id']}", headers=USER_1)
    assert fetched.json()["stage"] == "Applied"


def test_create_rejects_blank_fields(client):
    """Validation: blank required fields fail with field-level errors."""
    response = client.post(
        "/api/jobs",
        json={"title": "   ", "company": "Dragon Corp"},
        headers=USER_1,
    )
    assert response.status_code == 422
    error_fields = [error["loc"][-1] for error in response.json()["detail"]]
    assert "title" in error_fields

    response = client.post("/api/jobs", json={"title": "Engineer"}, headers=USER_1)
    assert response.status_code == 422
    error_fields = [error["loc"][-1] for error in response.json()["detail"]]
    assert "company" in error_fields


def test_requests_without_identity_are_unauthorized(client):
    """Negative path: requests without valid token headers are rejected (S1-BR-001)."""
    assert client.get("/api/jobs").status_code == 401
    assert client.post("/api/jobs", json=JOB_PAYLOAD).status_code == 401


def test_cross_user_access_is_denied(client):
    """Ownership: user 2 cannot read or write user 1's job (S1-BR-007)."""
    job = client.post("/api/jobs", json=JOB_PAYLOAD, headers=USER_1).json()

    assert client.get(f"/api/jobs/{job['id']}", headers=USER_2).status_code == 404
    assert (
        client.put(
            f"/api/jobs/{job['id']}",
            json={"stage": "Offer"},
            headers=USER_2,
        ).status_code
        == 404
    )
    assert client.get("/api/jobs", headers=USER_2).json() == []

    # Owner's record is unchanged by the denied write.
    fetched = client.get(f"/api/jobs/{job['id']}", headers=USER_1)
    assert fetched.json()["stage"] == "Saved"


def test_update_interview_notes_success(client):
    """Happy Path Test- Targets the main PUT Endpoint."""
    job = client.post("/api/jobs", json=JOB_PAYLOAD, headers=USER_1).json()
    response = client.put(
        f"/api/jobs/{job['id']}",
        json={
            "title": job["title"],
            "company": job["company"],
            "stage": job["stage"],
            "interview_notes": "Remember to ask the employer some questions",
        },
        headers=USER_1,
    )
    assert response.status_code == 200
    data = response.json()

    # Verifies that the notes are saved with time stamps
    assert data["interview_notes"] == "Remember to ask the employer some questions"
    assert "notes_updated_at" in data


def test_update_interview_notes_invalid_job(client):
    """Edge Case/Failure Test - Fake ID targets main PUT Endpoint."""
    response = client.put(
        "/api/jobs/99999",
        json={
            "title": "False Title",
            "company": "False Company",
            "stage": "Applied",
            "interview_notes": "This shouldn't save anything",
        },
        headers=USER_1,
    )
    assert response.status_code == 404

def test_update_research_notes_success(client):
    """Happy Path Test- Targets the main PUT Endpoint for Company Research """
    job = client.post("/api/jobs", json=JOB_PAYLOAD, headers=USER_1).json()
    response = client.put(
        f"/api/jobs/{job['id']}",
        json={
            "title": job["title"],
            "company": job["company"],
            "stage": job["stage"],
            "research_notes": "Questions, Statistics, and Reviews about the Company",
        },
        headers=USER_1,
    )
    assert response.status_code == 200
    data = response.json()

    # Verifies that the research notes are saved with timestamps
    assert data["research_notes"] == "Questions, Statistics, and Reviews about the Company"
    assert "research_updated_at" in data

def test_update_research_notes_invalid_job(client):
    """Edge Case/Failure Test - Fake ID targets main PUT Endpoint."""
    response = client.put(
    "/api/jobs/99999",
        json={
            "title": "False Title",
            "company": "False Company",
            "stage": "Applied",
            "research_notes": "This shouldn't save anything",
        },
        headers=USER_1,
    )
    assert response.status_code == 404
    
