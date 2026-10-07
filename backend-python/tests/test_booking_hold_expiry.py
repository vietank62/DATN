import unittest
from copy import deepcopy
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from pydantic import ValidationError
from core.booking_capacity import APP_TIME_ZONE
from core.booking_hold_expiry import release_expired_holds
from schemas.partner import PartnerOperationalUpdate
from models.restaurant import Restaurant
from fastapi import BackgroundTasks
from routers.partner import update_operational


class BookingHoldExpiryTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.restaurant = SimpleNamespace(id=1, manager_id=2, booking_hold_minutes=30)
        self.booking = SimpleNamespace(bookingId=7, userId=3, status="confirmed", attendance=None,
            date="2026-10-07", time="19:00", depositStatus="paid", depositAmount=100000)
        self.session.exec.return_value.all.return_value = [self.booking]
        self.workspace = {"orders": {"1": {"bookingId": 7, "preordersImported": True,
            "lines": [{"id": 9, "quantity": 2}]}, "2": {"lines": [{"id": 8}]}}, "shifts": []}

    def release(self, hour=19, minute=30):
        return release_expired_holds(self.session, self.restaurant, self.workspace,
            datetime(2026, 10, 7, hour, minute, tzinfo=APP_TIME_ZONE))

    def test_before_deadline_keeps_preorders(self):
        previous = deepcopy(self.workspace)
        self.assertEqual(self.release(minute=29), [])
        self.assertEqual(self.workspace, previous)
        self.session.add.assert_not_called()

    def test_at_deadline_releases_only_linked_unserved_order(self):
        self.assertEqual(self.release(), [7])
        self.assertEqual(self.booking.status, "cancelled")
        self.assertEqual(self.booking.attendance, "no_show")
        self.assertEqual(self.booking.cancellationActor, "system")
        self.assertNotIn("1", self.workspace["orders"])
        self.assertIn("2", self.workspace["orders"])
        self.assertEqual(self.booking.depositStatus, "paid")
        notices = [call.args[0] for call in self.session.add.call_args_list if hasattr(call.args[0], "title")]
        self.assertEqual({notice.userId for notice in notices}, {2, 3})

    def test_repeat_does_not_notify_or_release_again(self):
        self.release()
        self.session.reset_mock()
        self.assertEqual(self.release(), [])
        self.session.add.assert_not_called()

    def test_arrived_guest_is_never_expired(self):
        self.booking.attendance = "arrived"
        self.assertEqual(self.release(hour=23), [])

    def test_kitchen_confirmed_order_is_preserved(self):
        self.workspace["orders"]["1"]["kitchenConfirmedAt"] = "2026-10-07T19:02:00+07:00"
        self.assertEqual(self.release(hour=23), [])
        self.assertIn("1", self.workspace["orders"])

    def test_kitchen_lines_are_preserved(self):
        self.workspace["orders"]["1"]["kitchenLines"] = [{"id": 9}]
        self.assertEqual(self.release(hour=23), [])

    def test_cashier_added_food_is_preserved(self):
        self.workspace["orders"]["1"]["preordersImported"] = False
        self.assertEqual(self.release(), [])

    def test_partial_paid_bill_is_preserved(self):
        self.workspace["shifts"] = [{"bills": [{"bookingId": 7}]}]
        self.assertEqual(self.release(), [])

    def test_no_workspace_order_still_ends_hold(self):
        self.workspace["orders"] = {}
        self.assertEqual(self.release(), [7])

    def test_configured_minutes_control_deadline(self):
        self.restaurant.booking_hold_minutes = 60
        self.assertEqual(self.release(), [])
        self.assertEqual(self.release(hour=20, minute=0), [7])

    def test_cross_midnight_deadline(self):
        self.booking.date = "2026-10-06"
        self.booking.time = "23:50"
        self.assertEqual(self.release(hour=0, minute=19), [])
        self.assertEqual(self.release(hour=0, minute=20), [7])

    def test_query_excludes_arrivals_and_table_full_incidents(self):
        self.release(minute=29)
        sql = str(self.session.exec.call_args.args[0])
        self.assertIn("attendance IS NULL", sql)
        self.assertIn("NOT (EXISTS", sql)
        self.assertIn("violation_report", sql)
        self.assertIn("FOR UPDATE", sql)

    def test_invalid_date_is_not_expired(self):
        self.booking.date = "not-a-date"
        self.assertEqual(self.release(), [])

    def test_default_and_setting_bounds(self):
        restaurant = Restaurant(name="Test", slug="test", address="Test", district="Test")
        self.assertEqual(restaurant.booking_hold_minutes, 30)
        for value in (1, 30, 240):
            self.assertEqual(PartnerOperationalUpdate(booking_hold_minutes=value).booking_hold_minutes, value)
        for value in (0, -1, 241, 1.5):
            with self.assertRaises(ValidationError):
                PartnerOperationalUpdate(booking_hold_minutes=value)

    def test_operational_save_persists_hold_setting(self):
        self.restaurant.booking_lead_minutes = 120
        self.restaurant.booking_confirmation_minutes = 60
        self.session.exec.side_effect = [MagicMock(first=lambda: self.restaurant), MagicMock(first=lambda: None)]
        result = update_operational(PartnerOperationalUpdate(booking_hold_minutes=45),
            SimpleNamespace(userId=2), self.session, BackgroundTasks())
        self.assertIs(result, self.restaurant)
        self.assertEqual(result.booking_hold_minutes, 45)
        self.session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
