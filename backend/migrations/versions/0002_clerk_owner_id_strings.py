"""Clerk owner ids: educations/skills owner_id Integer -> String(50)

Databases created between the S2-017/S2-018 merges and the Clerk auth
hotfix (PR #63) have `educations.owner_id` and `skills.owner_id` as
INTEGER, which cannot hold a Clerk `sub` like "user_2abc...". Fresh
databases already get String(50) from the baseline; for them this is a
no-op type restatement. For legacy databases adopted via `stamp 0001`,
this is the repair (S3-016).

Revision ID: 0002
Revises: 0001

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("educations", "skills")


def upgrade() -> None:
    """Widen legacy integer owner_id columns to Clerk-compatible strings."""
    for table in _TABLES:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.alter_column(
                "owner_id",
                existing_type=sa.Integer(),
                type_=sa.String(length=50),
                existing_nullable=False,
            )


def downgrade() -> None:
    """Restore the pre-Clerk integer owner_id columns.

    Only safe while every stored owner_id is still numeric; a Clerk
    `sub` value cannot be narrowed back to INTEGER.
    """
    for table in _TABLES:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.alter_column(
                "owner_id",
                existing_type=sa.String(length=50),
                type_=sa.Integer(),
                existing_nullable=False,
            )
