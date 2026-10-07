import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import HTTPException
from core.cashier_booking_completion import complete_paid_bookings


class PaidBookingTests(unittest.TestCase):
    def run_completion(self, orders=None, old_bill=False, linked=True):
        session = MagicMock()
        booking = SimpleNamespace(status="confirmed", attendance="arrived", bookingId=7)
        session.exec.return_value.first.return_value = booking
        bill = {"id": "paid-1", "bookingId": 7}
        previous = {"orders": {"1": {"bookingId": 7 if linked else 8, "lines": [{"id": 9}]}}, "shifts": [{"bills": [bill] if old_bill else []}]}
        current = {"orders": orders or {}, "shifts": [{"bills": [bill]}]}
        with patch("core.cashier_booking_completion.queue_booking_email") as email:
            result = complete_paid_bookings(session, 1, previous, current)
        return result, booking, current, email

    def test_final_payment_completes_booking(self):
        result, booking, _, email = self.run_completion()
        self.assertEqual(result, [7])
        self.assertEqual(booking.status, "completed")
        self.assertTrue(booking.completedAt)
        email.assert_called_once()

    def test_split_payment_keeps_booking_and_table(self):
        result, booking, _, email = self.run_completion({"1": {"bookingId": 7, "lines": [{"id": 9}]}})
        self.assertEqual(result, [])
        self.assertEqual(booking.status, "confirmed")
        email.assert_not_called()

    def test_another_occupied_table_keeps_booking(self):
        result, booking, _, _ = self.run_completion({"2": {"bookingId": 7, "kitchenLines": [{"id": 9}]}})
        self.assertEqual(result, [])
        self.assertEqual(booking.status, "confirmed")

    def test_empty_linked_tables_released(self):
        _, _, current, _ = self.run_completion({"2": {"bookingId": 7, "lines": []}, "3": {"lines": [{"id": 8}]}})
        self.assertNotIn("2", current["orders"])
        self.assertIn("3", current["orders"])

    def test_editing_paid_bill_does_not_complete_again(self):
        result, _, _, email = self.run_completion(old_bill=True)
        self.assertEqual(result, [])
        email.assert_not_called()

    def test_unlinked_bill_cannot_complete_booking(self):
        with self.assertRaises(HTTPException):
            self.run_completion(linked=False)

    def test_reconcile_old_paid_booking_releases_recreated_empty_order(self):
        session = MagicMock()
        booking = SimpleNamespace(status="confirmed", attendance="arrived", bookingId=7)
        session.exec.return_value.first.return_value = booking
        workspace = {"orders": {"1": {"bookingId": 7, "lines": [], "kitchenLines": []}}, "shifts": [{"bills": [{"id": "old-paid", "bookingId": 7}]}]}
        with patch("core.cashier_booking_completion.queue_booking_email"):
            completed = complete_paid_bookings(session, 1, workspace, workspace, reconcile=True)
        self.assertEqual(completed, [7])
        self.assertEqual(booking.status, "completed")
        self.assertEqual(workspace["orders"], {})

    def test_reconcile_keeps_unpaid_split_order(self):
        session = MagicMock()
        workspace = {"orders": {"1": {"bookingId": 7, "lines": [{"id": 9}]}}, "shifts": [{"bills": [{"id": "partial-paid", "bookingId": 7}]}]}
        self.assertEqual(complete_paid_bookings(session, 1, workspace, workspace, reconcile=True), [])
        session.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
