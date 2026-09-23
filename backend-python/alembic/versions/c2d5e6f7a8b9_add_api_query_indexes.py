"""add indexes for high-traffic API queries

Revision ID: c2d5e6f7a8b9
Revises: fb8c2e4a6d71
Create Date: 2026-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = "c2d5e6f7a8b9"
down_revision = "fb8c2e4a6d71"
branch_labels = None
depends_on = None


INDEXES = (
    ("ix_booking_user_booking_id", "booking", ["userId", "bookingId"]),
    ("ix_booking_restaurant_booking_id", "booking", ["restaurantId", "bookingId"]),
    ("ix_booking_status", "booking", ["status"]),
    ("ix_bookingitem_booking_id", "bookingitem", ["bookingId"]),
    ("ix_notification_user_id_id", "notification", ["userId", "id"]),
    ("ix_review_restaurant_created_at", "review", ["restaurantId", "createdAt"]),
    ("ix_review_user_id", "review", ["userId"]),
    (
        "ix_restaurant_menu_lists_restaurant_sort",
        "restaurant_menu_lists",
        ["restaurant_id", "category", "name", "id"],
    ),
    (
        "ix_deposit_payments_restaurant_status",
        "deposit_payments",
        ["restaurant_id", "status"],
    ),
    (
        "ix_withdrawal_requests_restaurant_status_id",
        "withdrawal_requests",
        ["restaurant_id", "status", "id"],
    ),
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    for name, table_name, columns in INDEXES:
        if not inspector.has_table(table_name):
            continue
        existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        if name not in existing_indexes:
            op.create_index(name, table_name, columns, unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    for name, table_name, _ in reversed(INDEXES):
        if not inspector.has_table(table_name):
            continue
        existing_indexes = {index["name"] for index in inspector.get_indexes(table_name)}
        if name in existing_indexes:
            op.drop_index(name, table_name=table_name)