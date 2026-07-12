"""Tests for centralized error handling and logging (S3-018 / S3-BR-019).

The unhandled-exception cases use a small throwaway FastAPI app so no
crashing route has to live in the production router set.
"""

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from observability import setup_observability

_TEST_ORIGIN = "http://testorigin.example"


def _crashy_app():
    """Build a minimal instrumented app mirroring main.py's wiring:
    observability first, CORS added after (so CORS is outermost).
    """
    app = FastAPI()
    setup_observability(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[_TEST_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.get("/ok")
    async def ok() -> dict:
        return {"fine": True}

    @app.get("/boom")
    async def boom() -> dict:
        raise RuntimeError("kaboom: secret internals")

    @app.get("/teapot")
    async def teapot() -> dict:
        raise HTTPException(status_code=418, detail="short and stout")

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


def test_500s_keep_cors_headers(caplog):
    """The middleware-generated 500 passes back out through CORS, so a
    browser on the frontend origin can read it. Pins the load-bearing
    ordering: setup_observability before CORSMiddleware.
    """
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    res = test_client.get("/boom", headers={"Origin": _TEST_ORIGIN})

    assert res.status_code == 500
    assert res.headers.get("access-control-allow-origin") == _TEST_ORIGIN
    assert res.headers.get("X-Request-ID")


def test_expected_4xx_gets_warning_access_line(caplog):
    """HTTPExceptions skip the crash path and log as WARNING access
    lines, keeping their FastAPI response shape.
    """
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    with caplog.at_level(logging.INFO, logger="teamdragons"):
        res = test_client.get("/teapot")

    assert res.status_code == 418
    assert res.json() == {"detail": "short and stout"}
    warning_lines = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any(
        "path=/teapot" in r.getMessage() and "status=418" in r.getMessage()
        for r in warning_lines
    )


def test_request_ids_are_unique_per_request():
    """Two requests never share a request id."""
    test_client = TestClient(_crashy_app(), raise_server_exceptions=False)
    first = test_client.get("/ok").headers["X-Request-ID"]
    second = test_client.get("/ok").headers["X-Request-ID"]
    assert first and second and first != second


def test_logger_survives_programmatic_migrations(tmp_path):
    """Running migrations at startup must not disable the app logger:
    alembic's fileConfig would normally switch it off for the whole
    process lifetime (the production-only S3-016/S3-018 interaction).
    """
    from migration_runner import run_migrations
    from observability import setup_logging

    setup_logging()
    run_migrations(f"sqlite:///{(tmp_path / 'obs.db').as_posix()}")

    app_logger = logging.getLogger("teamdragons")
    assert app_logger.disabled is False
    assert app_logger.isEnabledFor(logging.ERROR)
