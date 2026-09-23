"""Optimize public restaurant listing.

Revision ID: ee4d1c9a20f7
Revises: d7f3a1b842c9
Create Date: 2026-08-24
"""

from alembic import op


revision = "ee4d1c9a20f7"
down_revision = "d7f3a1b842c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_active_city "
        "ON restaurants (city) WHERE is_active = true"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_active_city_district "
        "ON restaurants (city, district) WHERE is_active = true"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_active_price "
        "ON restaurants (price_avg) WHERE is_active = true"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_active_rating "
        "ON restaurants (rating DESC) WHERE is_active = true"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_active_exclusive "
        "ON restaurants (has_exclusive) WHERE is_active = true"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_category_gin "
        "ON restaurants USING gin (category)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_restaurants_search_vector "
        "ON restaurants USING gin (to_tsvector('simple', "
        "immutable_unaccent(coalesce(name, '') || ' ' || coalesce(address, '') "
        "|| ' ' || coalesce(district, '') || ' ' || coalesce(city, ''))))"
    )


def downgrade() -> None:
    for index_name in (
        "ix_restaurants_search_vector",
        "ix_restaurants_category_gin",
        "ix_restaurants_active_exclusive",
        "ix_restaurants_active_rating",
        "ix_restaurants_active_price",
        "ix_restaurants_active_city_district",
        "ix_restaurants_active_city",
    ):
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
