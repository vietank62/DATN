"""Gateway checkout lifecycle. Lock ordering is always booking, then checkout."""
import hmac
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy import func, or_
from concurrent.futures import ThreadPoolExecutor

from core.deposit_expiry import deposit_deadline, expire_locked_deposit
from core.sepay_gateway import checkout_form, gateway_config, cancel_gateway_order
from models.booking import Booking
from models.depositCheckout import DepositCheckout
from models.depositPayment import DepositPayment
from models.notification import Notification
from models.user import User

VN_TIMEZONE = timezone(timedelta(hours=7))


def utc_now():
    return datetime.now(timezone.utc)


def parse_time(value, naive_zone=timezone.utc):
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=naive_zone) if parsed.tzinfo is None else parsed


def lock_booking(session, booking_id):
    return session.exec(select(Booking).where(Booking.bookingId == booking_id)
        .with_for_update().execution_options(populate_existing=True)).first()


def expire_checkout_rows(session, booking, now):
    attempts = session.exec(select(DepositCheckout).where(
        DepositCheckout.booking_id == booking.bookingId
    ).order_by(DepositCheckout.id).with_for_update()
        .execution_options(populate_existing=True)).all()
    for attempt in attempts:
        if attempt.status == "pending" and (
            now >= parse_time(attempt.expires_at) or booking.status != "awaiting_payment"
        ):
            attempt.status = "expired" if now >= parse_time(attempt.expires_at) else "cancelled"
            session.add(attempt)
    return attempts


def checkout_status(session, booking_id, user_id):
    # One snapshot query for normal polling; lock rows only when a transition is due.
    latest_id = select(func.max(DepositCheckout.id)).where(
        DepositCheckout.booking_id == Booking.bookingId).correlate(Booking).scalar_subquery()
    review_exists = select(DepositCheckout.id).where(
        DepositCheckout.booking_id == Booking.bookingId, DepositCheckout.status == "review"
    ).correlate(Booking).exists()
    row = session.exec(select(Booking, DepositCheckout, review_exists).outerjoin(
        DepositCheckout, DepositCheckout.id == latest_id
    ).where(Booking.bookingId == booking_id, Booking.userId == user_id)
        .execution_options(populate_existing=True)).first()
    if not row:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn")
    booking, latest, needs_review = row
    now = utc_now()
    deadline = deposit_deadline(booking)
    due = (booking.status == "awaiting_payment" and deadline and now >= deadline) or (
        latest and latest.status == "pending" and (
            now >= parse_time(latest.expires_at) or booking.status != "awaiting_payment"))
    if due:
        booking = lock_booking(session, booking_id)
        expire_locked_deposit(session, booking, now)
        attempts = expire_checkout_rows(session, booking, now)
        latest = attempts[-1] if attempts else None
        needs_review = any(item.status == "review" for item in attempts)
        session.commit()
    deadline = deposit_deadline(booking)
    result = {
        "bookingId": booking_id, "bookingStatus": booking.status,
        "depositStatus": booking.depositStatus, "depositAmount": booking.depositAmount,
        "paymentStatus": booking.depositStatus,
        "bookingExpiresAt": deadline.isoformat() if deadline else None,
        "sessionStatus": latest.status if latest else "not_created",
        "sessionExpiresAt": latest.expires_at if latest else None,
        "invoiceNumber": latest.invoice_number if latest else None,
        "needsReview": needs_review,
        "canCheckout": bool(booking.status == "awaiting_payment" and
            booking.depositStatus == "pending" and deadline and now < deadline and not needs_review),
        "serverNow": now.isoformat(),
    }
    return result


