"""Merge branch heads

Revision ID: 40736a3873bb
Revises: 4d6861fe9d24, c0e0dd3071dd
Create Date: 2026-07-14 15:56:04.414718

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "40736a3873bb"
down_revision: str | Sequence[str] | None = ("4d6861fe9d24", "c0e0dd3071dd")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
