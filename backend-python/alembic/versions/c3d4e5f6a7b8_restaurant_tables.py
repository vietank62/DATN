"""Add real restaurant tables and booking assignments."""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("restaurant_tables", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False), sa.Column("name", sa.String(60), nullable=False), sa.Column("seats", sa.Integer(), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()), sa.UniqueConstraint("restaurant_id", "name", name="uq_restaurant_table_name"))
    op.create_index("ix_restaurant_tables_restaurant_id", "restaurant_tables", ["restaurant_id"])
    op.create_table("booking_tables", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False), sa.Column("table_id", sa.Integer(), sa.ForeignKey("restaurant_tables.id"), nullable=False), sa.UniqueConstraint("booking_id", "table_id", name="uq_booking_table_assignment"))
    op.create_index("ix_booking_tables_booking_id", "booking_tables", ["booking_id"])
    op.create_index("ix_booking_tables_table_id", "booking_tables", ["table_id"])


def downgrade():
    op.drop_table("booking_tables")
    op.drop_table("restaurant_tables")
