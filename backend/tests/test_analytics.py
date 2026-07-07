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


def _create_job(client, headers, title="Engineer", stage="Interested"):
    """Create a job in an explicit stage for a test user."""
    return client.post(
        "/api/jobs",
        json={"title": title, "company": "Dragon Corp", "stage": stage},
        headers=headers,
    ).json()


def _move(client, headers, job_id, stage):
    """Advance a job to a new stage, logging a history event (S2-009)."""
    res = client.put(f"/api/jobs/{job_id}", json={"stage": stage}, headers=headers)
    assert res.status_code == 200
    return res


def test_analytics_empty_for_new_user(client):
    """A user with no jobs gets zeroed analytics, not an error."""
    res = client.get("/api/jobs/analytics", headers=USER_1)
    assert res.status_code == 200
    body = res.json()
    assert all(count == 0 for count in body["funnel"].values())
    assert [c["rate"] for c in body["conversion"]] == [0.0, 0.0, 0.0]
    assert all(d["samples"] == 0 for d in body["time_in_stage"])


def test_analytics_funnel_and_conversion_from_events(client):
    """Stage moves recorded by S2-009 drive funnel and conversion (S3-BR-013)."""
    a = _create_job(client, USER_1, title="A")
    _create_job(client, USER_1, title="B")
    _move(client, USER_1, a["id"], "Applied")
    _move(client, USER_1, a["id"], "Interview")

    body = client.get("/api/jobs/analytics", headers=USER_1).json()
    assert body["funnel"]["Interested"] == 2
    assert body["funnel"]["Applied"] == 1
    assert body["funnel"]["Interview"] == 1

    steps = {(c["from_stage"], c["to_stage"]): c["rate"] for c in body["conversion"]}
    assert steps[("Interested", "Applied")] == 0.5
    assert steps[("Applied", "Interview")] == 1.0

    # Completed intervals exist for the stages the job moved through.
    dwell = {d["stage"]: d for d in body["time_in_stage"]}
    assert dwell["Interested"]["samples"] == 1
    assert dwell["Applied"]["samples"] == 1
    assert dwell["Interested"]["avg_days"] >= 0.0


def test_analytics_ignores_outcome_events(client):
    """Outcome changes log 'Outcome: ...' rows that must not skew analytics."""
    job = _create_job(client, USER_1)
    _move(client, USER_1, job["id"], "Applied")
    res = client.put(
        f"/api/jobs/{job['id']}",
        json={"outcome_state": "Accepted"},
        headers=USER_1,
    )
    assert res.status_code == 200

    body = client.get("/api/jobs/analytics", headers=USER_1).json()
    assert "Outcome: Accepted" not in body["funnel"]
    assert body["funnel"]["Applied"] == 1


def test_analytics_is_owner_scoped(client):
    """User 2 sees zeroes while user 1 has history (S1-BR-007)."""
    job = _create_job(client, USER_1)
    _move(client, USER_1, job["id"], "Applied")

    body = client.get("/api/jobs/analytics", headers=USER_2).json()
    assert all(count == 0 for count in body["funnel"].values())
    assert all(d["samples"] == 0 for d in body["time_in_stage"])


def test_analytics_requires_identity(client):
    """Negative path: requests without a token are rejected (S1-BR-001)."""
    assert client.get("/api/jobs/analytics").status_code in (401, 403)
