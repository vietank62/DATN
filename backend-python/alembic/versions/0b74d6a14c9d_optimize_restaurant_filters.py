"""optimize restaurant filters

Revision ID: 0b74d6a14c9d
Revises: 4a1d08c2b10b
Create Date: 2026-08-09 15:32:14.321015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '0b74d6a14c9d'
down_revision: Union[str, Sequence[str], None] = '4a1d08c2b10b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_index(
        "ix_restaurants_city_like_count_active",
        "restaurants",
        ["city", sa.text("like_count DESC")],
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_index(
        "ix_restaurants_city_rating_active",
        "restaurants",
        ["city", sa.text("rating DESC")],
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_index(
        "ix_restaurants_city_created_at_active",
        "restaurants",
        ["city", sa.text("created_at DESC")],
        postgresql_where=sa.text("is_active = true"),
    )

    op.create_index("ix_restaurants_category_gin", "restaurants", ["category"], postgresql_using="gin")
    op.create_index("ix_restaurants_suitable_for_gin", "restaurants", ["suitable_for"], postgresql_using="gin")
    op.create_index("ix_restaurants_service_types_gin", "restaurants", ["service_types"], postgresql_using="gin")
    op.create_index(
        "ix_restaurants_name_trgm",
        "restaurants",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_restaurants_name_trgm", table_name="restaurants")
    op.drop_index("ix_restaurants_service_types_gin", table_name="restaurants")
    op.drop_index("ix_restaurants_suitable_for_gin", table_name="restaurants")
    op.drop_index("ix_restaurants_category_gin", table_name="restaurants")
    op.drop_index("ix_restaurants_city_created_at_active", table_name="restaurants")
    op.drop_index("ix_restaurants_city_rating_active", table_name="restaurants")
    op.drop_index("ix_restaurants_city_like_count_active", table_name="restaurants")
