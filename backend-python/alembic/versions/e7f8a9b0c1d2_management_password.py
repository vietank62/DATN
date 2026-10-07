"""Separate management password and persistent failed-attempt counters."""
from alembic import op
import sqlalchemy as sa

revision = "e7f8a9b0c1d2"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("management_access", sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.userId"), primary_key=True), sa.Column("password_hash", sa.String(), nullable=True), sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"), sa.Column("locked_until", sa.Float(), nullable=False, server_default="0"))


def downgrade():
    op.drop_table("management_access")
