"""add title to documents

Revision ID: 52e0af935ad6
Revises: f17d94b34263
Create Date: 2026-07-12 14:19:16.089072

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "52e0af935ad6"
down_revision: str | Sequence[str] | None = "f17d94b34263"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.add_column(sa.Column("title", sa.String(length=255), nullable=True))

    op.execute("UPDATE documents SET title = doc_type WHERE title IS NULL")

    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.alter_column(
            "title",
            existing_type=sa.String(length=255),
            nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_column("title")
