import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import BackgroundTasks
from core.booking_policy import APP_TIME_ZONE
from routers.booking_cancellation import cancellation_decision, CancellationDecision


class DepositDecisionTests(unittest.TestCase):
    def decide(self, keep):
        booking = SimpleNamespace(bookingId=7, restaurantId=1, userId=2, status="confirmed", cancellationStatus="requested", depositStatus="paid")
        restaurant = SimpleNamespace(booking_lead_minutes=30, booking_confirmation_minutes=15)
        payment = SimpleNamespace(status="paid")
        session = MagicMock()
        session.get.return_value = restaurant
        session.exec.return_value.first.return_value = payment
        def finish(s, b, reason, actor):
            b.status = "cancelled"
        with patch("routers.booking_cancellation.lock_booking", return_value=booking), patch("routers.booking_cancellation._ensure_restaurant_access"), patch("routers.booking_cancellation.get_booking_meal_time", return_value=datetime.now(APP_TIME_ZONE)+timedelta(minutes=5)), patch("routers.booking_cancellation.finish_cancel", side_effect=finish), patch("routers.booking_cancellation._serialize_booking", return_value={}):
            cancellation_decision(7, CancellationDecision(approved=True, keep_deposit=keep, reason="Khách hủy phút chót"), session, SimpleNamespace(userId=3), BackgroundTasks())
        return booking, payment

    def test_keep_deposit_marks_booking_forfeited_but_payment_remains_paid(self):
        booking, payment = self.decide(True)
        self.assertEqual(booking.status, "cancelled")
        self.assertEqual(booking.depositStatus, "forfeited")
        self.assertEqual(payment.status, "paid")

    def test_refund_choice_does_not_forfeit(self):
        booking, _ = self.decide(False)
        self.assertNotEqual(booking.depositStatus, "forfeited")


if __name__ == "__main__":
    unittest.main()
