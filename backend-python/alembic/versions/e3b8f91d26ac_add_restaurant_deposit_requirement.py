"""add restaurant deposit requirement

Revision ID: e3b8f91d26ac
Revises: 6176df022fb7
Create Date: 2026-08-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3b8f91d26ac"
down_revision: Union[str, Sequence[str], None] = "6176df022fb7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "restaurant_details",
        sa.Column("requires_deposit", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("restaurant_details", "requires_deposit", server_default=None)


def downgrade() -> None:
    op.drop_column("restaurant_details", "requires_deposit")
