"""add booking child count

Revision ID: f4c2a8d91e76
Revises: e3b8f91d26ac
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4c2a8d91e76"
down_revision: Union[str, Sequence[str], None] = "e3b8f91d26ac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "booking",
        sa.Column("childCount", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("booking", "childCount", server_default=None)


def downgrade() -> None:
    op.drop_column("booking", "childCount")
