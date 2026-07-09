# Database and migrations (S3-016)

## How the database is selected

`backend/database.py` builds the connection URL from the environment:

| Environment | What you get |
| --- | --- |
| `DB_HOST` set (with `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) | MySQL via PyMySQL — **production** |
| `DB_HOST` unset | SQLite file `ats_local.db` — local dev / CI fallback |

**Production warning:** if `DB_HOST` is not set on the Render service, the
backend silently falls back to SQLite on the service's local disk, which is
wiped on every deploy or restart. Anyone with Render console access should
verify the `DB_*` variables exist under Service → Environment.

## Migration strategy

Migrations live in `backend/migrations/` and are managed by Alembic.

- **Production startup runs them automatically.** `main.py`'s lifespan calls
  `run_migrations()` when `PYTHON_ENV=production` (or `RUN_DB_MIGRATIONS=1`).
  Dev and tests keep the fast `create_all` path, so nothing changes locally.
- **Existing databases are adopted, not rebuilt.** A database that predates
  Alembic (tables exist, no `alembic_version`) is stamped at the baseline
  revision `0001`, then upgraded from there. Fresh databases are built to
  head directly.
- **Repairs ride on migrations.** `0002` widens `educations.owner_id` and
  `skills.owner_id` from INTEGER to VARCHAR(50) on databases created before
  the Clerk auth fix (PR #63). Fresh databases already get VARCHAR from the
  baseline; for them 0002 is a no-op.

### Adding a migration

```bash
cd backend
# 1. Change models.py
# 2. Autogenerate against a scratch database:
ALEMBIC_DATABASE_URL=sqlite:///scratch.db python -m alembic upgrade head
ALEMBIC_DATABASE_URL=sqlite:///scratch.db python -m alembic revision --autogenerate -m "what changed"
# 3. Review the generated file in migrations/versions/ (autogenerate is a
#    draft, not a decision), delete scratch.db, commit the migration.
```

Batch mode (`render_as_batch=True`) is enabled so ALTERs work on SQLite,
which cannot alter columns in place.

## Rollback plan (S3-BR-018)

Every revision has a working `downgrade()`:

```bash
cd backend
python -m alembic downgrade -1        # step back one revision
python -m alembic downgrade 0001      # back to the baseline
python -m alembic history             # see where you are
```

Caveats:

- Downgrading `0002` narrows owner ids back to INTEGER, which only succeeds
  while all stored ids are numeric — it exists to mirror the legacy layout,
  not for use after real Clerk users have written data.
- Schema rollback does not restore lost rows. For data problems, restore
  from a database backup (Render/MySQL dump), then re-run migrations.

## Render checklist (requires console access)

1. Service → Environment: confirm `DB_HOST`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, `DB_PORT` point at the production MySQL instance.
2. Set `PYTHON_ENV=production` so startup runs migrations.
3. Redeploy and check the logs for Alembic's `Running upgrade` lines on boot.

## Tests

`backend/tests/test_migrations.py` covers all three deployment states
against throwaway SQLite files: fresh build to head, idempotent re-run,
adoption + repair of a pre-Alembic database with the legacy integer
columns, and the downgrade/re-upgrade rollback path.
