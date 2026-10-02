"""Durable booking receipts delivered through the Resend HTTPS API."""
import os
import logging
from datetime import datetime, timedelta, timezone
import httpx
from sqlmodel import select
from sqlalchemy import or_
from models.bookingEmail import BookingEmail
from models import Restaurant, Notification

logger = logging.getLogger(__name__)

def queue_booking_email(session, booking, event):
    if session.exec(select(BookingEmail.id).where(BookingEmail.booking_id == booking.bookingId, BookingEmail.event == event)).first():
        return
    restaurant = session.get(Restaurant, booking.restaurantId)
    labels = {"pending": "Chờ xác nhận", "confirmed": "Đã xác nhận", "completed": "Hoàn thành"}
    status = labels.get(event, event)
    frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    restaurant_name = restaurant.name if restaurant else "nhà hàng đã chọn"
    detail_url = f"{frontend}/account/bookings/{booking.bookingId}" if frontend else ""
    subject = f"[TableNow] Cập nhật đơn đặt bàn #{booking.bookingId} – {status}"
    body_lines = [
        f"Kính gửi Quý khách {booking.contactName},",
        "",
        "TableNow trân trọng thông báo thông tin đơn đặt bàn của Quý khách như sau:",
        "",
        f"Mã đơn: #{booking.bookingId}",
        f"Nhà hàng: {restaurant_name}",
        f"Thời gian dùng bữa: {booking.date}, {booking.time} (giờ Việt Nam)",
        f"Số lượng khách: {booking.guestCount} người lớn, {booking.childCount} trẻ em",
        f"Trạng thái đơn: {status}",
        f"Tiền đặt cọc: {booking.depositAmount:,} đ",
    ]
    if detail_url:
        body_lines.extend(["", f"Quý khách vui lòng xem chi tiết đơn đặt bàn tại: {detail_url}"])
    body_lines.extend([
        "",
        "Cảm ơn Quý khách đã lựa chọn TableNow. Chúng tôi rất hân hạnh được phục vụ Quý khách.",
        "",
        "Trân trọng,",
        "Đội ngũ TableNow",
    ])
    body = "\n".join(body_lines)
    session.add(BookingEmail(booking_id=booking.bookingId,event=event,recipient=booking.contactEmail,subject=subject,body=body))
    session.add(Notification(userId=booking.userId,bookingId=booking.bookingId,title=subject,message=f"Đơn đặt bàn: {status}",type="booking_status",createdAt=datetime.now(timezone.utc).isoformat()))
    if event == "pending" and restaurant and restaurant.manager_id:
        session.add(Notification(userId=restaurant.manager_id,bookingId=booking.bookingId,title="Có đơn đặt bàn mới",message=f"Đơn #{booking.bookingId}: {booking.date} {booking.time}. Vui lòng xác nhận trước giờ dùng bữa 2 tiếng.",type="new_booking",createdAt=datetime.now(timezone.utc).isoformat()))

def deliver_booking_emails(session):
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("RESEND_FROM")
    if not api_key or not sender:
        logger.warning("Booking emails are not configured: RESEND_API_KEY and RESEND_FROM are required.")
        return 0
    now = datetime.now(timezone.utc)
    rows = session.exec(select(BookingEmail).where(BookingEmail.sent_at == None,
        or_(BookingEmail.next_attempt_at == None, BookingEmail.next_attempt_at <= now.isoformat()))
        .order_by(BookingEmail.id).limit(3).with_for_update(skip_locked=True)).all()
    sent = 0
    sender_name = os.getenv("RESEND_FROM_NAME", "TableNow").strip() or "TableNow"
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(base_url="https://api.resend.com", headers=headers, timeout=10.0) as client:
        for row in rows:
            row.attempts += 1
            try:
                response = client.post("/emails", json={
                    "from": f"{sender_name} <{sender}>",
                    "to": [row.recipient],
                    "subject": row.subject,
                    "text": row.body,
                })
                response.raise_for_status()
                row.sent_at = now.isoformat()
                sent += 1
            except httpx.HTTPError:
                logger.exception("Unable to send booking email %s to %s through Resend; it will be retried.", row.id, row.recipient)
                row.next_attempt_at = (now + timedelta(minutes=min(1440, 2 ** min(row.attempts, 10)))).isoformat()
            session.add(row)
    session.commit()
    return sent
