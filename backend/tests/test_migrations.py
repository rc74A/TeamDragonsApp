"""Tests for the Alembic migration strategy (S3-016 / S3-BR-018).

Each test runs against its own throwaway SQLite file, never the real
database, covering the states a deployment can be in: fresh,
pre-Alembic (built by create_all), already Alembic-managed, and the
half-migrated states the runner must refuse to guess about.
"""

import pytest
import sqlalchemy as sa
from alembic import command

from database import Base
from migration_runner import (
    BASELINE_REVISION,
    BASELINE_TABLES,
    _alembic_config,
    run_migrations,
)

EXPECTED_TABLES = set(BASELINE_TABLES)


@pytest.fixture(autouse=True)
def _isolate_from_environment(monkeypatch):
    """Migration tests must target their tmp_path URL, never a real DB."""
    monkeypatch.delenv("ALEMBIC_DATABASE_URL", raising=False)
    monkeypatch.delenv("DB_HOST", raising=False)


def _url(tmp_path, name="test.db"):
    """Build a SQLite URL for a throwaway database file."""
    return f"sqlite:///{(tmp_path / name).as_posix()}"


def _tables(url):
    """Return the set of table names in a database."""
    engine = sa.create_engine(url)
    try:
        return set(sa.inspect(engine).get_table_names())
    finally:
        engine.dispose()


def _owner_id_type(url, table):
    """Return the owner_id column type name for a table."""
    engine = sa.create_engine(url)
    try:
        columns = {c["name"]: c for c in sa.inspect(engine).get_columns(table)}
        return str(columns["owner_id"]["type"]).upper()
    finally:
        engine.dispose()


def _make_pre_alembic_db(url):
    """Build the full legacy schema: create_all, then the two owner_id
    columns as INTEGER exactly as the pre-#63 models had them, with one
    data row each so widening must preserve rows.
    """
    engine = sa.create_engine(url)
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE educations"))
        connection.execute(sa.text("DROP TABLE skills"))
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
        connection.execute(
            sa.text(
                "INSERT INTO educations (owner_id, school, degree, position) "
                "VALUES (7, 'NJIT', 'B.S.', 0)"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO skills (owner_id, name, position) VALUES (7, 'SQL', 0)"
            )
        )
    engine.dispose()


def test_fresh_database_gets_full_schema(tmp_path):
    """A fresh database is built to head with every expected table."""
    url = _url(tmp_path)
    run_migrations(url)

    tables = _tables(url)
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

    assert _tables(url) >= EXPECTED_TABLES


def test_pre_alembic_database_is_adopted_and_repaired(tmp_path):
    """The full legacy schema is stamped at the baseline, the owner_id
    columns are widened, and existing rows survive the table rebuild.
    """
    url = _url(tmp_path)
    _make_pre_alembic_db(url)
    assert "INT" in _owner_id_type(url, "educations")

    run_migrations(url)

    tables = _tables(url)
    assert "alembic_version" in tables
    assert tables >= EXPECTED_TABLES
    assert "VARCHAR" in _owner_id_type(url, "educations")
    assert "VARCHAR" in _owner_id_type(url, "skills")

    # The legacy rows made it through the batch rebuild intact.
    engine = sa.create_engine(url)
    try:
        with engine.connect() as connection:
            school, owner = connection.execute(
                sa.text("SELECT school, owner_id FROM educations")
            ).one()
            assert school == "NJIT"
            assert str(owner) == "7"
            assert (
                connection.execute(sa.text("SELECT COUNT(*) FROM skills")).scalar() == 1
            )
    finally:
        engine.dispose()


def test_partial_schema_is_refused_not_stamped(tmp_path):
    """A half-created schema (e.g. an interrupted first run) raises a
    descriptive error instead of being stamped as complete.
    """
    url = _url(tmp_path)
    engine = sa.create_engine(url)
    with engine.begin() as connection:
        connection.execute(
            sa.text("CREATE TABLE jobs (id INTEGER PRIMARY KEY, owner_id VARCHAR(50))")
        )
    engine.dispose()

    with pytest.raises(RuntimeError, match="partial schema"):
        run_migrations(url)


def test_rollback_one_step_and_reapply(tmp_path):
    """The rollback plan works on pre-Clerk numeric data: downgrade one
    revision, then re-upgrade, preserving rows both ways (S3-BR-018).
    """
    url = _url(tmp_path)
    _make_pre_alembic_db(url)
    run_migrations(url)

    config = _alembic_config(url)
    command.downgrade(config, BASELINE_REVISION)
    # 0002 undone: owner ids narrowed back to the legacy INTEGER layout.
    assert "INT" in _owner_id_type(url, "educations")

    command.upgrade(config, "head")
    assert "VARCHAR" in _owner_id_type(url, "educations")

    engine = sa.create_engine(url)
    try:
        with engine.connect() as connection:
            owner = connection.execute(
                sa.text("SELECT owner_id FROM educations")
            ).scalar()
            assert str(owner) == "7"
    finally:
        engine.dispose()


def test_downgrade_refuses_to_narrow_real_clerk_ids(tmp_path):
    """Downgrading 0002 with a Clerk sub stored raises instead of
    corrupting ownership (the guard for the lossy narrow).
    """
    url = _url(tmp_path)
    run_migrations(url)

    engine = sa.create_engine(url)
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO skills (owner_id, name, category, proficiency, "
                "position, created_at) VALUES ('user_2abcDEF', 'Python', '', "
                "'', 0, '2026-07-01 00:00:00')"
            )
        )
    engine.dispose()

    config = _alembic_config(url)
    with pytest.raises(RuntimeError, match="non-numeric"):
        command.downgrade(config, BASELINE_REVISION)


def test_full_rollback_to_base_and_rebuild(tmp_path):
    """0001's downgrade — the drop-all rollback — works and the schema
    can be rebuilt to head afterwards (S3-BR-018).
    """
    url = _url(tmp_path)
    run_migrations(url)

    config = _alembic_config(url)
    command.downgrade(config, "base")
    assert _tables(url).isdisjoint(EXPECTED_TABLES)

    command.upgrade(config, "head")
    assert _tables(url) >= EXPECTED_TABLES
