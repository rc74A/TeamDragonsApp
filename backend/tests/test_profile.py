USER_1 = {"X-User-Id": "1"}
USER_2 = {"X-User-Id": "2"}

FULL_PROFILE = {
    "full_name": "Joel Walker",
    "email": "joel@example.com",
    "phone": "555-0100",
    "location": "Newark, NJ",
    "summary": "Aspiring software engineer.",
}


def test_get_returns_empty_baseline_when_unsaved(client):
    """A user with no saved profile gets an empty baseline shape."""
    res = client.get("/api/profile", headers=USER_1)
    assert res.status_code == 200
    body = res.json()
    assert body["owner_id"] == 1
    assert body["full_name"] == ""
    assert body["email"] == ""
    assert body["summary"] == ""


def test_create_and_retrieve_profile(client):
    """Happy path: a saved profile persists and is retrievable (S1-BR-010)."""
    saved = client.put("/api/profile", json=FULL_PROFILE, headers=USER_1)
    assert saved.status_code == 200
    assert saved.json()["full_name"] == "Joel Walker"
    assert saved.json()["owner_id"] == 1

    # Separate request proves persistence beyond the write call.
    fetched = client.get("/api/profile", headers=USER_1)
    assert fetched.status_code == 200
    assert fetched.json()["email"] == "joel@example.com"
    assert fetched.json()["location"] == "Newark, NJ"


def test_update_preserves_untouched_fields(client):
    """Editing one field persists it and keeps the rest (S1-BR-010)."""
    client.put("/api/profile", json=FULL_PROFILE, headers=USER_1)

    updated = client.put(
        "/api/profile",
        json={"summary": "Backend developer."},
        headers=USER_1,
    )
    assert updated.status_code == 200
    assert updated.json()["summary"] == "Backend developer."
    assert updated.json()["full_name"] == "Joel Walker"

    refetched = client.get("/api/profile", headers=USER_1)
    assert refetched.json()["summary"] == "Backend developer."
    # Untouched fields survive the round-trip, not just the updated one.
    assert refetched.json()["full_name"] == "Joel Walker"
    assert refetched.json()["email"] == "joel@example.com"


def test_invalid_email_is_rejected(client):
    """Validation: a malformed email fails with a field-level error."""
    res = client.put("/api/profile", json={"email": "not-an-email"}, headers=USER_1)
    assert res.status_code == 422
    error_fields = [error["loc"][-1] for error in res.json()["detail"]]
    assert "email" in error_fields

    # Nothing was persisted by the rejected write.
    assert client.get("/api/profile", headers=USER_1).json()["email"] == ""


def test_requests_without_identity_are_unauthorized(client):
    """Negative path: requests without X-User-Id are rejected (S1-BR-001)."""
    assert client.get("/api/profile").status_code == 401
    assert client.put("/api/profile", json=FULL_PROFILE).status_code == 401


def test_profiles_are_isolated_by_owner(client):
    """Ownership: a user cannot see another user's profile (S1-BR-006/007)."""
    client.put("/api/profile", json=FULL_PROFILE, headers=USER_1)

    # User 2 sees only their own (empty) profile, never user 1's data.
    other = client.get("/api/profile", headers=USER_2)
    assert other.status_code == 200
    assert other.json()["owner_id"] == 2
    assert other.json()["full_name"] == ""

    # User 2 writing their own profile does not touch user 1's.
    client.put("/api/profile", json={"full_name": "Someone Else"}, headers=USER_2)
    owner_view = client.get("/api/profile", headers=USER_1)
    assert owner_view.json()["full_name"] == "Joel Walker"
