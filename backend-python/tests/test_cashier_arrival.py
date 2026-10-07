import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import HTTPException
from core.booking_capacity import APP_TIME_ZONE
from routers.cashier import arrive_online_booking, BookingTableChoice


class ArrivalTests(unittest.TestCase):
    def run_arrival(self, minutes=-1, orders=None, change=False, violation=None):
        meal = datetime.now(APP_TIME_ZONE) + timedelta(minutes=minutes)
        booking = SimpleNamespace(bookingId=7, status="confirmed", date=meal.date().isoformat(), time=meal.strftime("%H:%M"), requestSeats=2, attendance=None)
        restaurant = SimpleNamespace(id=1, is_active=True, is_report_suspended=False, approval_status="approved")
        old = SimpleNamespace(id=1, name="A1", seats=4, is_active=True)
        new = SimpleNamespace(id=2, name="A2", seats=4, is_active=True)
        session = MagicMock()
        session.exec.side_effect = [MagicMock(first=lambda: booking), MagicMock(all=lambda: [old]), MagicMock(all=lambda: [old, new])]
        session.execute.return_value.first.return_value = SimpleNamespace(data={"orders": orders or {}, "shifts": []})
        with patch("routers.cashier.managed_restaurant", return_value=restaurant), patch("routers.cashier.due_reservations", return_value=[]), patch("core.booking_table_assignment.assign_booking_tables", return_value=[new]), patch("core.table_reservations.sync_table_reservations"), patch("core.table_reservations.record_full_table_violation", violation or MagicMock()):
            result = arrive_online_booking(7, BookingTableChoice(table_id=2 if change else None), session, SimpleNamespace(id=3))
        return result, booking, session

    def test_arrival_keeps_confirmed_booking(self):
        result, booking, session = self.run_arrival()
        self.assertEqual(result["table_id"], 1)
        self.assertEqual(booking.status, "confirmed")
        self.assertEqual(booking.attendance, "arrived")
        session.commit.assert_called_once()

    def test_not_before_mealtime(self):
        with self.assertRaises(HTTPException) as caught:
            self.run_arrival(minutes=10)
        self.assertEqual(caught.exception.status_code, 409)

    def test_move_preserves_order(self):
        import json
        order = {"bookingId": 7, "lines": [{"id": 9, "quantity": 2}], "preordersImported": True}
        result, _, session = self.run_arrival(orders={"1": order}, change=True)
        data = json.loads(session.execute.call_args_list[-1].args[1]["data"])
        self.assertEqual(result["table_id"], 2)
        self.assertNotIn("1", data["orders"])
        self.assertEqual(data["orders"]["2"], order)

    def test_cannot_overwrite_other_bill(self):
        with self.assertRaises(HTTPException) as caught:
            self.run_arrival(orders={"2": {"lines": [{"id": 9}]}}, change=True)
        self.assertEqual(caught.exception.status_code, 409)

    def test_all_tables_occupied_records_violation_and_blocks_arrival(self):
        violation = MagicMock()
        with self.assertRaises(HTTPException) as caught:
            self.run_arrival(orders={"1": {"lines": [{"id": 8}]}, "2": {"lines": [{"id": 9}]}}, violation=violation)
        self.assertEqual(caught.exception.status_code, 409)
        violation.assert_called_once()
        self.assertIn("24", caught.exception.detail)


if __name__ == "__main__":
    unittest.main()
