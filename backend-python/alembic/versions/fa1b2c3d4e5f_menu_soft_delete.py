"""Keep deleted menu items available to historical bookings."""
from alembic import op
import sqlalchemy as sa

revision = "fa1b2c3d4e5f"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurant_menu_lists", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("restaurant_menu_lists", "is_deleted")