def create_checkout(session, booking_id, user_id):
    # Validate configuration before creating any new invoice.
    gateway_config()
    booking = lock_booking(session, booking_id)
    if not booking or booking.userId != user_id:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn")
    now = utc_now()
    expire_locked_deposit(session, booking, now)
    attempts = expire_checkout_rows(session, booking, now)
    deadline = deposit_deadline(booking)
    if not deadline or now >= deadline or booking.status != "awaiting_payment" or booking.depositStatus != "pending":
        session.commit()
        raise HTTPException(409, "Đơn đã hết hạn hoặc không còn chờ thanh toán đặt cọc.")
    if any(item.status == "review" for item in attempts):
        session.commit()
        raise HTTPException(409, "Giao dịch đang được đối soát. Vui lòng không thanh toán thêm.")
    attempt = next((item for item in reversed(attempts) if item.status == "pending"), None)
    if attempt is None:
        attempt = DepositCheckout(
            booking_id=booking_id, invoice_number=f"TNBK{booking_id}-{uuid4().hex[:20]}",
            amount=booking.depositAmount, created_at=now.isoformat(),
            expires_at=min(now + timedelta(minutes=10), deadline).isoformat(),
        )
        session.add(attempt)
        session.flush()
    result = checkout_form(attempt, booking)
    result.update(bookingExpiresAt=deadline.isoformat(), serverNow=now.isoformat())
    session.commit()
    return result


def process_gateway_ipn(session, data, supplied_secret):
    expected = os.getenv("SEPAY_IPN_SECRET_KEY", "").strip()
    if not expected:
        raise HTTPException(503, "Chưa cấu hình khóa xác thực IPN")
    if not hmac.compare_digest(expected.encode(), (supplied_secret or "").encode()):
        raise HTTPException(401, "IPN không hợp lệ")
    if data.get("notification_type") != "ORDER_PAID":
        return {"success": True, "message": "Ignored notification"}
    order = data.get("order")
    transaction = data.get("transaction")
    if not isinstance(order, dict) or not isinstance(transaction, dict):
        raise HTTPException(422, "Thiếu dữ liệu giao dịch")
    if (order.get("order_status") != "CAPTURED" or
        transaction.get("transaction_status") != "APPROVED" or
        transaction.get("transaction_type") != "PAYMENT"):
        raise HTTPException(422, "Giao dịch chưa thanh toán thành công")
    invoice = order.get("order_invoice_number")
    transaction_id = transaction.get("id")
    if not isinstance(invoice, str) or not isinstance(transaction_id, str) or not transaction_id:
        raise HTTPException(422, "Thiếu mã hóa đơn hoặc mã giao dịch")
    attempt = session.exec(select(DepositCheckout).where(DepositCheckout.invoice_number == invoice)).first()
    if not attempt:
        raise HTTPException(404, "Không tìm thấy phiên thanh toán")
    booking = lock_booking(session, attempt.booking_id)
    if not booking:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn")
    session.refresh(attempt)
    existing = session.exec(select(DepositCheckout).where(
        DepositCheckout.gateway_transaction_id == transaction_id)).first()
    if existing:
        if existing.id != attempt.id:
            raise HTTPException(409, "Mã giao dịch đã được sử dụng")
        return {"success": True, "message": "Already processed"}
    if attempt.gateway_transaction_id:
        raise HTTPException(409, "Phiên đã ghi nhận giao dịch khác; cần đối soát")
    try:
        amount = Decimal(str(transaction["transaction_amount"]))
        order_amount = Decimal(str(order["order_amount"]))
        if not amount.is_finite() or not order_amount.is_finite() or amount <= 0:
            raise ValueError()
    except (KeyError, InvalidOperation, ValueError):
        raise HTTPException(422, "Số tiền giao dịch không hợp lệ")
    payment = session.exec(select(DepositPayment).where(DepositPayment.booking_id == booking.bookingId)
        .with_for_update().execution_options(populate_existing=True)).first()
    if not payment:
        raise HTTPException(409, "Không tìm thấy khoản đặt cọc")
    reason = None
    paid_at = None
    try:
        paid_at = parse_time(transaction["transaction_date"], VN_TIMEZONE)
    except (KeyError, TypeError, ValueError):
        reason = "Không xác định được thời điểm thanh toán"
    if order.get("order_currency") != "VND" or transaction.get("transaction_currency") != "VND":
        reason = "Sai loại tiền tệ"
    elif amount != attempt.amount or order_amount != attempt.amount:
        reason = "Số tiền thanh toán không khớp"
    elif paid_at and not (parse_time(attempt.created_at) - timedelta(seconds=1) <= paid_at < parse_time(attempt.expires_at)):
        reason = "Thanh toán ngoài thời hạn phiên"
    elif payment.status != "pending" and not (payment.status == "expired" and booking.status == "payment_expired"):
        reason = "Đơn đã ghi nhận thanh toán hoặc đang hoàn cọc"
    elif booking.status not in {"awaiting_payment", "payment_expired"}:
        reason = "Đơn không còn chờ đặt cọc"
    attempt.gateway_transaction_id = transaction_id
    attempt.received_amount = str(amount)
    attempt.paid_at = paid_at.isoformat() if paid_at else None
    if reason:
        attempt.status = "review"
        attempt.review_reason = reason
        session.add(Notification(userId=booking.userId, title="Giao dịch đặt cọc cần đối soát",
            message="Đã nhận thông tin giao dịch nhưng cần kiểm tra trước khi xác nhận. Vui lòng không thanh toán thêm.",
            type="payment_review", createdAt=utc_now().isoformat()))
        for admin in session.exec(select(User).where(User.role == "admin")).all():
            session.add(Notification(userId=admin.userId, title="Cần đối soát thanh toán đặt cọc",
                message=f"Đơn #{booking.bookingId}, phiên {invoice}: {reason}. Số tiền ghi nhận: {amount}.",
                type="payment_review", createdAt=utc_now().isoformat()))
    else:
        attempt.status = "paid"
        payment.status = "paid"
        payment.paid_at = attempt.paid_at
        payment.sepay_transaction_id = transaction_id
        booking.status = "pending"
        booking.depositStatus = "paid"
        booking.depositPaidAt = attempt.paid_at
        session.add(payment)
        session.add(booking)
    session.add(attempt)
    session.flush()
    expire_checkout_rows(session, booking, utc_now())
    session.commit()
    return {"success": True, "message": "Recorded for review" if reason else "Booking deposit processed"}


