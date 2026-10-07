"""Per-restaurant enabled POS payment methods and default selection."""
from alembic import op
import sqlalchemy as sa

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("restaurants", sa.Column("cashier_payment_methods", sa.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY['Tiền mặt','Chuyển khoản','ATM','Apple Pay','Visa']::text[]")))
    op.add_column("restaurants", sa.Column("cashier_default_payment_method", sa.String(30), nullable=False, server_default="Tiền mặt"))

def downgrade():
    op.drop_column("restaurants", "cashier_default_payment_method")
    op.drop_column("restaurants", "cashier_payment_methods")
