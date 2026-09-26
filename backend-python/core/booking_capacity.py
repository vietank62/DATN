from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlmodel import select

from models.booking import Booking
from models.restaurant import Restaurant

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
    for booking in bookings:
        if booking.status not in ACTIVE_CAPACITY_STATUSES:
            continue
        try:
            booked_start, booked_end = booking_window(booking.date, booking.time, duration)
        except (TypeError, ValueError):
            continue
        if booked_start < end and start < booked_end:
            reserved += booking.requestSeats
    return max(0, restaurant.capacity - reserved), reserved


def ensure_available_seats(session: Any, restaurant: Restaurant, date: str, time: str, seats: int) -> tuple[int, int]:
    available, reserved = remaining_seats(session, restaurant, date, time)
    if seats > available:
        raise HTTPException(
            status_code=409,
            detail=f"Khung giờ đã gần đầy. Nhà hàng chỉ còn {available} chỗ cho thời điểm đã chọn.",
        )
    return available, reserved