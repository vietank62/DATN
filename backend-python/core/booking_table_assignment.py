from datetime import datetime
from fastapi import HTTPException
from sqlmodel import select
from models.booking import Booking
from models.restaurantTable import BookingTable, RestaurantTable
from core.booking_capacity import booking_window, ACTIVE_CAPACITY_STATUSES, APP_TIME_ZONE


def assign_booking_tables(session, restaurant, booking, table_id=None, allow_insufficient=False, blocked_ids=None):
    duration = restaurant.booking_duration_minutes or 120
    start, end = booking_window(booking.date, booking.time, duration)
    occupied = set()
    legacy_seats = 0
    others = session.exec(select(Booking).where(Booking.restaurantId == restaurant.id, Booking.bookingId != booking.bookingId, Booking.status.in_(ACTIVE_CAPACITY_STATUSES))).all()
    for other in others:
        other_start, other_end = booking_window(other.date, other.time, duration)
        if other_start < end and (start < other_end or (other.status == "confirmed" and other_start <= datetime.now(APP_TIME_ZONE))):
            ids = session.exec(select(BookingTable.table_id).where(BookingTable.booking_id == other.bookingId)).all()
            if ids:
                occupied.update(ids)
            else:
                legacy_seats += other.requestSeats
    tables = session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).all()
    free = [table for table in tables if table.id not in occupied and table.id not in (blocked_ids or set())]
    if not free or sum(table.seats for table in free) <= legacy_seats:
        raise HTTPException(409, "Không còn đủ chỗ cho khung giờ của đơn đặt bàn.")
    if table_id is not None:
        table = next((table for table in free if table.id == table_id), None)
        if not table:
            raise HTTPException(409, "Bàn không thuộc nhà hàng, đang ngưng dùng hoặc đã có đơn giữ chỗ trong khung giờ này.")
        selected = [table]
    else:
        single = sorted((table for table in free if table.seats >= booking.requestSeats), key=lambda table: (table.seats, table.name))
        selected = single[:1]
        if not selected:
            selected = sorted(free, key=lambda table: (-table.seats, table.name))[:1]
    if selected[0].seats < booking.requestSeats and not allow_insufficient:
        raise HTTPException(409, {"code": "INSUFFICIENT_TABLE_SEATS", "message": "Bàn hiện tại không đủ ghế cho đơn đặt bàn, bạn vẫn muốn tiếp tục?", "table_id": selected[0].id, "table_name": selected[0].name, "seats": selected[0].seats, "required_seats": booking.requestSeats})
    for assignment in session.exec(select(BookingTable).where(BookingTable.booking_id == booking.bookingId)).all():
        session.delete(assignment)
    session.flush()
    for table in selected:
        session.add(BookingTable(booking_id=booking.bookingId, table_id=table.id))
    booking.assignedSeats = sum(table.seats for table in selected)
    session.add(booking)
    session.flush()
    return selected
