"""add customer manager chat

Revision ID: b4d8e6f1c230
Revises: a7c9e4b12d60
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa


revision = "b4d8e6f1c230"
down_revision = "a7c9e4b12d60"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("conversations"):
        op.create_table(
            "conversations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("customer_id", sa.Integer(), nullable=False),
            sa.Column("restaurant_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["customer_id"], ["user.userId"]),
            sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
            sa.UniqueConstraint("customer_id", "restaurant_id", name="uq_conversation_customer_restaurant"),
        )
    if not inspector.has_table("chat_messages"):
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("conversation_id", sa.Integer(), nullable=False),
            sa.Column("sender_id", sa.Integer(), nullable=False),
            sa.Column("content", sa.String(length=2000), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
            sa.ForeignKeyConstraint(["sender_id"], ["user.userId"]),
        )

    existing_conversation_indexes = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_indexes("conversations")
    }
    for name, column in (
        ("ix_conversations_customer_id", "customer_id"),
        ("ix_conversations_restaurant_id", "restaurant_id"),
        ("ix_conversations_last_message_at", "last_message_at"),
    ):
        if name not in existing_conversation_indexes:
            op.create_index(name, "conversations", [column])

    existing_unique_constraints = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_unique_constraints("conversations")
        if item["name"]
    }
    if "uq_conversation_customer_restaurant" not in existing_unique_constraints:
        op.create_unique_constraint(
            "uq_conversation_customer_restaurant",
            "conversations",
            ["customer_id", "restaurant_id"],
        )

    existing_message_indexes = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_indexes("chat_messages")
    }
    for name, column in (
        ("ix_chat_messages_conversation_id", "conversation_id"),
        ("ix_chat_messages_sender_id", "sender_id"),
        ("ix_chat_messages_created_at", "created_at"),
    ):
        if name not in existing_message_indexes:
            op.create_index(name, "chat_messages", [column])


def downgrade():
    op.drop_table("chat_messages")
    op.drop_table("conversations")
