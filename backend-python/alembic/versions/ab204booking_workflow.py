"""Booking cancellation, monthly fees, per-booking review and permanent bans."""
from alembic import op
import sqlalchemy as sa
revision = "ab204booking"
down_revision = "e2d9b3f7c110"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("booking_emails", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False),
        sa.Column("event", sa.String(), nullable=False), sa.Column("recipient", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False), sa.Column("body", sa.String(), nullable=False),
        sa.Column("sent_at", sa.String()), sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.String()))
    op.create_index("ix_booking_emails_booking_id", "booking_emails", ["booking_id"])
    for name in ("cancellationStatus", "cancellationReason", "cancellationEvidence", "cancellationActor", "expiredAt", "completedAt"):
        op.add_column("booking", sa.Column(name, sa.String(), nullable=True))
    op.add_column("user", sa.Column("is_permanently_banned", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("review", sa.Column("bookingId", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=True))
    # Keep legacy reviews visible; associate at most one existing review with each completed booking.
    op.execute(sa.text('''WITH ranked_reviews AS (
        SELECT "reviewId", "userId", "restaurantId", row_number() OVER (PARTITION BY "userId", "restaurantId" ORDER BY "reviewId") AS n FROM review
    ), ranked_bookings AS (
        SELECT "bookingId", "userId", "restaurantId", row_number() OVER (PARTITION BY "userId", "restaurantId" ORDER BY "bookingId") AS n FROM booking WHERE status = 'completed'
    ) UPDATE review r SET "bookingId" = b."bookingId" FROM ranked_reviews rr JOIN ranked_bookings b ON rr."userId" = b."userId" AND rr."restaurantId" = b."restaurantId" AND rr.n = b.n WHERE r."reviewId" = rr."reviewId"'''))
    op.create_unique_constraint("uq_review_booking", "review", ["bookingId"])
    op.create_table("booking_fees", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("booking.bookingId"), nullable=False, unique=True),
        sa.Column("restaurant_id", sa.Integer(), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False), sa.Column("due_at", sa.String(), nullable=False),
        sa.Column("settled_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("deducted_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reminder_month", sa.String()), sa.Column("proof_url", sa.String()))
    op.create_index("ix_booking_fees_restaurant_id", "booking_fees", ["restaurant_id"])

def downgrade():
    op.drop_table("booking_emails")
    op.drop_table("booking_fees")
    op.drop_constraint("uq_review_booking", "review", type_="unique")
    op.drop_column("review", "bookingId")
    op.drop_column("user", "is_permanently_banned")
    for name in ("cancellationStatus", "cancellationReason", "cancellationEvidence", "cancellationActor", "expiredAt", "completedAt"):
        op.drop_column("booking", name)
