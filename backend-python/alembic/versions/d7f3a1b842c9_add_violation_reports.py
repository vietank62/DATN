"""add violation reports

Revision ID: d7f3a1b842c9
Revises: c6e2d9a410b7
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d7f3a1b842c9"
down_revision = "c6e2d9a410b7"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {item["name"] for item in inspector.get_columns("user")}
    restaurant_columns = {item["name"] for item in inspector.get_columns("restaurants")}
    if "report_strikes" not in user_columns:
        op.add_column("user", sa.Column("report_strikes", sa.Integer(), nullable=False, server_default="0"))
    if "is_suspended" not in user_columns:
        op.add_column("user", sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "is_report_suspended" not in restaurant_columns:
        op.add_column("restaurants", sa.Column("is_report_suspended", sa.Boolean(), nullable=False, server_default=sa.false()))
    if not inspector.has_table("violation_reports"):
        op.create_table("violation_reports", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("booking_id", sa.Integer(), nullable=False), sa.Column("reporter_id", sa.Integer(), nullable=False), sa.Column("target_user_id", sa.Integer()), sa.Column("target_restaurant_id", sa.Integer()), sa.Column("target_type", sa.String(20), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("evidence_urls", postgresql.ARRAY(sa.Text())), sa.Column("status", sa.String(30), nullable=False), sa.Column("appeal_reason", sa.Text()), sa.Column("appeal_evidence_urls", postgresql.ARRAY(sa.Text())), sa.Column("admin_id", sa.Integer()), sa.Column("admin_note", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("reviewed_at", sa.DateTime(timezone=True)))
        for name, col in (("ix_violation_reports_booking_id", "booking_id"), ("ix_violation_reports_target_user_id", "target_user_id"), ("ix_violation_reports_target_restaurant_id", "target_restaurant_id"), ("ix_violation_reports_status", "status")):
            op.create_index(name, "violation_reports", [col])


def downgrade():
    op.drop_table("violation_reports")
