import jwt


# ----- Helper to generate compliant test tokens -----
def create_test_token(clerk_str_id: str) -> dict:
    """Generate mock Authorization Bearer headers for testing."""
    payload = {"sub": clerk_str_id}
    # Encode with a dummy string key since backend uses verify_signature=False
    token_string = jwt.encode(payload, "test_secret_key", algorithm="HS256")
    return {"Authorization": f"Bearer {token_string}"}


USER_1 = create_test_token("1")
USER_2 = create_test_token("2")


def _create(client, headers, stage):
    """Create a job in a given stage for the test user."""
    return client.post(
        "/api/jobs",
        json={"title": "Engineer", "company": "Dragon Corp", "stage": stage},
        headers=headers,
    )


def test_metrics_empty_for_new_user(client):
    """A user with no jobs gets zeroed metrics (S2-025)."""
    res = client.get("/api/jobs/metrics", headers=USER_1)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 0
    assert body["applications"] == 0
    assert body["response_rate"] == 0.0


def test_metrics_counts_stages_and_response_rate(client):
    """Metrics tally per-stage counts and the response rate (S2-025)."""
    for stage in [
        "Interested",
        "Applied",
        "Interview",
        "Offer",
        "Rejected",
        "Archived",
    ]:
        _create(client, USER_1, stage)

    m = client.get("/api/jobs/metrics", headers=USER_1).json()
    assert m["total"] == 6
    assert m["by_stage"]["Applied"] == 1
    assert m["by_stage"]["Interview"] == 1
    assert m["by_stage"]["Offer"] == 1
    assert m["by_stage"]["Rejected"] == 1
    assert m["by_stage"]["Wishlist"] == 1
    # applications = Applied(2) + Interviewing + Offer + Rejected = 5
    assert m["applications"] == 4
    # responses = Interviewing + Offer + Rejected = 3
    assert m["responses"] == 3
    assert m["offers"] == 1
    assert m["response_rate"] == 0.6  # 3 / 5


def test_metrics_are_owner_scoped(client):
    """Metrics only count the requesting user's own jobs (S2-BR-022)."""
    _create(client, USER_1, "Offer")
    _create(client, USER_1, "Applied")

    assert client.get("/api/jobs/metrics", headers=USER_2).json()["total"] == 0
    assert client.get("/api/jobs/metrics", headers=USER_1).json()["total"] == 2


def test_metrics_requires_auth(client):
    """Negative: metrics can't be read without an identity."""
    assert client.get("/api/jobs/metrics").status_code == 401
