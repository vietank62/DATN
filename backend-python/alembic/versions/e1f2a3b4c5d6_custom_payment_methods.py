"""Allow custom POS methods and persist the available method catalog."""
from alembic import op
import sqlalchemy as sa
revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("restaurants", sa.Column("cashier_payment_method_options", sa.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY['Tiền mặt','Chuyển khoản','ATM','Apple Pay','Visa']::text[]")))

def downgrade():
    op.drop_column("restaurants", "cashier_payment_method_options")
