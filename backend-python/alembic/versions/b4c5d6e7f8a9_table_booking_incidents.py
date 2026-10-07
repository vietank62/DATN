"""Track table conflicts and restaurant solutions submitted to admin."""
from alembic import op
import sqlalchemy as sa
revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("table_booking_incidents",
        sa.Column("id",sa.Integer(),primary_key=True),
        sa.Column("restaurant_id",sa.Integer(),sa.ForeignKey("restaurants.id"),nullable=False),
        sa.Column("booking_id",sa.Integer(),sa.ForeignKey("booking.bookingId"),nullable=False),
        sa.Column("table_id",sa.Integer(),nullable=False),
        sa.Column("state",sa.String(20),nullable=False,server_default="open"),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column("cleared_at",sa.DateTime(timezone=True)),
        sa.Column("solution",sa.Text()),sa.Column("submitted_by",sa.Integer()),
        sa.Column("submitted_at",sa.DateTime(timezone=True)),
        sa.Column("admin_note",sa.Text()),sa.Column("reviewed_by",sa.Integer()),
        sa.Column("reviewed_at",sa.DateTime(timezone=True)),
        sa.UniqueConstraint("booking_id","table_id",name="uq_booking_table_incident"))
    op.create_index("ix_table_incidents_restaurant", "table_booking_incidents", ["restaurant_id","state"])


def downgrade():
    op.drop_table("table_booking_incidents")
