"""add prep notes to jobs

Revision ID: 4d6861fe9d24
Revises: 52e0af935ad6
Create Date: 2026-07-13 01:02:37.812533

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import reflection

# revision identifiers, used by Alembic.
revision: str = "4d6861fe9d24"
down_revision: str | Sequence[str] | None = "52e0af935ad6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 🟢 1. Use SQLAlchemy's inspector to safely check existing columns
    conn = op.get_bind()
    inspector = reflection.Inspector.from_engine(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("jobs")]

    with op.batch_alter_table("jobs", schema=None) as batch_op:
        # 🟢 2. Always add your new interview preparation notes columns
        batch_op.add_column(sa.Column("prep_notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("notes_updated_at", sa.DateTime(), nullable=True))

        # 🟢 3. Only drop 'interview_notes' if it ACTUALLY exists in the database
        if "interview_notes" in existing_columns:
            batch_op.drop_column("interview_notes")

    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("jobs", schema=None) as batch_op:
        # Re-add the old column if your system needs it back
        batch_op.add_column(sa.Column("interview_notes", sa.TEXT(), nullable=True))

        batch_op.drop_column("notes_updated_at")
        batch_op.drop_column("prep_notes")

    # ### end Alembic commands ###
