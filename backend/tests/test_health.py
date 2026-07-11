"""Tests for the health endpoints the CD pipeline verifies (S3-017)."""


def test_root_health(client):
    """The root endpoint answers 200 with the health message."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.json() == {"message": "Backend testing"}


def test_version_reports_unknown_outside_render(client, monkeypatch):
    """Without RENDER_GIT_COMMIT set, /version still answers cleanly."""
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    res = client.get("/version")
    assert res.status_code == 200
    assert res.json() == {"commit": "unknown"}


def test_version_echoes_the_deployed_commit(client, monkeypatch):
    """With RENDER_GIT_COMMIT set (as on Render), /version reports it."""
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abc123def456")
    res = client.get("/version")
    assert res.status_code == 200
    assert res.json() == {"commit": "abc123def456"}
