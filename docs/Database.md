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

**Targeting production:** with no env vars set, these commands hit the local
`backend/ats_local.db` SQLite file, not production. To roll back the real
database, run them from the Render service Shell (where the `DB_*` variables
are set), or point Alembic at MySQL explicitly first:

```bash
export ALEMBIC_DATABASE_URL='mysql+pymysql://USER:PASS@HOST:PORT/NAME'
```

Caveats:

- **Take a backup before any downgrade.** Schema rollback never restores
  lost rows; for data problems, restore from a MySQL dump and re-run
  migrations.
- **A manual downgrade is undone on the next boot.** Startup auto-upgrades
  to head, so a rollback only persists if you also ship a build whose
  `migrations/versions/` no longer contains the reverted revision (git
  revert the migration commit), or keep the service stopped until the fixed
  code deploys.
- **Downgrading `0002` is guarded.** Narrowing owner ids back to INTEGER
  with real Clerk ids stored would fail on strict MySQL and silently
  coerce every id to 0 on non-strict MySQL, destroying row ownership —
  so the migration now refuses to downgrade if any non-numeric owner_id
  exists. It exists to mirror the legacy layout on pre-Clerk data only.

## Render checklist (requires console access)

1. Take a database backup (MySQL dump) before changing anything.
2. Service → Environment: confirm `DB_HOST`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, `DB_PORT` point at the production MySQL instance. (If
   `DB_HOST` is unset, the service is silently running on throwaway
   SQLite — see the warning above.)
3. Set `PYTHON_ENV=production`. (Startup also runs migrations whenever
   `DB_HOST` is set, so this is belt and braces.)
4. Redeploy and check the boot logs: the line `DB startup: alembic
   migrations` confirms the migration path ran; on the first migrated
   deploy you'll also see Alembic `Running upgrade` lines. On later
   deploys, no Alembic errors is the normal, healthy state — to confirm
   positively, run `SELECT version_num FROM alembic_version` against
   MySQL and check it matches the newest file in
   `backend/migrations/versions/`.

## Recovering a half-migrated database

MySQL DDL is not transactional, so an interrupted migration can leave a
partial schema. The startup runner detects this (missing baseline tables,
or an empty `alembic_version` table) and refuses to guess, crashing with a
descriptive error instead of stamping a wrong version. To recover: compare
the actual tables against `migrations/versions/`, finish or drop the
partial objects manually, then `python -m alembic stamp <revision>` for the
revision the schema actually matches and redeploy.

## Tests

`backend/tests/test_migrations.py` covers all three deployment states
against throwaway SQLite files: fresh build to head, idempotent re-run,
adoption + repair of a pre-Alembic database with the legacy integer
columns, and the downgrade/re-upgrade rollback path.
