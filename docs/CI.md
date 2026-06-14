# Continuous Integration (CI)

Every pull request runs automated checks via GitHub Actions. A failing check
blocks merge once branch protection is enabled on `main`.

## What runs on each pull request

| Check | Workflow | Story | What it does |
| --- | --- | --- | --- |
| Lint + format | `.github/workflows/lint.yml` | S1-006 | ESLint + Prettier (frontend), Ruff (backend) |
| Build | `.github/workflows/ci.yml` | S1-008 | `npm run build` (frontend), byte-compile (backend) |
| Unit tests | `.github/workflows/ci.yml` | S1-008 | `npm test` (frontend), `pytest` (backend) |

Together these satisfy the Sprint 1 **CI/CD Baseline Gate**: every PR runs
lint, build, and unit tests, and a failing check cannot be merged.

## Build and Test (S1-008)

The `CI — Build and Test` workflow has two jobs:

- **Frontend** — `npm ci`, then `npm run build`, then `npm run test --if-present`.
- **Backend** — install `requirements.txt` if present, byte-compile with
  `python -m compileall`, then run `pytest` if it is installed.

### Test wiring and the S1-007 dependency

The unit-test steps are intentionally tolerant of the test frameworks not being
installed yet:

- Frontend uses `npm run test --if-present`, which is a no-op until a `test`
  script exists.
- Backend runs `pytest` only if it can be imported.

When **S1-007 (Configure Unit Test Frameworks)** lands — adding a `test` script
on the frontend and `pytest` on the backend — these steps begin running the real
tests automatically, with no change to the workflow.

## Required follow-up: branch protection

CI runs the checks, but blocking merge requires a one-time admin step on the
repository:

**GitHub → Settings → Branches → add a rule for `main` → "Require status checks
to pass before merging"**, then select:

- `Frontend (ESLint + Prettier)` and `Backend (Ruff)` (from lint.yml)
- `Frontend (build + test)` and `Backend (build + test)` (from ci.yml)

## Running the checks locally

```bash
# Frontend
cd frontend
npm ci
npm run build
npm run test --if-present

# Backend
cd backend
python -m compileall -q .
pytest        # once S1-007 has installed it
```
