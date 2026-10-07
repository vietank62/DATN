"""Restaurant setting for displaying menu prices to customers."""
from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("menu_prices_visible", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    op.drop_column("restaurants", "menu_prices_visible")
