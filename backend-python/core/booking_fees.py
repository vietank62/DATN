"""Monthly, idempotent booking fees; withdrawals and deductions lock restaurant first."""
import os
from datetime import datetime, timezone
from sqlmodel import select
from sqlalchemy import func, or_
from models import Booking, Restaurant, Notification
from models.bookingFee import BookingFee
from models.depositPayment import DepositPayment
from models.withdrawalRequest import WithdrawalRequest
from core.booking_policy import APP_TIME_ZONE

def fee_amount():
    return max(0, int(os.getenv("BOOKING_SUCCESS_FEE_VND", "6000")))

def fee_totals(session, restaurant_id):
    rows = session.exec(select(BookingFee).where(BookingFee.restaurant_id == restaurant_id)).all()
    return {"feesTotal": sum(x.amount for x in rows), "feesOutstanding": sum(x.amount-x.settled_amount for x in rows), "feesDeducted": sum(x.deducted_amount for x in rows)}

def settle_restaurant_fees(session, restaurant, now=None):
    now = (now or datetime.now(timezone.utc)).astimezone(APP_TIME_ZONE)
    now_iso = now.astimezone(timezone.utc).isoformat()
    rows = session.exec(select(BookingFee).where(BookingFee.restaurant_id == restaurant.id)).all()
    charged = {x.booking_id for x in rows}
    for booking in session.exec(select(Booking).where(Booking.restaurantId == restaurant.id, Booking.status == "completed")).all():
        if booking.bookingId in charged:
            continue
        completed = datetime.fromisoformat(booking.completedAt) if booking.completedAt else datetime.fromisoformat(f"{booking.date}T{booking.time[:5]}:00+07:00")
        completed = completed.astimezone(APP_TIME_ZONE)
        due = completed.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        due = due.replace(year=due.year+1, month=1) if due.month == 12 else due.replace(month=due.month+1)
        row = BookingFee(booking_id=booking.bookingId, restaurant_id=restaurant.id, amount=fee_amount(), due_at=due.astimezone(timezone.utc).isoformat())
        rows.append(row)
        session.add(row)
    session.flush()
    deposit = session.exec(select(func.coalesce(func.sum(DepositPayment.amount), 0)).join(Booking, Booking.bookingId == DepositPayment.booking_id).where(
        DepositPayment.restaurant_id == restaurant.id, DepositPayment.status == "paid",
        or_(Booking.status == "completed", Booking.depositStatus == "forfeited"))).one()
    reserved = session.exec(select(func.coalesce(func.sum(WithdrawalRequest.amount), 0)).where(
        WithdrawalRequest.restaurant_id == restaurant.id, WithdrawalRequest.status.in_(["pending", "paid"]))).one()
    available = max(0, int(deposit) - int(reserved) - sum(x.deducted_amount for x in rows))
    month = now.strftime("%Y-%m")
    for row in sorted(rows, key=lambda x: (x.due_at, x.booking_id)):
        if row.due_at > now_iso or row.settled_amount >= row.amount:
            continue
        deducted = min(available, row.amount - row.settled_amount)
        row.settled_amount += deducted
        row.deducted_amount += deducted
        available -= deducted
        if restaurant.manager_id and row.reminder_month != month:
            message = f"Phí đơn #{row.booking_id}: {row.amount:,}đ. Đã thanh toán {row.settled_amount:,}đ (khấu trừ cọc {row.deducted_amount:,}đ). Còn lại {row.amount-row.settled_amount:,}đ."
            session.add(Notification(userId=restaurant.manager_id, bookingId=row.booking_id, title="Phí dịch vụ đặt bàn tháng " + month, message=message, type="booking_fee", createdAt=now_iso))
            row.reminder_month = month
        session.add(row)

def maintain_booking_fees(session):
    for restaurant in session.exec(select(Restaurant).order_by(Restaurant.id).with_for_update(skip_locked=True)).all():
        settle_restaurant_fees(session, restaurant)
    session.commit()
