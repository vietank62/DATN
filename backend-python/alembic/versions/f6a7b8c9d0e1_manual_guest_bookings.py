"""Allow restaurant-created reservations for guests without accounts."""
from alembic import op
import sqlalchemy as sa
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None
def upgrade():
    op.alter_column("booking", "userId", existing_type=sa.Integer(), nullable=True)
def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text('SELECT count(*) FROM booking WHERE "userId" IS NULL')).scalar():
        raise RuntimeError("Guest reservations must be linked to accounts before downgrading.")
    op.alter_column("booking", "userId", existing_type=sa.Integer(), nullable=False)
