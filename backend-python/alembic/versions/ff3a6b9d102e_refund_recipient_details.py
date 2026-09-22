"""Collect customer refund recipient details and link booking notifications."""
from alembic import op
import sqlalchemy as sa
revision = "ff3a6b9d102e"
down_revision = "fe2f5a7b9c04"
branch_labels = None
depends_on = None


def upgrade():
    for name, kind in [("bank_name",sa.String(120)),("account_name",sa.String(120)),("account_number",sa.String(50)),("qr_image_url",sa.String(500)),("submitted_at",sa.String()),("processed_by",sa.Integer())]:
        op.add_column("deposit_refunds",sa.Column(name,kind,nullable=True))
    op.create_foreign_key("fk_refund_processed_by","deposit_refunds","user",["processed_by"],["userId"])
    op.add_column("notification",sa.Column("bookingId",sa.Integer(),nullable=True))
    op.create_index("ix_notification_bookingId","notification",["bookingId"])
    # Existing pending refunds also need a usable link, without rewriting unrelated notices.
    op.execute(sa.text("""INSERT INTO notification ("userId", "bookingId", title, message, "isRead", "createdAt", type)
        SELECT customer_id, booking_id, 'Bổ sung thông tin nhận hoàn cọc',
        'Đơn #' || booking_id || ' đã được đưa vào danh sách hoàn cọc. Vui lòng cung cấp tài khoản nhận tiền; ảnh QR không bắt buộc.',
        false, CURRENT_TIMESTAMP::text, 'refund_required'
        FROM deposit_refunds WHERE status = 'pending'"""))


def downgrade():
    op.drop_index("ix_notification_bookingId",table_name="notification")
    op.drop_column("notification","bookingId")
    op.drop_constraint("fk_refund_processed_by","deposit_refunds",type_="foreignkey")
    for name in ("processed_by","submitted_at","qr_image_url","account_number","account_name","bank_name"):
        op.drop_column("deposit_refunds",name)
