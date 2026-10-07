"""Restaurant-level VAT switch; enabled VAT is fixed at 8 percent."""
from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("restaurants", sa.Column("vat_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))

def downgrade():
    op.drop_column("restaurants", "vat_enabled")
