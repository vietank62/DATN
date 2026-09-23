"""Add customer restaurant messages."""
from alembic import op
import sqlalchemy as sa
revision="e2f3a4b5c6d7"
down_revision="d1e2f3a4b5c6"
branch_labels=None
depends_on=None
def upgrade():
    op.create_table("chat_messages", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("restaurantId", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False), sa.Column("senderId", sa.Integer(), sa.ForeignKey("user.userId"), nullable=False), sa.Column("recipientId", sa.Integer(), sa.ForeignKey("user.userId"), nullable=False), sa.Column("content", sa.String(), nullable=False), sa.Column("createdAt", sa.String(), nullable=False), sa.Column("readAt", sa.String()))
    op.create_index("ix_chat_messages_restaurantId", "chat_messages", ["restaurantId"])
    op.create_index("ix_chat_messages_senderId", "chat_messages", ["senderId"])
    op.create_index("ix_chat_messages_recipientId", "chat_messages", ["recipientId"])
def downgrade(): op.drop_table("chat_messages")
