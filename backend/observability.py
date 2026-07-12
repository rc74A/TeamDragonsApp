"""Centralized error handling and request logging (S3-018).

Every request gets a short request id that travels through the log
lines, the X-Request-ID response header, and (for unhandled errors)
the JSON error body — so a user-reported failure can be matched to
the exact traceback in the Render logs (S3-BR-019).

Unhandled exceptions become a clean, consistent 500 JSON response
instead of leaking a traceback; FastAPI's own shapes for expected
errors (401/404/422 ``{"detail": ...}``) are left untouched.
"""

import logging
import time
import traceback
import uuid

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"

logger = logging.getLogger("teamdragons")


def setup_logging() -> None:
    """Configure structured stdout logging once, playing nice with uvicorn.

    uvicorn attaches handlers to its own loggers, not the root logger,
    so configuring the root here doesn't duplicate its output.
    """
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    logger.setLevel(logging.INFO)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Tag every request with an id, time it, log it, and convert
    unhandled exceptions into a consistent JSON 500.
    """

    async def dispatch(self, request, call_next):
        """Run one request with logging and last-resort error handling.

        Args:
            request: The incoming request.
            call_next: The downstream handler chain.

        Returns:
            Response: The downstream response, or a clean JSON 500
                carrying the request id when something blew up.
        """
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "request_id=%s method=%s path=%s status=500 duration_ms=%.0f "
                "unhandled exception:\n%s",
                request_id,
                request.method,
                request.url.path,
                duration_ms,
                traceback.format_exc(),
            )
            response = JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "request_id": request_id,
                },
            )
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(
                level,
                "request_id=%s method=%s path=%s status=%s duration_ms=%.0f",
                request_id,
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )

        response.headers["X-Request-ID"] = request_id
        return response


def setup_observability(app: FastAPI) -> None:
    """Attach logging and the request-context middleware to the app.

    Call this BEFORE adding CORSMiddleware: the last middleware added
    is the outermost, and CORS must stay outermost so even our 500
    responses carry CORS headers the browser will accept.

    Args:
        app (FastAPI): The application to instrument.
    """
    setup_logging()
    app.add_middleware(RequestContextMiddleware)
