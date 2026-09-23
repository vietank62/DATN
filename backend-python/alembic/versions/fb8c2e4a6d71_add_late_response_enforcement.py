"""add late response enforcement

Revision ID: fb8c2e4a6d71
Revises: fa7b3d9e1c52
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fb8c2e4a6d71"
down_revision: Union[str, Sequence[str], None] = "fa7b3d9e1c52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    restaurant_columns = {column["name"] for column in inspector.get_columns("restaurants")}
    if "late_response_strikes" not in restaurant_columns:
        op.add_column(
            "restaurants",
            sa.Column("late_response_strikes", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("restaurants", "late_response_strikes", server_default=None)

    report_columns = {column["name"] for column in inspector.get_columns("violation_reports")}
    if "source" not in report_columns:
        op.add_column(
            "violation_reports",
            sa.Column("source", sa.String(length=30), nullable=False, server_default="customer_report"),
        )
        op.alter_column("violation_reports", "source", server_default=None)

    if not inspector.has_table("deposit_refunds"):
        op.create_table(
            "deposit_refunds",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False, unique=True),
            sa.Column("deposit_payment_id", sa.Integer(), sa.ForeignKey("deposit_payments.id"), nullable=False, unique=True),
            sa.Column("customer_id", sa.Integer(), sa.ForeignKey("user.userId"), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("refunded_at", sa.String(), nullable=True),
            sa.Column("proof_url", sa.String(), nullable=True),
        )
        op.create_index("ix_deposit_refunds_booking_id", "deposit_refunds", ["booking_id"])
        op.create_index("ix_deposit_refunds_customer_id", "deposit_refunds", ["customer_id"])
        op.create_index("ix_deposit_refunds_status", "deposit_refunds", ["status"])


def downgrade() -> None:
    op.drop_table("deposit_refunds")
    op.drop_column("violation_reports", "source")
    op.drop_column("restaurants", "late_response_strikes")
