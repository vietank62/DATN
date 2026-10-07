import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from core.booking_capacity import ensure_available_seats, remaining_seats
from routers.booking import completion_reminder_due
from models.bookingItem import BookingItem  # Register ORM relationship for test models
from models.booking import Booking
from models.restaurant import Restaurant


class _Rows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class _Session:
    def __init__(self, rows):
        self.rows = rows

    def exec(self, _statement):
        # This fixture models legacy bookings with no table assignments.
        if _statement.get_final_froms()[0].name == Booking.__tablename__:
            return _Rows(self.rows)
        return _Rows([])


class BookingCapacityTests(unittest.TestCase):
    def setUp(self):
        self.restaurant = Restaurant(id=1, name="Test", slug="test", address="A", district="B", capacity=10, booking_duration_minutes=120)
        self.bookings = [
            Booking(bookingId=1, userId=1, restaurantId=1, date="2030-01-01", time="18:30", guestCount=3, requestSeats=3, contactName="A", contactEmail="a@example.com", contactPhone="0900000000", status="confirmed"),
            Booking(bookingId=2, userId=2, restaurantId=1, date="2030-01-01", time="18:30", guestCount=4, requestSeats=4, contactName="B", contactEmail="b@example.com", contactPhone="0900000001", status="cancelled"),
        ]

    def test_overlapping_active_booking_consumes_seats(self):
        available, reserved = remaining_seats(_Session(self.bookings), self.restaurant, "2030-01-01", "19:00")
        self.assertEqual((available, reserved), (7, 3))

    def test_non_overlapping_or_cancelled_booking_does_not_consume_seats(self):
        available, reserved = remaining_seats(_Session(self.bookings), self.restaurant, "2030-01-01", "21:00")
        self.assertEqual((available, reserved), (10, 0))

    def test_over_capacity_request_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            ensure_available_seats(_Session(self.bookings), self.restaurant, "2030-01-01", "19:00", 8)
        self.assertEqual(context.exception.status_code, 409)


    def test_completion_reminder_is_due_only_after_120_minutes(self):
        booking = self.bookings[0]
        meal_time = datetime(2030, 1, 1, 18, 30, tzinfo=timezone(timedelta(hours=7)))
        self.assertFalse(completion_reminder_due(booking, meal_time + timedelta(minutes=119)))
        self.assertTrue(completion_reminder_due(booking, meal_time + timedelta(minutes=120)))

if __name__ == "__main__":
    unittest.main()
