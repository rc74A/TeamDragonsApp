"""Tests for the Alembic migration strategy (S3-016 / S3-BR-018).

Each test runs against its own throwaway SQLite file, never the real
database, covering the three states a deployment can be in: fresh,
pre-Alembic (built by create_all), and already Alembic-managed.
"""

import sqlalchemy as sa
from alembic import command

from migration_runner import BASELINE_REVISION, _alembic_config, run_migrations

EXPECTED_TABLES = {
    "jobs",
    "profiles",
    "experiences",
    "educations",
    "skills",
    "job_stage_history",
    "documents",
    "interviews",
}


def _url(tmp_path, name="test.db"):
    """Build a SQLite URL for a throwaway database file."""
    return f"sqlite:///{(tmp_path / name).as_posix()}"


def _inspect(url):
    """Open a short-lived engine and return (tables, inspector-fn)."""
    engine = sa.create_engine(url)
    inspector = sa.inspect(engine)
    return engine, inspector


def _owner_id_type(url, table):
    """Return the owner_id column type name for a table."""
    engine, inspector = _inspect(url)
    try:
        columns = {c["name"]: c for c in inspector.get_columns(table)}
        return str(columns["owner_id"]["type"]).upper()
    finally:
        engine.dispose()


def test_fresh_database_gets_full_schema(tmp_path):
    """A fresh database is built to head with every expected table."""
    url = _url(tmp_path)
    run_migrations(url)

    engine, inspector = _inspect(url)
    try:
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()
    assert tables >= EXPECTED_TABLES
    assert "alembic_version" in tables
    # Clerk subs are strings: owner ids must be VARCHAR, not INTEGER.
    assert "VARCHAR" in _owner_id_type(url, "educations")
    assert "VARCHAR" in _owner_id_type(url, "skills")


def test_migrations_are_idempotent(tmp_path):
    """Running the migrations twice is a no-op, not an error."""
    url = _url(tmp_path)
    run_migrations(url)
    run_migrations(url)  # must not raise

    engine, inspector = _inspect(url)
    try:
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()
    assert tables >= EXPECTED_TABLES


def test_pre_alembic_database_is_adopted_and_repaired(tmp_path):
    """A database built before Alembic (with the pre-Clerk integer
    owner_id columns) is stamped at the baseline and then repaired.
    """
    url = _url(tmp_path)
    engine = sa.create_engine(url)
    # Minimal pre-Alembic state: the marker table plus the two legacy
    # tables exactly as the pre-#63 models created them.
    with engine.begin() as connection:
        connection.execute(
            sa.text("CREATE TABLE jobs (id INTEGER PRIMARY KEY, owner_id VARCHAR(50))")
        )
        connection.execute(
            sa.text(
                "CREATE TABLE educations (id INTEGER PRIMARY KEY, "
                "owner_id INTEGER NOT NULL, school VARCHAR(200) NOT NULL, "
                "degree VARCHAR(200) NOT NULL, field_of_study VARCHAR(200), "
                "start_date VARCHAR(40), end_date VARCHAR(40), gpa VARCHAR(20), "
                "description TEXT, position INTEGER, created_at DATETIME)"
            )
        )
        connection.execute(
            sa.text(
                "CREATE TABLE skills (id INTEGER PRIMARY KEY, "
                "owner_id INTEGER NOT NULL, name VARCHAR(100) NOT NULL, "
                "category VARCHAR(100), proficiency VARCHAR(20), "
                "position INTEGER, created_at DATETIME)"
            )
        )
    engine.dispose()
    assert "INT" in _owner_id_type(url, "educations")

    run_migrations(url)

    # Adopted (version table present) and repaired (columns widened).
    engine, inspector = _inspect(url)
    try:
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()
    assert "alembic_version" in tables
    assert "VARCHAR" in _owner_id_type(url, "educations")
    assert "VARCHAR" in _owner_id_type(url, "skills")


def test_rollback_one_step_and_reapply(tmp_path):
    """The rollback plan works: downgrade one revision, then re-upgrade
    (S3-BR-018).
    """
    url = _url(tmp_path)
    run_migrations(url)

    config = _alembic_config(url)
    command.downgrade(config, BASELINE_REVISION)
    # 0002 undone: owner ids are back to the baseline-stamped... the
    # baseline itself creates VARCHAR, and 0002's downgrade narrows to
    # INTEGER, matching the legacy layout it repairs.
    assert "INT" in _owner_id_type(url, "educations")

    command.upgrade(config, "head")
    assert "VARCHAR" in _owner_id_type(url, "educations")
