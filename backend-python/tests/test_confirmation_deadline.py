import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from core.booking_policy import confirmation_lead, confirmation_deadline, APP_TIME_ZONE
from unittest.mock import MagicMock, patch
import main
from fastapi import BackgroundTasks
from routers.booking import confirm_booking, expire_unanswered_bookings, _display_cancellation_reason


class ConfirmationDeadlineTests(unittest.TestCase):
    def test_separate_confirmation_setting_controls_deadline(self):
        restaurant = SimpleNamespace(booking_lead_minutes=30, booking_confirmation_minutes=15)
        meal = datetime(2026, 10, 7, 19, 0, tzinfo=APP_TIME_ZONE)
        self.assertEqual(confirmation_deadline(restaurant, meal), meal.replace(hour=18, minute=45))

    def test_booking_26_scenario_zero_minutes_not_expired_at_creation(self):
        session = MagicMock()
        booking = SimpleNamespace(bookingId=26, restaurantId=27, date="2026-10-06", time="23:15", status="pending")
        restaurant = SimpleNamespace(booking_lead_minutes=0)
        session.exec.return_value.all.return_value = [booking]
        session.exec.return_value.first.return_value = restaurant
        now = datetime(2026, 10, 6, 23, 10, 16, tzinfo=APP_TIME_ZONE)
        self.assertEqual(expire_unanswered_bookings(session, now=now), 0)
        self.assertEqual(booking.status, "pending")
        session.commit.assert_not_called()

    def test_zero_deadline_is_mealtime_not_two_hours_before(self):
        restaurant = SimpleNamespace(booking_lead_minutes=0)
        meal = datetime(2026, 10, 6, 23, 15, tzinfo=APP_TIME_ZONE)
        self.assertEqual(confirmation_deadline(restaurant, meal), meal)

    def test_utc_input_matches_vietnam_clock(self):
        from datetime import timezone
        meal = datetime(2026, 10, 6, 16, 15, tzinfo=timezone.utc)
        self.assertEqual(confirmation_deadline(SimpleNamespace(booking_lead_minutes=15), meal).hour, 23)
        self.assertEqual(confirmation_deadline(SimpleNamespace(booking_lead_minutes=15), meal).minute, 0)
    def test_zero_minutes_does_not_expire_a_minute_early(self):
        session = MagicMock()
        booking = SimpleNamespace(bookingId=1, restaurantId=1, date="2026-10-06", time="22:13", status="pending")
        restaurant = SimpleNamespace(booking_lead_minutes=0)
        session.exec.return_value.all.return_value = [booking]
        session.exec.return_value.first.return_value = restaurant
        now = datetime(2026, 10, 6, 22, 12, tzinfo=APP_TIME_ZONE)
        self.assertEqual(expire_unanswered_bookings(session, now=now), 0)
        self.assertEqual(booking.status, "pending")

    @patch("routers.booking._persist_booking_status", return_value="confirmed")
    @patch("routers.booking._ensure_restaurant_access")
    @patch("routers.booking._get_restaurant_or_404")
    @patch("routers.booking.datetime")
    def test_zero_minutes_allows_confirmation_before_mealtime(self, clock, get_restaurant, access, persist):
        session = MagicMock()
        session.exec.return_value.first.return_value = SimpleNamespace(bookingId=1, restaurantId=1, status="pending", date="2026-10-06", time="22:13")
        get_restaurant.return_value = SimpleNamespace(booking_lead_minutes=0, is_active=True, is_report_suspended=False, approval_status="approved")
        clock.strptime.side_effect = datetime.strptime
        clock.now.return_value = datetime(2026, 10, 6, 22, 12, tzinfo=APP_TIME_ZONE)
        self.assertEqual(confirm_booking(BackgroundTasks(), 1, SimpleNamespace(userId=1), session), "confirmed")

    def test_old_reason_display_is_not_fixed_two_hours(self):
        reason = _display_cancellation_reason(SimpleNamespace(cancellationReason="Nhà hàng không xác nhận đơn trước thời hạn 2 giờ"))
        self.assertNotIn("2 giờ", reason)

    def test_fifteen_minute_cutoff(self):
        lead = confirmation_lead(SimpleNamespace(booking_lead_minutes=15))
        meal = datetime(2026, 10, 6, 19, 0, tzinfo=APP_TIME_ZONE)
        self.assertGreater(meal - meal.replace(hour=18, minute=44), lead)
        self.assertLessEqual(meal - meal.replace(hour=18, minute=45), lead)
        self.assertEqual(meal - lead, meal.replace(hour=18, minute=45))

    def test_other_restaurant_settings(self):
        for minutes in (0, 30, 120, 180, 1440, 10080):
            self.assertEqual(confirmation_lead(SimpleNamespace(booking_lead_minutes=minutes)), timedelta(minutes=minutes))

    def test_default_setting(self):
        self.assertEqual(confirmation_lead(SimpleNamespace(booking_lead_minutes=None)), timedelta(minutes=120))
