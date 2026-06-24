import jwt

# ----- Helper to generate compliant test tokens -----
def create_test_token(clerk_str_id: str) -> dict:
    """Generate mock Authorization Bearer headers for testing."""
    payload = {"sub": clerk_str_id}
    # Encode with an empty string key to match options={"verify_signature": False}
    token_string = jwt.encode(payload, "", algorithm="HS256")
    return {"Authorization": f"Bearer {token_string}"}


USER_1 = create_test_token("1")
USER_2 = create_test_token("2")


def _create(client, headers, title="Software Engineer", **fields):
    """Create an experience entry for a test user."""
    return client.post(
        "/api/experience", json={"title": title, **fields}, headers=headers
    )


def test_create_and_list_in_order(client):
    """Created entries are listed in insertion (position) order (S2-016)."""
    a = _create(client, USER_1, title="First", organization="Acme").json()
    b = _create(client, USER_1, title="Second", organization="Globex").json()
    assert a["position"] == 0
    assert b["position"] == 1
    assert a["entry_type"] == "employment"

    listed = client.get("/api/experience", headers=USER_1).json()
    assert [e["title"] for e in listed] == ["First", "Second"]


def test_update_entry(client):
    """An owned entry can be partially updated (S2-016)."""
    entry = _create(client, USER_1, title="Intern").json()
    updated = client.put(
        f"/api/experience/{entry['id']}",
        json={"title": "Senior Engineer", "end_date": "2025"},
        headers=USER_1,
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Senior Engineer"
    assert updated.json()["end_date"] == "2025"


def test_delete_entry(client):
    """An owned entry can be deleted and is then gone (S2-016)."""
    entry = _create(client, USER_1, title="Temp").json()
    res = client.delete(f"/api/experience/{entry['id']}", headers=USER_1)
    assert res.status_code == 204
    assert client.get("/api/experience", headers=USER_1).json() == []


def test_reorder_entries(client):
    """Entries can be reordered by id and the order persists (S2-BR-017)."""
    a = _create(client, USER_1, title="A").json()
    b = _create(client, USER_1, title="B").json()
    c = _create(client, USER_1, title="C").json()

    reordered = client.put(
        "/api/experience/reorder",
        json={"order": [c["id"], a["id"], b["id"]]},
        headers=USER_1,
    )
    assert reordered.status_code == 200
    assert [e["title"] for e in reordered.json()] == ["C", "A", "B"]

    listed = client.get("/api/experience", headers=USER_1).json()
    assert [e["title"] for e in listed] == ["C", "A", "B"]


def test_validation_rejects_blank_title_and_bad_type(client):
    """Validation: blank title and invalid entry_type fail (S2-BR-015)."""
    blank = client.post("/api/experience", json={"title": "   "}, headers=USER_1)
    assert blank.status_code == 422

    bad_type = client.post(
        "/api/experience",
        json={"title": "Engineer", "entry_type": "hobby"},
        headers=USER_1,
    )
    assert bad_type.status_code == 422


def test_requests_without_identity_are_unauthorized(client):
    """Negative path: requests without valid token headers are rejected (S1-BR-001)."""
    assert client.get("/api/experience").status_code == 401
    assert client.post("/api/experience", json={"title": "X"}).status_code == 401


def test_entries_are_owner_scoped(client):
    """Ownership: user 2 cannot read/edit/delete user 1's entry (S1-BR-007)."""
    entry = _create(client, USER_1, title="Mine").json()

    assert client.get("/api/experience", headers=USER_2).json() == []
    assert (
        client.put(
            f"/api/experience/{entry['id']}",
            json={"title": "Hacked"},
            headers=USER_2,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/experience/{entry['id']}", headers=USER_2).status_code
        == 404
    )
    # The owner's entry is untouched by the denied writes.
    assert client.get("/api/experience", headers=USER_1).json()[0]["title"] == "Mine"

