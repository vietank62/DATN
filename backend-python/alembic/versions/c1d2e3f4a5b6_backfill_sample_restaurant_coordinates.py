"""Backfill coordinates for the bundled restaurant catalogue."""
from alembic import op
import sqlalchemy as sa

revision = "c1d2e3f4a5b6"
down_revision = "ab204booking"
branch_labels = None
depends_on = None

COORDINATES = {
    1: (10.7655, 106.6920), 2: (10.7345, 106.7060), 3: (21.0320, 105.8000),
    4: (10.7695, 106.6925), 5: (10.7702, 106.6867), 6: (10.7330, 106.7040),
    7: (10.7588, 106.7040), 8: (10.8020, 106.7110), 9: (10.7540, 106.6680),
    10: (10.8490, 106.7580), 11: (10.8000, 106.6870), 12: (10.7940, 106.6650),
    13: (10.7700, 106.6680), 14: (21.0350, 105.8520), 15: (21.0360, 105.7890),
    16: (21.0430, 105.8120), 17: (21.0690, 105.8180), 18: (21.0120, 105.8230),
    19: (16.0678, 108.2240), 20: (16.0750, 108.2480), 21: (16.0440, 108.2160),
    22: (16.0490, 108.2440), 23: (16.0660, 108.2000), 24: (10.8380, 106.6400),
}


def upgrade():
    for restaurant_id, (latitude, longitude) in COORDINATES.items():
        op.execute(
            sa.text("UPDATE restaurants SET latitude = :latitude, longitude = :longitude "
                    "WHERE id = :restaurant_id AND latitude IS NULL AND longitude IS NULL")
            .bindparams(latitude=latitude, longitude=longitude, restaurant_id=restaurant_id)
        )


def downgrade():
    for restaurant_id in COORDINATES:
        op.execute(sa.text("UPDATE restaurants SET latitude = NULL, longitude = NULL WHERE id = :restaurant_id").bindparams(restaurant_id=restaurant_id))
