"""add approval history and notifications

Revision ID: a7c9e4b12d60
Revises: f2b5d81a4c70
Create Date: 2026-08-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a7c9e4b12d60"
down_revision = "f2b5d81a4c70"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("approval_histories"):
        op.create_table(
            "approval_histories",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("manager_id", sa.Integer(), nullable=False),
            sa.Column("admin_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(length=20), nullable=False),
            sa.Column("request_type", sa.String(length=20), nullable=False),
            sa.Column("change_fields", postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("deactivate_restaurant", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
            sa.ForeignKeyConstraint(["manager_id"], ["user.userId"]),
            sa.ForeignKeyConstraint(["admin_id"], ["user.userId"]),
        )

    existing_indexes = {
        index["name"]
        for index in sa.inspect(op.get_bind()).get_indexes("approval_histories")
    }
    for index_name, column_name in (
        ("ix_approval_histories_restaurant_id", "restaurant_id"),
        ("ix_approval_histories_manager_id", "manager_id"),
        ("ix_approval_histories_action", "action"),
    ):
        if index_name not in existing_indexes:
            op.create_index(index_name, "approval_histories", [column_name])

    if not inspector.has_table("notification"):
        op.create_table(
            "notification",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("userId", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("isRead", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("createdAt", sa.String(), nullable=False),
            sa.Column("type", sa.String(), nullable=False, server_default="system"),
            sa.ForeignKeyConstraint(["userId"], ["user.userId"]),
        )


def downgrade():
    op.drop_index("ix_approval_histories_action", table_name="approval_histories")
    op.drop_index("ix_approval_histories_manager_id", table_name="approval_histories")
    op.drop_index("ix_approval_histories_restaurant_id", table_name="approval_histories")
    op.drop_table("approval_histories")
