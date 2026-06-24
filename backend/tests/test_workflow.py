"""Job-workflow tests: stage transitions and timeline events (S2-026).

These go through the real API (via the in-memory client fixture) to prove
the workflow behavior end to end.
"""

import time

import jwt


# ----- Helper to generate compliant test tokens -----
def create_test_token(clerk_str_id: str) -> dict:
    """Generate mock Authorization Bearer headers for testing."""
    payload = {"sub": clerk_str_id}
    # Encode with a dummy string key since backend uses verify_signature=False
    token_string = jwt.encode(payload, "test_secret_key", algorithm="HS256")
    return {"Authorization": f"Bearer {token_string}"}


USER_1 = create_test_token("1")


def _create(client, stage="Wishlist"):
    return client.post(
        "/api/jobs",
        json={"title": "Engineer", "company": "Dragon Corp", "stage": stage},
        headers=USER_1,
    ).json()


def test_stage_transition_persists(client):
    """A job advances through stages and each change persists (S2-BR-009)."""
    job = _create(client, "Wishlist")
    job_id = job["id"]
    assert job["stage"] == "Wishlist"

    for stage in ["Applied", "Interviewing", "Offer"]:
        updated = client.put(
            f"/api/jobs/{job_id}", json={"stage": stage}, headers=USER_1
        )
        assert updated.status_code == 200
        assert updated.json()["stage"] == stage
        # The change is durable on a fresh read.
        refetched = client.get(f"/api/jobs/{job_id}", headers=USER_1)
        assert refetched.json()["stage"] == stage


def test_stage_change_advances_last_activity(client):
    """Editing a job advances its last-activity timestamp (timeline event)."""
    job = _create(client, "Wishlist")
    job_id = job["id"]
    before = client.get(f"/api/jobs/{job_id}", headers=USER_1).json()["last_activity"]

    time.sleep(0.01)  # ensure a measurable time gap
    updated = client.put(
        f"/api/jobs/{job_id}", json={"stage": "Applied"}, headers=USER_1
    ).json()

    assert updated["last_activity"] > before
