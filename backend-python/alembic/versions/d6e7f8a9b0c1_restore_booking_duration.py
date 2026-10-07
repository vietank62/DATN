"""Restore the meal duration field and its default across merged schemas."""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("restaurants")}
    if "booking_duration_minutes" not in columns:
        op.add_column("restaurants", sa.Column("booking_duration_minutes", sa.Integer(), nullable=False, server_default="120"))
    else:
        op.execute("UPDATE restaurants SET booking_duration_minutes=120 WHERE booking_duration_minutes IS NULL")
        op.alter_column("restaurants", "booking_duration_minutes", existing_type=sa.Integer(), nullable=False, server_default="120")

def downgrade():
    # This column can predate this repair; preserve it and existing restaurant data.
    pass
