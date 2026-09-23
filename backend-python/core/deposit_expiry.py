"""Shared deposit deadline and expiry transitions."""

from datetime import datetime, timedelta, timezone

from sqlmodel import select #type: ignore

from models.booking import Booking
from models.depositPayment import DepositPayment
from models.notification import Notification


def deposit_deadline(booking: Booking) -> datetime | None:
    if not booking.createdAt or not booking.depositAmount:
        return None
    created = datetime.fromisoformat(booking.createdAt)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created + timedelta(minutes=30)


def expire_locked_deposit(session, booking: Booking, now: datetime | None = None) -> bool:
    """Caller holds the booking row lock and owns the transaction."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    if booking.status != "awaiting_payment" or booking.depositStatus != "pending":
        return False
    deadline = deposit_deadline(booking)
    if deadline is None or current < deadline:
        return False
    payment = session.exec(select(DepositPayment).where(
        DepositPayment.booking_id == booking.bookingId
    ).with_for_update().execution_options(populate_existing=True)).first()
    if payment and payment.status != "pending":
        return False
    booking.status = "payment_expired"
    booking.depositStatus = "expired"
    session.add(booking)
    if payment:
        payment.status = "expired"
        session.add(payment)
    session.add(Notification(
        userId=booking.userId,
        title="Đơn đặt bàn đã hết hạn đặt cọc",
        message="Bạn chưa thanh toán đặt cọc trong thời hạn. Đơn đã tự động hết hạn; vui lòng tạo đơn mới nếu vẫn muốn đặt bàn.",
        type="booking_expired",
        createdAt=current.isoformat(),
    ))
    return True


def expire_unpaid_bookings(session, now: datetime | None = None, booking_id: int | None = None, user_id: int | None = None, restaurant_id: int | None = None, limit: int | None = None) -> int:
    query = select(Booking).where(
        Booking.status == "awaiting_payment", Booking.depositStatus == "pending"
    )
    if booking_id is not None:
        query = query.where(Booking.bookingId == booking_id)
    if user_id is not None:
        query = query.where(Booking.userId == user_id)
    if restaurant_id is not None:
        query = query.where(Booking.restaurantId == restaurant_id)
    if limit is not None:
        query = query.limit(limit)
    bookings = session.exec(query.order_by(Booking.createdAt, Booking.bookingId).with_for_update(
    ).execution_options(populate_existing=True)).all()
    count = sum(expire_locked_deposit(session, booking, now) for booking in bookings)
    session.commit()
    return count
