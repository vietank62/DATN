"""Create storage for restaurant service-fee QR payment sessions.

The legacy ``payment`` table may already exist in older local deployments;
therefore this migration creates or augments it safely.
"""
from alembic import context, op
import sqlalchemy as sa

revision = "f9a0b1c2d3e4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def _create_payment_table():
    op.create_table(
        "payment",
        sa.Column("paymentId", sa.Integer(), primary_key=True),
        sa.Column("restaurantId", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("transactionCode", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("createdAt", sa.String(), nullable=False),
        sa.Column("paidAt", sa.String(), nullable=True),
        sa.Column("bookingIds", sa.String(), nullable=True),
        sa.Column("sepayTransactionId", sa.String(), nullable=True),
        sa.UniqueConstraint("transactionCode"),
    )
    op.create_index("ix_payment_transaction_code", "payment", ["transactionCode"], unique=True)
    op.create_index("ix_payment_restaurant_status", "payment", ["restaurantId", "status"])


def upgrade():
    # SQL preview cannot inspect an existing schema. Emit a complete table for
    # a fresh database; online upgrades retain any legacy payment table.
    if context.is_offline_mode():
        _create_payment_table()
        return
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("payment"):
        _create_payment_table()
        return

    columns = {column["name"] for column in inspector.get_columns("payment")}
    if "sepayTransactionId" not in columns:
        op.add_column("payment", sa.Column("sepayTransactionId", sa.String(), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("payment")}
    if "ix_payment_restaurant_status" not in indexes:
        op.create_index("ix_payment_restaurant_status", "payment", ["restaurantId", "status"])


def downgrade():
    # The table can predate this migration, so only remove the index we add.
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("payment"):
        indexes = {index["name"] for index in inspector.get_indexes("payment")}
        if "ix_payment_restaurant_status" in indexes:
            op.drop_index("ix_payment_restaurant_status", table_name="payment")
