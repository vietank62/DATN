import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from core.booking_email import queue_booking_email, deliver_booking_emails
from models.bookingEmail import BookingEmail


class BookingEmailFlowTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.session.exec.return_value.first.return_value = None
        self.session.get.return_value = SimpleNamespace(name="Nhà hàng thử nghiệm", manager_id=2, booking_lead_minutes=15)
        self.booking = SimpleNamespace(bookingId=23, restaurantId=1, userId=3, contactEmail="test@example.com", contactName="Nguyễn An", date="2026-10-06", time="22:02", guestCount=2, childCount=0, depositAmount=2000, depositStatus="pending")

    def test_unpaid_deposit_does_not_queue_email(self):
        queue_booking_email(self.session, self.booking, "awaiting_payment")
        queue_booking_email(self.session, self.booking, "pending")
        self.session.add.assert_not_called()

    def test_paid_email_is_formal_and_vietnamese(self):
        self.booking.depositStatus = "paid"
        queue_booking_email(self.session, self.booking, "pending")
        email = next(call.args[0] for call in self.session.add.call_args_list if isinstance(call.args[0], BookingEmail))
        self.assertIn("Kính gửi Quý khách", email.body)
        self.assertIn("06/10/2026", email.body)
        self.assertIn("2.000 đồng", email.body)
        self.assertIn("Đã nhận thanh toán đặt cọc", email.subject)
        self.assertNotIn("awaiting_payment", email.body + email.subject)

    @patch.dict("os.environ", {"SMTP_HOST": "smtp.example.com", "SMTP_FROM": "test@example.com", "SMTP_SSL": "false"})
    @patch("core.booking_email.smtplib.SMTP", side_effect=OSError("offline"))
    def test_smtp_failure_keeps_email_for_retry(self, smtp):
        email = BookingEmail(id=1, booking_id=23, event="pending", recipient="test@example.com", subject="Đặt bàn", body="Nội dung")
        self.session.exec.return_value.all.return_value = [email]
        self.assertEqual(deliver_booking_emails(self.session), 0)
        self.assertIsNone(email.sent_at)
        self.assertIsNotNone(email.next_attempt_at)
        self.session.commit.assert_called_once()
