"""add restaurant website url

Revision ID: c8d72ae9401f
Revises: a6d3c7f819b2
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa


revision = "c8d72ae9401f"
down_revision = "a6d3c7f819b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "restaurants",
        sa.Column("website_url", sa.String(length=500), nullable=True),
    )


def downgrade():
    op.drop_column("restaurants", "website_url")
