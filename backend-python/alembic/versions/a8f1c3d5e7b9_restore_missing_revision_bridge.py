"""Restore the migration revision recorded by existing databases.

Revision ID: a8f1c3d5e7b9
Revises: c1d2e3f4a5b6

The revision was previously applied/stamped in deployed databases but its
source file was lost during a merge.  It restores the original ``source``
column when upgrading databases that do not already contain it.
"""
from alembic import context, op
import sqlalchemy as sa


revision = "a8f1c3d5e7b9"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    if context.is_offline_mode():
        return
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("violation_reports"):
        columns = {column["name"] for column in inspector.get_columns("violation_reports")}
        if "source" not in columns:
            op.add_column(
                "violation_reports",
                sa.Column("source", sa.String(length=30), nullable=False, server_default="customer_report"),
            )


def downgrade():
    if context.is_offline_mode():
        return
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("violation_reports"):
        columns = {column["name"] for column in inspector.get_columns("violation_reports")}
        if "source" in columns:
            op.drop_column("violation_reports", "source")
