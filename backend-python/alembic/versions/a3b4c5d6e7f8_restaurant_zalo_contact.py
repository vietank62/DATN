"""Optional restaurant Zalo contact."""
from alembic import op
import sqlalchemy as sa

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurant_details", sa.Column("zalo_number", sa.String(20), nullable=True))


def downgrade():
    op.drop_column("restaurant_details", "zalo_number")
