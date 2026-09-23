"""add customer preferences

Revision ID: e2d9b3f7c110
Revises: 0a1b2c3d4e5f
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "e2d9b3f7c110"
down_revision = "0a1b2c3d4e5f"
branch_labels = None
depends_on = None
def upgrade():
    if not sa.inspect(op.get_bind()).has_table("customer_preferences"):
        op.create_table("customer_preferences", sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.userId"), primary_key=True), sa.Column("categories", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"), sa.Column("suitable_for", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"), sa.Column("service_types", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"), sa.Column("price_level", sa.Integer()), sa.Column("city", sa.String(100)), sa.Column("updated_at", sa.String()))
def downgrade(): op.drop_table("customer_preferences")
