"""Bound and schedule checkout cancellation retries."""
from alembic import op
import sqlalchemy as sa
revision = "fd1e4a6c8b93"
down_revision = "fc9d3f5b7e82"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("deposit_checkouts", sa.Column("cancel_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("deposit_checkouts", sa.Column("next_cancel_at", sa.String(), nullable=True))
    op.create_index("ix_deposit_checkouts_next_cancel_at", "deposit_checkouts", ["next_cancel_at"])


def downgrade():
    op.drop_index("ix_deposit_checkouts_next_cancel_at", table_name="deposit_checkouts")
    op.drop_column("deposit_checkouts", "next_cancel_at")
    op.drop_column("deposit_checkouts", "cancel_attempts")
