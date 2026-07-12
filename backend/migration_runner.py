"""Programmatic Alembic runner for production startup (S3-016).

Handles the three states a Team Dragons database can be in:

1. Fresh/empty database: `upgrade head` builds the full schema.
2. Pre-Alembic database (the full baseline schema exists but no
   alembic_version): the schema was built by create_all before
   migrations existed. It is adopted by stamping the baseline
   revision, then upgraded so post-baseline repairs (e.g. 0002's
   legacy owner_id fix) still run.
3. Alembic-managed database: `upgrade head` applies anything pending.

A partial schema (some baseline tables missing, or an empty
alembic_version table left by an interrupted run) is refused with a
descriptive error rather than guessed at — MySQL DDL is not
transactional, so a half-migrated database needs a human decision,
not an automatic stamp. See docs/Database.md for the recovery steps
and the rollback plan (S3-BR-018).
"""

from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from database import DATABASE_URL

# The revision representing the schema as it existed before Alembic was
# introduced. Pre-Alembic databases are stamped here, not at head, so
# repair migrations that follow it still apply to them.
BASELINE_REVISION = "0001"

# Every table the baseline creates. Adoption requires all of them so a
# half-created schema is never stamped as complete.
BASELINE_TABLES = frozenset(
    {
        "jobs",
        "profiles",
        "experiences",
        "educations",
        "skills",
        "job_stage_history",
        "documents",
        "interviews",
    }
)

_BACKEND_DIR = Path(__file__).resolve().parent
_LOCK_NAME = "teamdragons_migrations"


def _alembic_config(database_url: str) -> Config:
    """Build an Alembic Config pointed at this backend's migrations.

    The URL travels via config.attributes, not the ini options, so
    characters configparser treats as interpolation (a `%` in a
    password) can never corrupt or crash the run.
    """
    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_DIR / "migrations"))
    config.attributes["sqlalchemy_url"] = database_url
    # Programmatic runs must not let env.py's fileConfig re-own logging:
    # it would disable the app's "teamdragons" logger and silence every
    # request/error log for the process lifetime (S3-018).
    config.attributes["configure_logger"] = False
    return config


def _acquire_lock(connection) -> None:
    """Serialize concurrent migration runs (MySQL advisory lock)."""
    if connection.dialect.name == "mysql":
        got = connection.execute(
            sa.text(f"SELECT GET_LOCK('{_LOCK_NAME}', 60)")
        ).scalar()
        if got != 1:
            raise RuntimeError(
                "Another process is still running database migrations; "
                "could not acquire the migration lock within 60s."
            )


def _release_lock(connection) -> None:
    """Release the advisory lock taken by _acquire_lock."""
    if connection.dialect.name == "mysql":
        connection.execute(sa.text(f"SELECT RELEASE_LOCK('{_LOCK_NAME}')"))


def _check_adoption_state(connection) -> bool:
    """
    Decide whether this database must be adopted (stamped at baseline).

    Args:
        connection: An open SQLAlchemy connection to the target.

    Returns:
        bool: True when the full pre-Alembic baseline schema is present
            and unversioned; False for fresh or already-managed schemas.

    Raises:
        RuntimeError: If the schema is only partially present, or an
            interrupted run left an empty alembic_version table.
    """
    tables = set(sa.inspect(connection).get_table_names())
    baseline_present = BASELINE_TABLES & tables

    if "alembic_version" in tables:
        version_rows = connection.execute(
            sa.text("SELECT COUNT(*) FROM alembic_version")
        ).scalar()
        if version_rows == 0 and baseline_present:
            raise RuntimeError(
                "alembic_version exists but is empty: a previous migration "
                "run was interrupted. Reconcile the schema manually, then "
                "stamp the correct revision (see docs/Database.md)."
            )
        return False

    if not baseline_present:
        return False  # Fresh database: build everything from base.

    if baseline_present != BASELINE_TABLES:
        missing = sorted(BASELINE_TABLES - tables)
        raise RuntimeError(
            "Refusing to adopt a partial schema: missing baseline tables "
            f"{missing}. Reconcile the schema manually, then stamp the "
            "correct revision (see docs/Database.md)."
        )

    return True


def run_migrations(database_url: str | None = None) -> None:
    """
    Bring the database schema up to the latest revision.

    Args:
        database_url (str | None): Target database. Defaults to the
            same resolved URL the app engine uses.
    """
    url = database_url or DATABASE_URL
    config = _alembic_config(url)

    engine = sa.create_engine(url)
    try:
        # The lock connection stays open for the whole run so parallel
        # workers wait instead of racing the stamp/upgrade sequence.
        with engine.connect() as connection:
            _acquire_lock(connection)
            try:
                if _check_adoption_state(connection):
                    # Adopt a database that predates Alembic.
                    command.stamp(config, BASELINE_REVISION)
                command.upgrade(config, "head")
            finally:
                _release_lock(connection)
    finally:
        engine.dispose()
