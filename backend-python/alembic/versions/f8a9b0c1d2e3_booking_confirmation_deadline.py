"""Separate confirmation/cancellation cutoff from advance booking."""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("booking_confirmation_minutes", sa.Integer(), nullable=False, server_default="60"))
    # Strictly smaller, nonnegative cutoffs require positive advance booking.
    op.execute("UPDATE restaurants SET booking_lead_minutes=1 WHERE booking_lead_minutes < 1")
    op.execute("UPDATE restaurants SET booking_confirmation_minutes=LEAST(60, booking_lead_minutes - 1)")
    op.create_check_constraint("ck_restaurant_confirmation_before_lead", "restaurants", "booking_confirmation_minutes >= 0 AND booking_confirmation_minutes < booking_lead_minutes")


def downgrade():
    op.drop_constraint("ck_restaurant_confirmation_before_lead", "restaurants", type_="check")
    op.drop_column("restaurants", "booking_confirmation_minutes")
