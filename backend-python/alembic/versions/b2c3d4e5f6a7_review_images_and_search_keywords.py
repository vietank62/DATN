"""Store review galleries and popular search terms.

Revision ID: b2c3d4e5f6a7
Revises: a8f1c3d5e7b9
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b2c3d4e5f6a7"
down_revision = "a8f1c3d5e7b9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("review", sa.Column("image_urls", postgresql.ARRAY(sa.Text()), nullable=True))
    op.add_column("violation_reports", sa.Column("booking_status_before_report", sa.String(length=30), nullable=True))
    op.add_column("violation_reports", sa.Column("booking_deposit_status_before_report", sa.String(length=30), nullable=True))
    op.add_column("violation_reports", sa.Column("payment_status_before_report", sa.String(length=30), nullable=True))
    op.add_column("violation_reports", sa.Column("restaurant_active_before_report", sa.Boolean(), nullable=True))
    op.add_column("violation_reports", sa.Column("restaurant_suspended_before_report", sa.Boolean(), nullable=True))
    op.create_table(
        "search_keywords",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("keyword", sa.String(length=100), nullable=False, unique=True),
        sa.Column("search_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_searched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_search_keywords_popular", "search_keywords", ["search_count", "last_searched_at"])


def downgrade():
    op.drop_index("ix_search_keywords_popular", table_name="search_keywords")
    op.drop_table("search_keywords")
    op.drop_column("violation_reports", "restaurant_suspended_before_report")
    op.drop_column("violation_reports", "restaurant_active_before_report")
    op.drop_column("violation_reports", "payment_status_before_report")
    op.drop_column("violation_reports", "booking_deposit_status_before_report")
    op.drop_column("violation_reports", "booking_status_before_report")
    op.drop_column("review", "image_urls")
