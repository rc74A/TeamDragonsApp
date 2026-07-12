"""Tests for centralized error handling and logging (S3-018 / S3-BR-019).

The unhandled-exception cases use a small throwaway FastAPI app so no
crashing route has to live in the production router set.
"""

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from observability import setup_observability


def _crashy_app():
    """Build a minimal instrumented app with one healthy and one
    crashing route.
    """
    app = FastAPI()
    setup_observability(app)

    @app.get("/ok")
    async def ok() -> dict:
        return {"fine": True}

    @app.get("/boom")
    async def boom() -> dict:
        raise RuntimeError("kaboom: secret internals")

    return app


def test_success_responses_carry_a_request_id(client):
    """Every real-app response carries an X-Request-ID header."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.headers.get("X-Request-ID")


def test_expected_error_shapes_are_unchanged(client):
    """FastAPI's own {"detail": ...} shape for expected errors stays,
    now with the request id header on top (S1-BR-001 responses etc.).
    """
    res = client.get("/api/jobs")  # no token
    assert res.status_code in (401, 403)
    assert "detail" in res.json()
    assert res.headers.get("X-Request-ID")


def test_unhandled_exception_becomes_clean_json_500():
    """A crash returns a consistent JSON 500 with the request id and
    without leaking the exception message or traceback.
    """
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    res = test_client.get("/boom")

    assert res.status_code == 500
    body = res.json()
    assert body["detail"] == "Internal server error"
    assert body["request_id"] == res.headers["X-Request-ID"]
    assert "kaboom" not in res.text  # internals stay out of the response


def test_unhandled_exception_is_logged_with_context(caplog):
    """The crash is logged with the request id, path, and traceback so
    Render logs answer "what broke" (S3-BR-019).
    """
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    with caplog.at_level(logging.ERROR, logger="teamdragons"):
        res = test_client.get("/boom")

    request_id = res.headers["X-Request-ID"]
    error_logs = [r.getMessage() for r in caplog.records if r.levelno >= logging.ERROR]
    assert any(
        f"request_id={request_id}" in m
        and "path=/boom" in m
        and "RuntimeError: kaboom" in m
        for m in error_logs
    )


def test_requests_are_access_logged(caplog):
    """Normal requests produce a structured access line with id,
    method, path, status, and duration.
    """
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    with caplog.at_level(logging.INFO, logger="teamdragons"):
        res = test_client.get("/ok")

    request_id = res.headers["X-Request-ID"]
    messages = [r.getMessage() for r in caplog.records]
    assert any(
        f"request_id={request_id}" in m
        and "method=GET" in m
        and "path=/ok" in m
        and "status=200" in m
        and "duration_ms=" in m
        for m in messages
    )
