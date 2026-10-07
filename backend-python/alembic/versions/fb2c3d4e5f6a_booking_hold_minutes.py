"""Configure how long an unarrived guest's table is held."""
from alembic import op
import sqlalchemy as sa

revision = "fb2c3d4e5f6a"
down_revision = "fa1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("booking_hold_minutes", sa.Integer(), nullable=False, server_default="30"))
    op.create_check_constraint("ck_restaurant_booking_hold_minutes", "restaurants", "booking_hold_minutes BETWEEN 1 AND 240")


def downgrade():
    op.drop_constraint("ck_restaurant_booking_hold_minutes", "restaurants", type_="check")
    op.drop_column("restaurants", "booking_hold_minutes")
