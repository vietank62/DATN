"""Add suspension workflow and one review per booking."""
from alembic import op
import sqlalchemy as sa
revision = "d1e2f3a4b5c6"
down_revision = "4a1d08c2b10b"
branch_labels = None
depends_on = None
def upgrade():
    op.add_column("user", sa.Column("isSuspended", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("user", sa.Column("suspensionReason", sa.String(), nullable=True))
    op.add_column("user", sa.Column("appealText", sa.String(), nullable=True))
    op.add_column("user", sa.Column("appealStatus", sa.String(), nullable=True))
    op.add_column("review", sa.Column("bookingId", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_review_booking", "review", "booking", ["bookingId"], ["bookingId"])
    op.create_unique_constraint("uq_review_booking", "review", ["bookingId"])
def downgrade():
    op.drop_constraint("uq_review_booking", "review", type_="unique")
    op.drop_constraint("fk_review_booking", "review", type_="foreignkey")
    op.drop_column("review", "bookingId")
    op.drop_column("user", "appealStatus"); op.drop_column("user", "appealText"); op.drop_column("user", "suspensionReason"); op.drop_column("user", "isSuspended")