def maintain_checkout_sessions(session, batch_size=10):
    now = utc_now()
    booking_ids = session.exec(select(DepositCheckout.booking_id).join(
        Booking, Booking.bookingId == DepositCheckout.booking_id
    ).where(DepositCheckout.status == "pending", or_(
        DepositCheckout.expires_at <= now.isoformat(), Booking.status != "awaiting_payment"
    )).distinct().order_by(DepositCheckout.booking_id).limit(batch_size)).all()
    for booking_id in booking_ids:
        booking = lock_booking(session, booking_id)
        if booking:
            expire_locked_deposit(session, booking, now)
            expire_checkout_rows(session, booking, now)
        session.commit()
    # Reserve only a bounded batch before any network I/O. Concurrent workers skip these rows.
    cancellations = session.exec(select(DepositCheckout).where(
        DepositCheckout.status.in_(["expired", "cancelled"]),
        DepositCheckout.cancellation_synced == False,
        or_(DepositCheckout.next_cancel_at == None, DepositCheckout.next_cancel_at <= now.isoformat()),
    ).order_by(DepositCheckout.next_cancel_at.asc().nullsfirst(), DepositCheckout.id)
        .limit(8).with_for_update(skip_locked=True).execution_options(populate_existing=True)).all()
    invoices = []
    for attempt in cancellations:
        attempt.cancel_attempts += 1
        delay = min(3600, 30 * 2 ** min(attempt.cancel_attempts - 1, 7))
        attempt.next_cancel_at = (now + timedelta(seconds=delay)).isoformat()
        invoices.append(attempt.invoice_number)
        session.add(attempt)
    session.commit()
    cancelled_count = 0
    if invoices:
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(cancel_gateway_order, invoices))
        for invoice, confirmed in zip(invoices, results):
            if confirmed:
                attempt = session.exec(select(DepositCheckout).where(
                    DepositCheckout.invoice_number == invoice).with_for_update()
                    .execution_options(populate_existing=True)).first()
                if attempt and attempt.status in {"expired", "cancelled"}:
                    attempt.cancellation_synced = True
                    session.add(attempt)
                    cancelled_count += 1
                session.commit()
    return {"processedBookings": len(booking_ids), "cancellationAttempts": len(invoices), "cancelled": cancelled_count}
