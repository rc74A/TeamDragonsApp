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


def _create(client, headers, school="MIT", degree="B.S.", **fields):
    """Create an education record for a test user."""
    return client.post(
        "/api/education",
        json={"school": school, "degree": degree, **fields},
        headers=headers,
    )


def test_create_and_list_in_order(client):
    """Created records are listed in insertion (position) order (S2-017)."""
    a = _create(client, USER_1, school="MIT", degree="B.S.").json()
    b = _create(client, USER_1, school="NJIT", degree="M.S.").json()
    assert a["position"] == 0
    assert b["position"] == 1
    assert a["field_of_study"] == ""

    listed = client.get("/api/education", headers=USER_1).json()
    assert [e["school"] for e in listed] == ["MIT", "NJIT"]


def test_update_record(client):
    """An owned record can be partially updated (S2-017)."""
    record = _create(client, USER_1, school="NJIT").json()
    updated = client.put(
        f"/api/education/{record['id']}",
        json={"degree": "Ph.D.", "gpa": "3.9"},
        headers=USER_1,
    )
    assert updated.status_code == 200
    assert updated.json()["degree"] == "Ph.D."
    assert updated.json()["gpa"] == "3.9"
    # School was not in the payload, so it is preserved.
    assert updated.json()["school"] == "NJIT"


def test_delete_record(client):
    """An owned record can be deleted and is then gone (S2-017)."""
    record = _create(client, USER_1).json()
    res = client.delete(f"/api/education/{record['id']}", headers=USER_1)
    assert res.status_code == 204
    assert client.get("/api/education", headers=USER_1).json() == []


def test_reorder_records(client):
    """Records can be reordered by id and the order persists (S2-BR-017)."""
    a = _create(client, USER_1, school="A").json()
    b = _create(client, USER_1, school="B").json()
    c = _create(client, USER_1, school="C").json()

    reordered = client.put(
        "/api/education/reorder",
        json={"order": [c["id"], a["id"], b["id"]]},
        headers=USER_1,
    )
    assert reordered.status_code == 200
    assert [e["school"] for e in reordered.json()] == ["C", "A", "B"]

    listed = client.get("/api/education", headers=USER_1).json()
    assert [e["school"] for e in listed] == ["C", "A", "B"]


def test_validation_rejects_blank_required_fields(client):
    """Validation: blank school or degree fails (S2-BR-015)."""
    blank_school = client.post(
        "/api/education",
        json={"school": "   ", "degree": "B.S."},
        headers=USER_1,
    )
    assert blank_school.status_code == 422

    blank_degree = client.post(
        "/api/education",
        json={"school": "MIT", "degree": ""},
        headers=USER_1,
    )
    assert blank_degree.status_code == 422

    missing_degree = client.post(
        "/api/education",
        json={"school": "MIT"},
        headers=USER_1,
    )
    assert missing_degree.status_code == 422


def test_requests_without_identity_are_unauthorized(client):
    """Negative path: requests without X-User-Id are rejected (S1-BR-001)."""
    assert client.get("/api/education").status_code == 401
    assert (
        client.post(
            "/api/education", json={"school": "MIT", "degree": "B.S."}
        ).status_code
        == 401
    )


def test_records_are_owner_scoped(client):
    """Ownership: user 2 cannot read/edit/delete user 1's record (S1-BR-007)."""
    record = _create(client, USER_1, school="Mine").json()

    assert client.get("/api/education", headers=USER_2).json() == []
    assert (
        client.put(
            f"/api/education/{record['id']}",
            json={"school": "Hacked"},
            headers=USER_2,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/education/{record['id']}", headers=USER_2).status_code
        == 404
    )
    # The owner's record is untouched by the denied writes.
    assert client.get("/api/education", headers=USER_1).json()[0]["school"] == "Mine"
