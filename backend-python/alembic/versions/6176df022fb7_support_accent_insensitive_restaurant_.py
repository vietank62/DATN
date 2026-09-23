"""support accent insensitive restaurant search

Revision ID: 6176df022fb7
Revises: 0b74d6a14c9d
Create Date: 2026-08-09 17:29:34.146257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '6176df022fb7'
down_revision: Union[str, Sequence[str], None] = '0b74d6a14c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION immutable_unaccent(input_text text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
        STRICT
        AS $$
            SELECT public.unaccent(input_text)
        $$
        """
    )

    op.drop_index("ix_restaurants_name_trgm", table_name="restaurants")
    op.create_index(
        "ix_restaurants_name_unaccent_trgm",
        "restaurants",
        [sa.text("immutable_unaccent(name) gin_trgm_ops")],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_restaurants_city_unaccent_trgm",
        "restaurants",
        [sa.text("immutable_unaccent(city) gin_trgm_ops")],
        postgresql_using="gin",
    )
    op.create_index(
        "ix_restaurants_district_unaccent_trgm",
        "restaurants",
        [sa.text("immutable_unaccent(district) gin_trgm_ops")],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_restaurants_district_unaccent_trgm", table_name="restaurants")
    op.drop_index("ix_restaurants_city_unaccent_trgm", table_name="restaurants")
    op.drop_index("ix_restaurants_name_unaccent_trgm", table_name="restaurants")
    op.create_index(
        "ix_restaurants_name_trgm",
        "restaurants",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text)")
