"""Queue a voucher chat message in the booking confirmation transaction."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from models.conversation import Conversation
from models.chatMessage import ChatMessage
from models.notification import Notification
from core.booking_policy import APP_TIME_ZONE


def send_booking_voucher(session, booking, restaurant, sender_id, voucher_id):
    if booking.userId is None:
        raise HTTPException(422, "Khách chưa có tài khoản để nhận voucher qua hội thoại")
    voucher = session.execute(text("SELECT * FROM restaurant_discounts WHERE id=:id AND restaurant_id=:restaurant_id AND is_active AND expires_at > CURRENT_TIMESTAMP FOR UPDATE"), {"id": voucher_id, "restaurant_id": restaurant.id}).mappings().first()
    if not voucher:
        raise HTTPException(422, "Voucher không thuộc nhà hàng, đã hết hạn hoặc đã ngừng áp dụng")
    now = datetime.now(timezone.utc)
    conversation_id = session.execute(
        insert(Conversation).values(customer_id=booking.userId, restaurant_id=restaurant.id, created_at=now, last_message_at=now)
        .on_conflict_do_update(constraint="uq_conversation_customer_restaurant", set_={"last_message_at": now})
        .returning(Conversation.id)
    ).scalar_one()
    value = f"{voucher['value']}%" if voucher["kind"] == "percent" else f"{voucher['value']:,}đ"
    content = (
        f"{restaurant.name} đã xác nhận đơn #{booking.bookingId} của bạn, ngày {booking.date} lúc {booking.time}.\n"
        f"Tặng bạn voucher: {voucher['title']}\nMã: {voucher['code']} · Giảm {value}\n"
        f"Áp dụng tại {restaurant.name} cho hóa đơn từ {voucher['minimum']:,}đ.\n"
        f"Hạn dùng: {voucher['expires_at'].astimezone(APP_TIME_ZONE).strftime('%d/%m/%Y %H:%M')} (Việt Nam).\n"
        "Vui lòng cung cấp mã khi thanh toán tại nhà hàng."
    )
    session.add(ChatMessage(conversation_id=conversation_id, sender_id=sender_id, content=content, created_at=now))
    session.add(Notification(userId=booking.userId, bookingId=booking.bookingId, conversationId=conversation_id, title=f"Voucher từ {restaurant.name}", message=f"Đơn #{booking.bookingId} đã xác nhận. Mã ưu đãi: {voucher['code']}", type="chat_message", createdAt=now.isoformat()))
    return conversation_id
