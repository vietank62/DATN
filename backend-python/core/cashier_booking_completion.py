"""Complete linked reservations only when the final POS balance is paid."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import select
from models.booking import Booking
from core.booking_email import queue_booking_email


def complete_paid_bookings(session, restaurant_id, previous, current, reconcile=False):
    previous_ids = {bill["id"] for shift in previous.get("shifts", []) for bill in shift.get("bills", [])}
    linked_orders = {order.get("bookingId") for order in previous.get("orders", {}).values() if order.get("lines")}
    newly_paid = {bill.get("bookingId") for shift in current.get("shifts", []) for bill in shift.get("bills", []) if (reconcile or bill["id"] not in previous_ids) and bill.get("bookingId")}
    completed = []
    for booking_id in newly_paid:
        if any(order.get("bookingId") == booking_id and (order.get("lines") or order.get("kitchenLines")) for order in current.get("orders", {}).values()):
            continue
        if not reconcile and booking_id not in linked_orders:
            raise HTTPException(409, "Bill không thuộc bàn đang phục vụ của đơn đặt bàn.")
        booking = session.exec(select(Booking).where(Booking.bookingId == booking_id, Booking.restaurantId == restaurant_id).with_for_update()).first()
        if reconcile and (not booking or booking.status != "confirmed" or booking.attendance != "arrived"):
            continue
        if not booking or booking.status != "confirmed":
            raise HTTPException(409, "Đơn đặt bàn của bill không còn ở trạng thái đã xác nhận.")
        # A split payment or another occupied table for the same party keeps the hold.
        booking.status = "completed"
        booking.attendance = "arrived"
        booking.completedAt = datetime.now(timezone.utc).isoformat()
        session.add(booking)
        queue_booking_email(session, booking, "completed")
        for key in list(current.get("orders", {})):
            if current["orders"][key].get("bookingId") == booking_id:
                del current["orders"][key]
        session.execute(text("UPDATE table_booking_incidents SET state='cleared',cleared_at=CURRENT_TIMESTAMP WHERE booking_id=:bid AND restaurant_id=:rid AND state='open'"), {"bid": booking_id, "rid": restaurant_id})
        completed.append(booking_id)
    return completed
