"""link chat notifications to conversations

Revision ID: c6e2d9a410b7
Revises: b4d8e6f1c230
Create Date: 2026-08-20
"""

from alembic import context, op
import sqlalchemy as sa


revision = "c6e2d9a410b7"
down_revision = "b4d8e6f1c230"
branch_labels = None
depends_on = None


def upgrade():
    if context.is_offline_mode():
        class OfflineInspector:
            def get_columns(self, _name): return []
            def get_indexes(self, _name): return []
        inspector = OfflineInspector()
    else:
        inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("notification")}

    if "conversationId" not in columns:
        op.add_column(
            "notification",
            sa.Column("conversationId", sa.Integer(), nullable=True),
        )

    indexes = {index["name"] for index in inspector.get_indexes("notification")}
    if "ix_notification_conversationId" not in indexes:
        op.create_index(
            "ix_notification_conversationId",
            "notification",
            ["conversationId"],
        )


def downgrade():
    op.drop_index("ix_notification_conversationId", table_name="notification")
    op.drop_column("notification", "conversationId")
