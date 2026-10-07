"""Restaurant promotions shown publicly and shared in chat."""
from alembic import op
import sqlalchemy as sa
revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("restaurant_discounts",
        sa.Column("id",sa.Integer(),primary_key=True),
        sa.Column("restaurant_id",sa.Integer(),sa.ForeignKey("restaurants.id"),nullable=False),
        sa.Column("code",sa.String(40),nullable=False),
        sa.Column("title",sa.String(150),nullable=False),
        sa.Column("kind",sa.String(10),nullable=False),
        sa.Column("value",sa.Integer(),nullable=False),
        sa.Column("minimum",sa.Integer(),nullable=False),
        sa.Column("expires_at",sa.DateTime(timezone=True),nullable=False),
        sa.Column("is_public",sa.Boolean(),nullable=False),
        sa.Column("is_active",sa.Boolean(),nullable=False),
        sa.UniqueConstraint("restaurant_id","code",name="uq_restaurant_discount_code"))
    op.create_index("ix_discount_restaurant", "restaurant_discounts", ["restaurant_id"])
def downgrade():
    op.drop_table("restaurant_discounts")
