"""Store restaurant coordinates for nearby search.

Revision ID: 0a1b2c3d4e5f
Revises: ff3a6b9d102e
"""
from alembic import op
import sqlalchemy as sa

revision = "0a1b2c3d4e5f"
down_revision = "ff3a6b9d102e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("restaurants", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_index(
        "ix_restaurants_nearby_coordinates",
        "restaurants",
        ["latitude", "longitude"],
        postgresql_where=sa.text("is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL"),
    )


def downgrade():
    op.drop_index("ix_restaurants_nearby_coordinates", table_name="restaurants")
    op.drop_column("restaurants", "longitude")
    op.drop_column("restaurants", "latitude")
