"""track partner approval changes

Revision ID: f2b5d81a4c70
Revises: e1a4c63f9b20
Create Date: 2026-08-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f2b5d81a4c70"
down_revision = "e1a4c63f9b20"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "restaurants",
        sa.Column(
            "pending_approval_fields",
            postgresql.ARRAY(sa.Text()),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("restaurants", "pending_approval_fields")
