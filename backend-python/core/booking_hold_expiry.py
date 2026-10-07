"""Release unarrived reservations without touching served orders or deposits.

Caller owns the restaurant/workspace locks and commits the whole transition.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from sqlmodel import select
from models.booking import Booking
from models.notification import Notification
from models.violationReport import ViolationReport
from core.booking_capacity import APP_TIME_ZONE, booking_window


def release_expired_holds(session, restaurant, workspace, now=None):
    minutes = getattr(restaurant, "booking_hold_minutes", None)
    if minutes is None:
        return []
    now = now or datetime.now(APP_TIME_ZONE)
    # An incident means the guest may have arrived but staff could not seat them.
    # Never classify that guest as absent or discard their unresolved incident.
    incident = select(ViolationReport.id).where(
        ViolationReport.booking_id == Booking.bookingId,
        ViolationReport.target_restaurant_id == restaurant.id,
        ViolationReport.source == "table_full",
    ).exists()
    bookings = session.exec(select(Booking).where(
        Booking.restaurantId == restaurant.id, Booking.status == "confirmed",
        Booking.attendance == None, Booking.date <= now.date().isoformat(),
        ~incident,
    ).with_for_update().execution_options(populate_existing=True)).all()
    released = []
    orders = workspace.setdefault("orders", {})
    paid_ids = {bill.get("bookingId") for shift in workspace.get("shifts", []) for bill in shift.get("bills", [])}
    for booking in bookings:
        # Recheck state also makes this safe for isolated test fixtures.
        if booking.status != "confirmed" or booking.attendance is not None:
            continue
        try:
            start, _ = booking_window(booking.date, booking.time, 120)
        except (ValueError, TypeError):
            continue
        if now < start + timedelta(minutes=minutes):
            continue
        linked = [(key, order) for key, order in orders.items() if order.get("bookingId") == booking.bookingId]
        if booking.bookingId in paid_ids or any(order.get("kitchenLines") or order.get("kitchenConfirmedAt") or (order.get("lines") and not order.get("preordersImported")) for _, order in linked):
            continue
        booking.status = "cancelled"
        booking.attendance = "no_show"
        booking.cancellationActor = "system"
        booking.cancellationReason = f"Hết thời gian giữ bàn ({minutes} phút sau giờ đặt), khách chưa được tiếp nhận."
        booking.expiredAt = now.astimezone(timezone.utc).isoformat()
        session.add(booking)
        for key, _ in linked:
            del orders[key]
        session.execute(text("UPDATE table_booking_incidents SET state='cleared',cleared_at=CURRENT_TIMESTAMP WHERE booking_id=:bid AND restaurant_id=:rid AND state='open'"), {"bid": booking.bookingId, "rid": restaurant.id})
        message = f"Đơn #{booking.bookingId} đã hết {minutes} phút giữ bàn sau giờ đặt mà chưa được tiếp nhận. Bàn đã được trả chỗ; tiền cọc không tự động bị tịch thu."
        for uid in {restaurant.manager_id, booking.userId} - {None}:
            session.add(Notification(userId=uid, bookingId=booking.bookingId, title="Hết thời gian giữ bàn", message=message, type="booking", createdAt=now.isoformat()))
        released.append(booking.bookingId)
    if released:
        session.flush()
    return released
