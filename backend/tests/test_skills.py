USER_1 = {"X-User-Id": "1"}
USER_2 = {"X-User-Id": "2"}


def _create(client, headers, name="Python", **fields):
    """Create a skill for a test user."""
    return client.post(
        "/api/skills", json={"name": name, **fields}, headers=headers
    )


def test_create_and_list_in_order(client):
    """Created skills are listed in insertion (position) order (S2-018)."""
    a = _create(client, USER_1, name="Python", category="Language").json()
    b = _create(client, USER_1, name="FastAPI", proficiency="Advanced").json()
    assert a["position"] == 0
    assert b["position"] == 1
    # Optional fields default to empty (unspecified).
    assert a["proficiency"] == ""
    assert b["category"] == ""

    listed = client.get("/api/skills", headers=USER_1).json()
    assert [s["name"] for s in listed] == ["Python", "FastAPI"]


def test_update_skill(client):
    """An owned skill can be partially updated (S2-018)."""
    skill = _create(client, USER_1, name="SQL").json()
    updated = client.put(
        f"/api/skills/{skill['id']}",
        json={"proficiency": "Expert", "category": "Databases"},
        headers=USER_1,
    )
    assert updated.status_code == 200
    assert updated.json()["proficiency"] == "Expert"
    assert updated.json()["category"] == "Databases"
    # Name was not in the payload, so it is preserved.
    assert updated.json()["name"] == "SQL"


def test_delete_skill(client):
    """An owned skill can be deleted and is then gone (S2-018)."""
    skill = _create(client, USER_1).json()
    res = client.delete(f"/api/skills/{skill['id']}", headers=USER_1)
    assert res.status_code == 204
    assert client.get("/api/skills", headers=USER_1).json() == []


def test_reorder_skills(client):
    """Skills can be reordered by id and the order persists (S2-BR-017)."""
    a = _create(client, USER_1, name="A").json()
    b = _create(client, USER_1, name="B").json()
    c = _create(client, USER_1, name="C").json()

    reordered = client.put(
        "/api/skills/reorder",
        json={"order": [c["id"], a["id"], b["id"]]},
        headers=USER_1,
    )
    assert reordered.status_code == 200
    assert [s["name"] for s in reordered.json()] == ["C", "A", "B"]

    listed = client.get("/api/skills", headers=USER_1).json()
    assert [s["name"] for s in listed] == ["C", "A", "B"]


def test_reorder_ignores_unowned_ids(client):
    """Reorder silently drops ids the user doesn't own (S2-BR-017)."""
    a = _create(client, USER_1, name="A").json()
    b = _create(client, USER_1, name="B").json()
    c = _create(client, USER_1, name="C").json()

    # 99999 does not exist; it must be ignored, not crash or reposition.
    reordered = client.put(
        "/api/skills/reorder",
        json={"order": [c["id"], 99999, a["id"], b["id"]]},
        headers=USER_1,
    )
    assert reordered.status_code == 200
    assert [s["name"] for s in reordered.json()] == ["C", "A", "B"]


def test_reorder_is_owner_scoped(client):
    """User 2 cannot reorder user 1's skills via /reorder (S1-BR-007)."""
    a = _create(client, USER_1, name="A").json()
    b = _create(client, USER_1, name="B").json()
    c = _create(client, USER_1, name="C").json()

    # User 2 owns nothing, so passing user 1's ids is a no-op for user 2.
    res = client.put(
        "/api/skills/reorder",
        json={"order": [c["id"], b["id"], a["id"]]},
        headers=USER_2,
    )
    assert res.status_code == 200
    assert res.json() == []

    # User 1's original order is untouched.
    listed = client.get("/api/skills", headers=USER_1).json()
    assert [s["name"] for s in listed] == ["A", "B", "C"]


def test_validation_rejects_blank_name_and_bad_proficiency(client):
    """Validation: blank name and invalid proficiency fail on create (S2-BR-016)."""
    blank = client.post("/api/skills", json={"name": "   "}, headers=USER_1)
    assert blank.status_code == 422

    bad_prof = client.post(
        "/api/skills",
        json={"name": "Go", "proficiency": "Wizard"},
        headers=USER_1,
    )
    assert bad_prof.status_code == 422


def test_update_validation_rejects_blank_name_and_bad_proficiency(client):
    """The same validation guards the update path, not just create (S2-BR-016)."""
    skill = _create(client, USER_1, name="Go").json()

    blank_name = client.put(
        f"/api/skills/{skill['id']}", json={"name": "   "}, headers=USER_1
    )
    assert blank_name.status_code == 422

    bad_prof = client.put(
        f"/api/skills/{skill['id']}",
        json={"proficiency": "Wizard"},
        headers=USER_1,
    )
    assert bad_prof.status_code == 422

    # A valid level still updates cleanly.
    ok = client.put(
        f"/api/skills/{skill['id']}",
        json={"proficiency": "Expert"},
        headers=USER_1,
    )
    assert ok.status_code == 200
    assert ok.json()["proficiency"] == "Expert"


def test_empty_proficiency_is_allowed(client):
    """Proficiency is optional: an omitted/blank value is accepted (S2-BR-016)."""
    created = client.post("/api/skills", json={"name": "Rust"}, headers=USER_1)
    assert created.status_code == 201
    assert created.json()["proficiency"] == ""


def test_requests_without_identity_are_unauthorized(client):
    """Negative path: requests without X-User-Id are rejected (S1-BR-001)."""
    assert client.get("/api/skills").status_code == 401
    assert client.post("/api/skills", json={"name": "X"}).status_code == 401


def test_skills_are_owner_scoped(client):
    """Ownership: user 2 cannot read/edit/delete user 1's skill (S1-BR-007)."""
    skill = _create(client, USER_1, name="Mine").json()

    assert client.get("/api/skills", headers=USER_2).json() == []
    assert (
        client.put(
            f"/api/skills/{skill['id']}",
            json={"name": "Hacked"},
            headers=USER_2,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/skills/{skill['id']}", headers=USER_2).status_code == 404
    )
    # The owner's skill is untouched by the denied writes.
    assert client.get("/api/skills", headers=USER_1).json()[0]["name"] == "Mine"
