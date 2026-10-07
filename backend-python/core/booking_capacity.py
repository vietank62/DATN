from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlmodel import select

from models.booking import Booking
from models.restaurant import Restaurant
from models.restaurantTable import BookingTable, RestaurantTable

APP_TIME_ZONE = timezone(timedelta(hours=7))
ACTIVE_CAPACITY_STATUSES = {"awaiting_payment", "pending", "confirmed"}
DEFAULT_BOOKING_DURATION_MINUTES = 120


def booking_window(date: str, time: str, duration_minutes: int) -> tuple[datetime, datetime]:
    start = datetime.strptime(f"{date} {time[:5]}", "%Y-%m-%d %H:%M").replace(tzinfo=APP_TIME_ZONE)
    return start, start + timedelta(minutes=duration_minutes)


def remaining_seats(session: Any, restaurant: Restaurant, date: str, time: str) -> tuple[int, int]:
    duration = restaurant.booking_duration_minutes or DEFAULT_BOOKING_DURATION_MINUTES
    start, end = booking_window(date, time, duration)
    candidate_dates = {(start - timedelta(days=1)).date().isoformat(), start.date().isoformat()}
    bookings = session.exec(
        select(Booking).where(
            Booking.restaurantId == restaurant.id,
            Booking.date.in_(candidate_dates),
            Booking.status.in_(ACTIVE_CAPACITY_STATUSES),
        )
    ).all()
    reserved = 0
    occupied_table_ids: set[int] = set()
    for booking in bookings:
        if booking.status not in ACTIVE_CAPACITY_STATUSES:
            continue
        try:
            booked_start, booked_end = booking_window(booking.date, booking.time, duration)
        except (TypeError, ValueError):
            continue
        if booked_start < end and start < booked_end:
            assigned = session.exec(select(BookingTable.table_id).where(BookingTable.booking_id == booking.bookingId)).all()
            if assigned:
                occupied_table_ids.update(assigned)
            else:  # Legacy bookings created before real tables were introduced.
                reserved += booking.requestSeats
    tables = session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).all()
    if not tables:
        return max(0, restaurant.capacity - reserved), reserved
    available_table_seats = sum(table.seats for table in tables if table.id not in occupied_table_ids)
    total_seats = sum(table.seats for table in tables)
    return max(0, available_table_seats - reserved), total_seats - available_table_seats + reserved


def ensure_available_seats(session: Any, restaurant: Restaurant, date: str, time: str, seats: int) -> tuple[int, int, list[int]]:
    available, reserved = remaining_seats(session, restaurant, date, time)
    if seats > available:
        raise HTTPException(
            status_code=409,
            detail=f"Khung giờ đã gần đầy. Nhà hàng chỉ còn {available} chỗ cho thời điểm đã chọn.",
        )
    duration = restaurant.booking_duration_minutes or DEFAULT_BOOKING_DURATION_MINUTES
    start, end = booking_window(date, time, duration)
    candidate_dates = {(start - timedelta(days=1)).date().isoformat(), start.date().isoformat()}
    conflicting = session.exec(select(Booking).where(Booking.restaurantId == restaurant.id, Booking.date.in_(candidate_dates), Booking.status.in_(ACTIVE_CAPACITY_STATUSES))).all()
    occupied: set[int] = set()
    for booking in conflicting:
        try:
            booked_start, booked_end = booking_window(booking.date, booking.time, duration)
        except (TypeError, ValueError):
            continue
        if booked_start < end and start < booked_end:
            occupied.update(session.exec(select(BookingTable.table_id).where(BookingTable.booking_id == booking.bookingId)).all())
    tables = session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True).order_by(RestaurantTable.seats.desc(), RestaurantTable.name)).all()
    if not tables:
        return available, reserved, []
    selected: list[int] = []; selected_seats = 0
    for table in tables:
        if table.id not in occupied:
            selected.append(table.id); selected_seats += table.seats
            if selected_seats >= seats: break
    if selected_seats < seats:
        raise HTTPException(status_code=409, detail="Không còn tổ hợp bàn phù hợp cho số khách này.")
    return available, reserved, selected
