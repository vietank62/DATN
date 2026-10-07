"""Persist restaurant cashier shifts, bills and table carts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("cashier_workspaces",
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False))

def downgrade():
    op.drop_table("cashier_workspaces")
