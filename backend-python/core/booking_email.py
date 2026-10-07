"""Durable booking receipts. SMTP is optional; queued mail stays pending until configured."""
import os
import smtplib
import ssl
import logging
from email.message import EmailMessage
from email.utils import formataddr
from datetime import datetime, timedelta, timezone
from sqlmodel import select
from sqlalchemy import or_
from models.bookingEmail import BookingEmail
from models import Restaurant, Notification

logger = logging.getLogger(__name__)


def deliver_booking_emails_background(booking_id: int):
    """Deliver after the response, using a session owned by this task."""
    from sqlmodel import Session
    from database import engine
    try:
        with Session(engine) as session:
            return deliver_booking_emails(session, booking_id=booking_id, ignore_retry_schedule=True)
    except Exception:
        # The outbox was committed before scheduling; maintenance can retry.
        logger.exception("Background booking email delivery failed for booking %s", booking_id)

def queue_booking_email(session, booking, event):
    # A deposit-required booking is not received until payment is verified.
    if event == "awaiting_payment" or (event == "pending" and booking.depositAmount > 0 and booking.depositStatus != "paid"):
        return
    if session.exec(select(BookingEmail.id).where(BookingEmail.booking_id == booking.bookingId, BookingEmail.event == event)).first():
        return
    restaurant = session.get(Restaurant, booking.restaurantId)
    labels = {"awaiting_payment": "Chờ thanh toán đặt cọc", "pending": "Chờ xác nhận", "confirmed": "Đã xác nhận", "completed": "Hoàn thành", "cancelled": "Đã hủy", "rejected": "Đặt bàn không thành công", "payment_expired": "Thanh toán không thành công", "expired": "Hết hạn phản hồi"}
    status = labels.get(event, "Đã cập nhật")
    frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    paid = event == "pending" and booking.depositAmount > 0 and booking.depositStatus == "paid"
    subject = f"TableNow – {'Đã nhận thanh toán đặt cọc' if paid else status} – Đơn đặt bàn #{booking.bookingId}"
    introductions = {"pending": "TableNow đã tiếp nhận yêu cầu đặt bàn của Quý khách. Nhà hàng sẽ kiểm tra và phản hồi xác nhận.", "confirmed": "Nhà hàng đã xác nhận đơn đặt bàn của Quý khách. Kính mong Quý khách đến đúng giờ để được phục vụ chu đáo.", "completed": "Đơn đặt bàn của Quý khách đã hoàn thành. TableNow cảm ơn Quý khách đã tin tưởng sử dụng dịch vụ.", "cancelled": "Đơn đặt bàn của Quý khách đã được hủy. Quý khách có thể xem thông tin xử lý đặt cọc, nếu có, tại trang chi tiết đơn."}
    introduction = "TableNow đã ghi nhận thanh toán đặt cọc thành công. Yêu cầu đặt bàn của Quý khách đang chờ nhà hàng xác nhận." if paid else introductions.get(event, "TableNow kính gửi Quý khách thông tin cập nhật về đơn đặt bàn.")
    try:
        date = datetime.strptime(booking.date, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        date = booking.date
    amount = f"{booking.depositAmount:,}".replace(",", ".")
    body = (f"Kính gửi Quý khách {booking.contactName},\n\n{introduction}\n\n"
            f"THÔNG TIN ĐẶT BÀN\nMã đơn: #{booking.bookingId}\nNhà hàng: {restaurant.name if restaurant else 'Nhà hàng'}\n"
            f"Ngày dùng bữa: {date}\nGiờ dùng bữa: {booking.time[:5]} (giờ Việt Nam)\n"
            f"Số người lớn: {booking.guestCount}\nSố trẻ em: {booking.childCount}\nTrạng thái đơn: {status}\n"
            f"Tiền đặt cọc: {amount} đồng\n\nXem chi tiết và theo dõi đơn đặt bàn:\n{frontend}/account/bookings/{booking.bookingId}\n\n"
            "Trân trọng,\nĐội ngũ TableNow\nNền tảng đặt bàn nhà hàng")
    session.add(BookingEmail(booking_id=booking.bookingId,event=event,recipient=booking.contactEmail,subject=subject,body=body))
    if booking.userId is not None:
        session.add(Notification(userId=booking.userId,bookingId=booking.bookingId,title=subject,message=f"Đơn đặt bàn: {status}",type="booking_status",createdAt=datetime.now(timezone.utc).isoformat()))
    if event == "pending" and restaurant and restaurant.manager_id:
        from core.booking_policy import confirmation_lead
        lead = int(confirmation_lead(restaurant).total_seconds() // 60)
        session.add(Notification(userId=restaurant.manager_id,bookingId=booking.bookingId,title="Có đơn đặt bàn mới",message=f"Đơn #{booking.bookingId}: {booking.date} {booking.time}. Vui lòng xác nhận trước mốc {lead} phút trước giờ dùng bữa.",type="new_booking",createdAt=datetime.now(timezone.utc).isoformat()))

def deliver_booking_emails(session, booking_id=None, ignore_retry_schedule=False):
    host, sender = os.getenv("SMTP_HOST"), os.getenv("SMTP_FROM")
    if not host or not sender:
        return 0
    now = datetime.now(timezone.utc)
    query = select(BookingEmail).where(BookingEmail.sent_at == None, BookingEmail.event != "awaiting_payment")
    if booking_id is not None:
        query = query.where(BookingEmail.booking_id == booking_id)
    if not ignore_retry_schedule:
        query = query.where(or_(BookingEmail.next_attempt_at == None, BookingEmail.next_attempt_at <= now.isoformat()))
    rows = session.exec(query.order_by(BookingEmail.id).limit(3).with_for_update(skip_locked=True)).all()
    sent = 0
    for row in rows:
        row.attempts += 1
        try:
            message = EmailMessage()
            message["From"], message["To"], message["Subject"] = formataddr((os.getenv("SMTP_FROM_NAME", "TableNow"), sender)), row.recipient, row.subject
            message["Message-ID"] = f"<tablenow-booking-{row.id}@{sender.rsplit('@',1)[-1]}>"
            message.set_content(row.body)
            use_ssl = os.getenv("SMTP_SSL", "false").lower() == "true"
            client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
            with client(host, int(os.getenv("SMTP_PORT", "465" if use_ssl else "587")), timeout=10) as smtp:
                if not use_ssl:
                    smtp.starttls(context=ssl.create_default_context())
                if os.getenv("SMTP_USER"):
                    smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                smtp.send_message(message)
            row.sent_at = now.isoformat()
            sent += 1
        except (OSError, smtplib.SMTPException):
            row.next_attempt_at = (now + timedelta(minutes=min(1440, 2 ** min(row.attempts, 10)))).isoformat()
        session.add(row)
    session.commit()
    return sent
