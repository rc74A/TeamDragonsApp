"""Alembic environment: wires migrations to the app's own DB config (S3-016)."""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make the backend package importable when alembic runs from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import models  # noqa: E402, F401  (imported so Base.metadata is populated)
from database import Base, build_database_url  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# URL precedence: ALEMBIC_DATABASE_URL (scratch runs like autogenerate),
# then a URL already set programmatically (migration_runner passes the
# target database this way), then the app's own URL logic (MySQL when
# DB_HOST is set, SQLite fallback otherwise).
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("ALEMBIC_DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
    or build_database_url(),
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live connection (emits SQL scripts)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def _run_with_connection(connection) -> None:
    """Configure the context on a connection and run the migrations."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Batch mode so ALTERs work on SQLite (it can't alter in place).
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        _run_with_connection(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
