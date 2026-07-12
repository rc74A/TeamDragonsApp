"""Alembic environment: wires migrations to the app's own DB config (S3-016)."""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

# Make the backend package importable when alembic runs from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import models  # noqa: E402, F401  (imported so Base.metadata is populated)
from database import Base, build_database_url  # noqa: E402

config = context.config

# CLI runs configure logging from alembic.ini; programmatic startup runs
# (migration_runner) skip it, because fileConfig would disable the app's
# own loggers and silence all request/error logging (S3-018).
if config.config_file_name is not None and config.attributes.get(
    "configure_logger", True
):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# URL precedence: ALEMBIC_DATABASE_URL (scratch runs like autogenerate),
# then a URL passed programmatically via config.attributes (the
# migration_runner path — kept out of the ini options so configparser
# never interpolates characters like % in passwords), then the app's
# own URL logic (MySQL when DB_HOST is set, SQLite fallback otherwise).
DATABASE_URL = (
    os.getenv("ALEMBIC_DATABASE_URL")
    or config.attributes.get("sqlalchemy_url")
    or build_database_url()
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live connection (emits SQL scripts)."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                # Batch mode so ALTERs work on SQLite (no in-place ALTER).
                render_as_batch=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
