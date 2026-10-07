import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from fastapi import HTTPException
from core.booking_table_assignment import assign_booking_tables


class AssignmentTests(unittest.TestCase):
    def setup_assignment(self, seats=4):
        session = MagicMock()
        tables = [SimpleNamespace(id=1, seats=8, name="A1"), SimpleNamespace(id=2, seats=4, name="A2")]
        session.exec.side_effect = [MagicMock(all=lambda: []), MagicMock(all=lambda: tables), MagicMock(all=lambda: [])]
        restaurant = SimpleNamespace(id=1, booking_duration_minutes=120)
        booking = SimpleNamespace(bookingId=7, date="2026-12-01", time="19:00", requestSeats=seats)
        return session, restaurant, booking

    def test_auto_smallest_sufficient_table(self):
        args = self.setup_assignment()
        selected = assign_booking_tables(*args)
        self.assertEqual([table.id for table in selected], [2])

    def test_manual_table(self):
        selected = assign_booking_tables(*self.setup_assignment(), table_id=1)
        self.assertEqual([table.id for table in selected], [1])

    def test_table_too_small(self):
        with self.assertRaises(HTTPException):
            assign_booking_tables(*self.setup_assignment(6), table_id=2)

    def test_unknown_table(self):
        with self.assertRaises(HTTPException):
            assign_booking_tables(*self.setup_assignment(), table_id=99)

    def test_auto_largest_table_requires_confirmation(self):
        with self.assertRaises(HTTPException) as caught:
            assign_booking_tables(*self.setup_assignment(10))
        self.assertEqual(caught.exception.detail["code"], "INSUFFICIENT_TABLE_SEATS")
        self.assertEqual(caught.exception.detail["table_id"], 1)

    def test_auto_largest_table_after_confirmation(self):
        selected = assign_booking_tables(*self.setup_assignment(10), allow_insufficient=True)
        self.assertEqual([table.id for table in selected], [1])

    def test_manual_small_table_after_confirmation(self):
        selected = assign_booking_tables(*self.setup_assignment(6), table_id=2, allow_insufficient=True)
        self.assertEqual([table.id for table in selected], [2])

    def test_auto_avoids_table_with_existing_bill(self):
        selected = assign_booking_tables(*self.setup_assignment(6), allow_insufficient=True, blocked_ids={1})
        self.assertEqual([table.id for table in selected], [2])

    def test_insufficient_table_does_not_write_without_confirmation(self):
        session, restaurant, booking = self.setup_assignment(10)
        with self.assertRaises(HTTPException):
            assign_booking_tables(session, restaurant, booking)
        session.delete.assert_not_called()
        session.add.assert_not_called()
