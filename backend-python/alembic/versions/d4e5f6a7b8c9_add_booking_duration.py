"""add booking duration to restaurants

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("booking_duration_minutes", sa.Integer(), nullable=False, server_default="120"))
    op.alter_column("restaurants", "booking_duration_minutes", server_default=None)


def downgrade():
    op.drop_column("restaurants", "booking_duration_minutes")