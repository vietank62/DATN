import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import BackgroundTasks
from routers.booking import _persist_booking_status
from core.booking_email import deliver_booking_emails_background


class BookingEmailBackgroundTests(unittest.TestCase):
    def test_status_commits_and_schedules_without_sending_inline(self):
        for status in ("confirmed", "completed"):
            with self.subTest(status=status):
                session = MagicMock()
                booking = SimpleNamespace(bookingId=123, status="pending")
                tasks = BackgroundTasks()
                with patch("routers.booking.queue_booking_email") as queue, patch("routers.booking._serialize_booking", return_value={"status": status}), patch("core.booking_email.deliver_booking_emails") as send:
                    result = _persist_booking_status(session, booking, status, tasks)
                    self.assertEqual(result, {"status": status})
                    session.commit.assert_called_once()
                    queue.assert_called_once_with(session, booking, status)
                    send.assert_not_called()
                    self.assertEqual(len(tasks.tasks), 1)
                    self.assertIs(tasks.tasks[0].func, deliver_booking_emails_background)
                    self.assertEqual(tasks.tasks[0].args, (123,))

    def test_delivery_uses_its_own_session(self):
        with patch("sqlmodel.Session") as session_factory, patch("core.booking_email.deliver_booking_emails", return_value=1) as send:
            session = session_factory.return_value.__enter__.return_value
            self.assertEqual(deliver_booking_emails_background(123), 1)
            send.assert_called_once_with(session, booking_id=123, ignore_retry_schedule=True)
            session_factory.return_value.__exit__.assert_called_once()

    def test_delivery_failure_is_logged_without_affecting_response(self):
        with patch("sqlmodel.Session", side_effect=RuntimeError("database temporarily unavailable")), patch("core.booking_email.logger.exception") as log:
            self.assertIsNone(deliver_booking_emails_background(123))
            log.assert_called_once()


if __name__ == "__main__":
    unittest.main()
