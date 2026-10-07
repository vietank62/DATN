"""Store natural language surveys and grounded AI suggestions."""
from alembic import op
import sqlalchemy as sa
revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("customer_preferences", sa.Column("survey", sa.JSON(), nullable=False, server_default='{}'))
    op.add_column("customer_preferences", sa.Column("ai_matches", sa.JSON(), nullable=False, server_default='[]'))

def downgrade():
    op.drop_column("customer_preferences", "ai_matches")
    op.drop_column("customer_preferences", "survey")
