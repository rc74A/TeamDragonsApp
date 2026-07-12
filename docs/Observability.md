# Error handling and logging (S3-018)

## What happens when something breaks

**Backend.** Every request is tagged with a short request id
(`X-Request-ID` response header) and logged as a structured line:

```
2026-07-12 14:03:11 INFO teamdragons request_id=a1b2c3d4e5f6 method=GET path=/api/jobs status=200 duration_ms=42
```

An unhandled exception (a bug, a DB failure) no longer leaks a bare
500. The client gets a consistent, safe body:

```json
{"detail": "Internal server error", "request_id": "a1b2c3d4e5f6"}
```

and the full traceback is logged under the same request id. Expected
errors (401/404/422) keep FastAPI's normal `{"detail": ...}` shape —
nothing existing changes shape.

**Frontend.** The root `ErrorBoundary` in `frontend/app/root.tsx`
renders a fallback page instead of a blank screen when a route
crashes, and logs the error (`[route-error]`) to the browser console —
and to Vercel's function logs when the crash happens during SSR.

## Tracing a user-reported error

1. Ask for (or reproduce) the failing request; grab `request_id` from
   the error body or the `X-Request-ID` response header in the browser
   dev-tools Network tab.
2. Render → the backend service → Logs → search that id. The matching
   ERROR line has the method, path, and full traceback.
3. Frontend-only crashes: Vercel → project → Logs, search
   `[route-error]`.

## Conventions for new code

- Log through the shared logger: `from observability import logger`,
  not `print()`.
- Raise `HTTPException` for expected failures; let unexpected ones
  propagate — the middleware logs them with context and returns the
  clean 500 for you. Don't wrap handlers in broad `try/except`.
- Middleware ordering in `main.py` matters: `setup_observability(app)`
  is called before CORS is added so CORS stays outermost and even
  error responses carry CORS headers.
