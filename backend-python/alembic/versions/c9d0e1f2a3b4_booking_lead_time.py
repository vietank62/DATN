"""Configurable minimum advance booking time per restaurant."""
from alembic import op
import sqlalchemy as sa

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("restaurants", sa.Column("booking_lead_minutes", sa.Integer(), nullable=False, server_default="120"))

def downgrade():
    op.drop_column("restaurants", "booking_lead_minutes")
