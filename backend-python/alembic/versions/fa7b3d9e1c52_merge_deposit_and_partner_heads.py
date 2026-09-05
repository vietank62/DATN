"""merge deposit and partner migration heads

Revision ID: fa7b3d9e1c52
Revises: ee4d1c9a20f7, f9c4a1e7d2b8
Create Date: 2026-09-03
"""

from typing import Sequence, Union


revision: str = "fa7b3d9e1c52"
down_revision: Union[str, Sequence[str], None] = (
    "ee4d1c9a20f7",
    "f9c4a1e7d2b8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge point only; both parent migrations contain the schema changes."""


def downgrade() -> None:
    """Merge point only; Alembic walks each parent during downgrade."""
