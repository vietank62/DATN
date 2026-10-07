import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import HTTPException, BackgroundTasks
from core.booking_capacity import APP_TIME_ZONE
from routers.booking_cancellation import customer_cancel, CancellationInput


class CancellationDeadlineTests(unittest.TestCase):
    def cancel(self, lead, remaining):
        now = datetime(2026, 10, 6, 18, 0, tzinfo=APP_TIME_ZONE)
        meal = now + timedelta(minutes=remaining)
        booking = SimpleNamespace(bookingId=7, restaurantId=1, userId=2, status="confirmed", cancellationStatus=None, depositStatus="not_required")
        restaurant = SimpleNamespace(booking_lead_minutes=120, booking_confirmation_minutes=lead, manager_id=3)
        session = MagicMock()
        session.get.return_value = restaurant
        with patch("routers.booking_cancellation.get_owned_booking", return_value=booking), patch("routers.booking_cancellation.get_booking_meal_time", return_value=meal), patch("routers.booking_cancellation.datetime") as clock, patch("routers.booking_cancellation._serialize_booking", return_value={}), patch("routers.booking_cancellation.refund_deposit"), patch("routers.booking_cancellation.expire_checkout_rows"):
            clock.now.return_value = now
            customer_cancel(7, CancellationInput(reason="Thay đổi kế hoạch"), session, SimpleNamespace(userId=2), BackgroundTasks())
        return booking, session

    def test_before_configured_cutoff_can_request_cancel(self):
        booking, session = self.cancel(15, 16)
        self.assertEqual(booking.status, "cancelled")
        session.commit.assert_called_once()

    def test_at_cutoff_requires_restaurant_decision(self):
        booking, _ = self.cancel(15, 15)
        self.assertEqual(booking.cancellationStatus, "requested")

    def test_zero_allows_cancel_before_mealtime(self):
        booking, _ = self.cancel(0, 1)
        self.assertEqual(booking.status, "cancelled")

    def test_zero_requires_approval_at_mealtime(self):
        booking, _ = self.cancel(0, 0)
        self.assertEqual(booking.cancellationStatus, "requested")


if __name__ == "__main__":
    unittest.main()
