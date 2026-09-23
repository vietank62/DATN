"""add partner application fields

Revision ID: a6d3c7f819b2
Revises: f4c2a8d91e76
Create Date: 2026-08-09
"""
from alembic import op
import sqlalchemy as sa

revision = "a6d3c7f819b2"
down_revision = "f4c2a8d91e76"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("restaurants", sa.Column("approval_status", sa.String(length=20), nullable=False, server_default="approved"))
    op.add_column("restaurants", sa.Column("business_license_url", sa.String(length=500), nullable=True))
    op.add_column("restaurants", sa.Column("tax_code", sa.String(length=50), nullable=True))
    op.add_column("restaurants", sa.Column("legal_documents_url", sa.String(length=500), nullable=True))
    op.add_column("restaurants", sa.Column("policy_accepted_at", sa.DateTime(), nullable=True))
    op.add_column("restaurants", sa.Column("booking_opening_time", sa.String(length=5), nullable=True))
    op.add_column("restaurants", sa.Column("booking_closing_time", sa.String(length=5), nullable=True))
    op.create_index("ix_restaurants_approval_status", "restaurants", ["approval_status"])

def downgrade():
    op.drop_index("ix_restaurants_approval_status", table_name="restaurants")
    for column in ("booking_closing_time", "booking_opening_time", "policy_accepted_at", "legal_documents_url", "tax_code", "business_license_url", "approval_status"):
        op.drop_column("restaurants", column)
