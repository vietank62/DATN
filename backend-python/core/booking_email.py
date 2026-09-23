"""Durable booking receipts. SMTP is optional; queued mail stays pending until configured."""
import os
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from sqlmodel import select
from sqlalchemy import or_
from models.bookingEmail import BookingEmail
from models import Restaurant, Notification

def queue_booking_email(session, booking, event):
    if session.exec(select(BookingEmail.id).where(BookingEmail.booking_id == booking.bookingId, BookingEmail.event == event)).first():
        return
    restaurant = session.get(Restaurant, booking.restaurantId)
    labels = {"pending": "Chờ xác nhận", "confirmed": "Đã xác nhận", "completed": "Hoàn thành"}
    status = labels.get(event, event)
    frontend = os.getenv("FRONTEND_URL", "").rstrip("/")
    subject = f"TableNow - Đơn #{booking.bookingId}: {status}"
    body = f"Xin chào {booking.contactName},\nĐơn #{booking.bookingId} tại {restaurant.name if restaurant else 'nhà hàng'}\nNgày {booking.date}, giờ {booking.time} (Việt Nam)\nSố người: {booking.guestCount}, trẻ em: {booking.childCount}\nTrạng thái: {status}\nTiền cọc: {booking.depositAmount:,}đ\nChi tiết: {frontend}/account/bookings/{booking.bookingId}"
    session.add(BookingEmail(booking_id=booking.bookingId,event=event,recipient=booking.contactEmail,subject=subject,body=body))
    session.add(Notification(userId=booking.userId,bookingId=booking.bookingId,title=subject,message=f"Đơn đặt bàn: {status}",type="booking_status",createdAt=datetime.now(timezone.utc).isoformat()))
    if event == "pending" and restaurant and restaurant.manager_id:
        session.add(Notification(userId=restaurant.manager_id,bookingId=booking.bookingId,title="Có đơn đặt bàn mới",message=f"Đơn #{booking.bookingId}: {booking.date} {booking.time}. Vui lòng xác nhận trước giờ dùng bữa 2 tiếng.",type="new_booking",createdAt=datetime.now(timezone.utc).isoformat()))

def deliver_booking_emails(session):
    host, sender = os.getenv("SMTP_HOST"), os.getenv("SMTP_FROM")
    if not host or not sender:
        return 0
    now = datetime.now(timezone.utc)
    rows = session.exec(select(BookingEmail).where(BookingEmail.sent_at == None,
        or_(BookingEmail.next_attempt_at == None, BookingEmail.next_attempt_at <= now.isoformat()))
        .order_by(BookingEmail.id).limit(3).with_for_update(skip_locked=True)).all()
    sent = 0
    for row in rows:
        row.attempts += 1
        try:
            message = EmailMessage()
            message["From"], message["To"], message["Subject"] = sender, row.recipient, row.subject
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
