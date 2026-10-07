"""Record arrival decision for confirmed reservations."""
from alembic import op
import sqlalchemy as sa
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None
def upgrade():
    op.add_column("booking", sa.Column("attendance", sa.String(20), nullable=True))
def downgrade():
    op.drop_column("booking", "attendance")
