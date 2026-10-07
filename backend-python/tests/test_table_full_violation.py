import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from models.violationReport import ViolationReport
from core.table_reservations import record_full_table_violation, suspend_unexplained_table_violations


class FullTableViolationTests(unittest.TestCase):
    def test_duplicate_does_not_create_second_violation(self):
        session = MagicMock()
        existing = SimpleNamespace(id=5)
        session.exec.return_value.first.return_value = existing
        self.assertIs(record_full_table_violation(session, SimpleNamespace(id=1), 7), existing)
        session.add.assert_not_called()

    def test_new_violation_preserves_restaurant_state(self):
        session = MagicMock()
        session.exec.side_effect = [MagicMock(first=lambda: None), MagicMock(all=lambda: [])]
        restaurant = SimpleNamespace(id=1, manager_id=2, name="Nhà hàng", is_active=True, is_report_suspended=False)
        report = record_full_table_violation(session, restaurant, 7)
        self.assertEqual(report.source, "table_full")
        self.assertEqual(report.status, "open")
        self.assertTrue(report.restaurant_active_before_report)
        self.assertTrue(restaurant.is_active)

    def test_overdue_without_explanation_suspends(self):
        now = datetime.now(timezone.utc)
        report = ViolationReport(id=5, booking_id=7, reporter_id=2, target_restaurant_id=1, target_type="restaurant", source="table_full", reason="Hết bàn", created_at=now-timedelta(hours=24))
        restaurant = SimpleNamespace(id=1, manager_id=2, is_active=True, is_report_suspended=False)
        session = MagicMock()
        session.exec.side_effect = [MagicMock(all=lambda: [report]), MagicMock(first=lambda: restaurant), MagicMock(first=lambda: report)]
        suspend_unexplained_table_violations(session, now)
        self.assertFalse(restaurant.is_active)
        self.assertTrue(restaurant.is_report_suspended)
        self.assertEqual(report.status, "confirmed")

    def test_explanation_submitted_during_check_prevents_suspension(self):
        report = SimpleNamespace(id=5, target_restaurant_id=1, status="appeal_pending", appeal_reason="Đã bố trí bàn khác")
        restaurant = SimpleNamespace(id=1, manager_id=2, is_active=True, is_report_suspended=False)
        session = MagicMock()
        session.exec.side_effect = [MagicMock(all=lambda: [report]), MagicMock(first=lambda: restaurant), MagicMock(first=lambda: report)]
        suspend_unexplained_table_violations(session)
        self.assertTrue(restaurant.is_active)
        session.add.assert_not_called()

    def test_no_overdue_records_does_not_suspend(self):
        session = MagicMock()
        session.exec.return_value.all.return_value = []
        suspend_unexplained_table_violations(session)
        session.add.assert_not_called()


if __name__ == "__main__":
    unittest.main()
