"""Programmatic Alembic runner for production startup (S3-016).

Handles the three states a Team Dragons database can be in:

1. Fresh/empty database: `upgrade head` builds the full schema.
2. Pre-Alembic database (tables exist, no alembic_version): the schema
   was built by create_all before migrations existed. It is adopted by
   stamping the baseline revision, then upgraded so post-baseline
   repairs (e.g. 0002's legacy owner_id fix) still run.
3. Alembic-managed database: `upgrade head` applies anything pending.

Rollback plan (S3-BR-018): every revision has a downgrade; run
`python -m alembic downgrade -1` (or a specific revision id) from
backend/ to step back one migration.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from database import build_database_url

# The revision representing the schema as it existed before Alembic was
# introduced. Pre-Alembic databases are stamped here, not at head, so
# repair migrations that follow it still apply to them.
BASELINE_REVISION = "0001"

_BACKEND_DIR = Path(__file__).resolve().parent


def _alembic_config(database_url: str) -> Config:
    """Build an Alembic Config pointed at this backend's migrations."""
    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def run_migrations(database_url: str | None = None) -> None:
    """
    Bring the database schema up to the latest revision.

    Args:
        database_url (str | None): Target database. Defaults to the
            app's own URL (MySQL when DB_HOST is set, else SQLite).
    """
    url = database_url or build_database_url()
    config = _alembic_config(url)

    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            tables = set(inspect(connection).get_table_names())
    finally:
        engine.dispose()

    if "jobs" in tables and "alembic_version" not in tables:
        # Adopt a database that predates Alembic (built by create_all).
        command.stamp(config, BASELINE_REVISION)

    command.upgrade(config, "head")
