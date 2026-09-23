"""Add independent SePay checkout sessions.
Revision ID: fc9d3f5b7e82
Revises: c2d5e6f7a8b9
"""
from alembic import op
import sqlalchemy as sa

revision = "fc9d3f5b7e82"
down_revision = "c2d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("deposit_checkouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False),
        sa.Column("invoice_number", sa.String(80), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("gateway_transaction_id", sa.String(), nullable=True, unique=True),
        sa.Column("paid_at", sa.String(), nullable=True),
        sa.Column("received_amount", sa.String(), nullable=True),
        sa.Column("review_reason", sa.String(), nullable=True),
        sa.Column("cancellation_synced", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_deposit_checkouts_booking_id", "deposit_checkouts", ["booking_id"])
    op.create_index("ix_deposit_checkouts_invoice_number", "deposit_checkouts", ["invoice_number"], unique=True)
    op.create_index("ix_deposit_checkouts_status", "deposit_checkouts", ["status"])


def downgrade():
    op.drop_table("deposit_checkouts")
