"""expand restaurant detail text fields

Revision ID: e1a4c63f9b20
Revises: d3e9bf1a7c52
Create Date: 2026-08-16
"""

from alembic import op
import sqlalchemy as sa


revision = "e1a4c63f9b20"
down_revision = "d3e9bf1a7c52"
branch_labels = None
depends_on = None


def upgrade():
    """Allow managers to save complete customer-facing restaurant content."""
    op.alter_column(
        "restaurant_details",
        "description",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "restaurant_details",
        "parking_info",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "restaurant_details",
        "regulations",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade():
    """Restore the original field limits when all existing values fit."""
    op.alter_column(
        "restaurant_details",
        "regulations",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.alter_column(
        "restaurant_details",
        "parking_info",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
    op.alter_column(
        "restaurant_details",
        "description",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
