"""Business deadlines use the restaurant's Vietnam timezone."""
from datetime import datetime, timedelta, timezone

APP_TIME_ZONE = timezone(timedelta(hours=7))
CONFIRMATION_LEAD = timedelta(hours=2)
CUSTOMER_CANCEL_LEAD = timedelta(hours=1)
AUTO_COMPLETE_DELAY = timedelta(days=7)
# Restaurant managers are reminded two hours after the booked meal time to
# explicitly mark the visit completed; automatic completion remains seven days.
COMPLETION_REMINDER_DELAY = timedelta(hours=2)


def confirmation_lead(restaurant):
    # Confirmation expires at the restaurant's configured advance-booking cutoff.
    minutes = getattr(restaurant, "booking_confirmation_minutes", None)
    if minutes is None:
        minutes = restaurant.booking_lead_minutes if restaurant.booking_lead_minutes is not None else 120
    return timedelta(minutes=max(0, minutes))


def confirmation_deadline(restaurant, meal_time):
    return meal_time.astimezone(APP_TIME_ZONE) - confirmation_lead(restaurant)


def validate_booking_time(restaurant, meal_time, now=None):
    from fastapi import HTTPException
    now = now or datetime.now(APP_TIME_ZONE)
    if meal_time < now + timedelta(minutes=restaurant.booking_lead_minutes):
        raise HTTPException(422, f"Nhà hàng yêu cầu đặt bàn trước giờ dùng bữa ít nhất {restaurant.booking_lead_minutes} phút")
    time = meal_time.strftime("%H:%M")
    if ((restaurant.booking_opening_time and time < restaurant.booking_opening_time)
            or (restaurant.booking_closing_time and time > restaurant.booking_closing_time)):
        raise HTTPException(422, "Giờ dùng bữa nằm ngoài khung giờ nhà hàng cho phép đặt bàn")


def month_start(now=None):
    now = now or datetime.now(APP_TIME_ZONE)
    return now.astimezone(APP_TIME_ZONE).replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
