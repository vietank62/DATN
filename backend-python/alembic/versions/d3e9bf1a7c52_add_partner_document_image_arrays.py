"""add partner document image arrays

Revision ID: d3e9bf1a7c52
Revises: c8d72ae9401f
Create Date: 2026-08-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d3e9bf1a7c52"
down_revision = "c8d72ae9401f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "restaurants",
        sa.Column("business_license_urls", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "restaurants",
        sa.Column("legal_documents_urls", postgresql.ARRAY(sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column("restaurants", "legal_documents_urls")
    op.drop_column("restaurants", "business_license_urls")
