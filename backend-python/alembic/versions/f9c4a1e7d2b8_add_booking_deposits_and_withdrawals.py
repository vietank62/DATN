"""add booking deposits and restaurant withdrawals

Revision ID: f9c4a1e7d2b8
Revises: f4c2a8d91e76
Create Date: 2026-08-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9c4a1e7d2b8"
down_revision: Union[str, Sequence[str], None] = "f4c2a8d91e76"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    restaurant_detail_columns = {
        column["name"] for column in inspector.get_columns("restaurant_details")
    }
    if "deposit_amount" not in restaurant_detail_columns:
        op.add_column("restaurant_details", sa.Column("deposit_amount", sa.Integer(), nullable=False, server_default="0"))
        op.alter_column("restaurant_details", "deposit_amount", server_default=None)
    if "deposit_min_guests" not in restaurant_detail_columns:
        op.add_column("restaurant_details", sa.Column("deposit_min_guests", sa.Integer(), nullable=False, server_default="1"))
        op.alter_column("restaurant_details", "deposit_min_guests", server_default=None)

    booking_columns = {column["name"] for column in inspector.get_columns("booking")}
    if "depositAmount" not in booking_columns:
        op.add_column("booking", sa.Column("depositAmount", sa.Integer(), nullable=False, server_default="0"))
        op.alter_column("booking", "depositAmount", server_default=None)
    if "depositStatus" not in booking_columns:
        op.add_column("booking", sa.Column("depositStatus", sa.String(length=20), nullable=False, server_default="not_required"))
        op.alter_column("booking", "depositStatus", server_default=None)
    if "depositPaidAt" not in booking_columns:
        op.add_column("booking", sa.Column("depositPaidAt", sa.String(), nullable=True))

    if not inspector.has_table("deposit_payments"):
        op.create_table(
        "deposit_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False, unique=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.userId"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("transaction_code", sa.String(), nullable=False, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("paid_at", sa.String(), nullable=True),
        sa.Column("sepay_transaction_id", sa.String(), nullable=True, unique=True),
        )
        op.create_index("ix_deposit_payments_booking_id", "deposit_payments", ["booking_id"])
        op.create_index("ix_deposit_payments_restaurant_id", "deposit_payments", ["restaurant_id"])
        op.create_index("ix_deposit_payments_user_id", "deposit_payments", ["user_id"])
        op.create_index("ix_deposit_payments_transaction_code", "deposit_payments", ["transaction_code"])
        op.create_index("ix_deposit_payments_status", "deposit_payments", ["status"])

    if not inspector.has_table("withdrawal_requests"):
        op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("bank_name", sa.String(), nullable=False),
        sa.Column("account_name", sa.String(), nullable=False),
        sa.Column("account_number", sa.String(), nullable=False),
        sa.Column("qr_image_url", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.String(), nullable=False),
        sa.Column("processed_at", sa.String(), nullable=True),
        sa.Column("processed_by", sa.Integer(), sa.ForeignKey("user.userId"), nullable=True),
        sa.Column("transfer_proof_url", sa.String(), nullable=True),
        sa.Column("admin_note", sa.String(), nullable=True),
        )
        op.create_index("ix_withdrawal_requests_restaurant_id", "withdrawal_requests", ["restaurant_id"])
        op.create_index("ix_withdrawal_requests_status", "withdrawal_requests", ["status"])


def downgrade() -> None:
    op.drop_table("withdrawal_requests")
    op.drop_table("deposit_payments")
    op.drop_column("booking", "depositPaidAt")
    op.drop_column("booking", "depositStatus")
    op.drop_column("booking", "depositAmount")
    op.drop_column("restaurant_details", "deposit_min_guests")
    op.drop_column("restaurant_details", "deposit_amount")
