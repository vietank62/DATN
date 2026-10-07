import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi import HTTPException
from routers.booking import ConfirmationPayload  # Register booking-related models.
from core.booking_voucher import send_booking_voucher
from models.chatMessage import ChatMessage
from models.notification import Notification


class BookingVoucherTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.booking = SimpleNamespace(userId=12, bookingId=34, date="2026-10-04", time="19:00")
        self.restaurant = SimpleNamespace(id=56, name="Nhà hàng thử nghiệm")

    def test_guest_without_account_rejected(self):
        self.booking.userId = None
        with self.assertRaises(HTTPException) as error:
            send_booking_voucher(self.session, self.booking, self.restaurant, 78, 90)
        self.assertEqual(error.exception.status_code, 422)
        self.session.execute.assert_not_called()

    def test_invalid_voucher_rejected(self):
        self.session.execute.return_value.mappings.return_value.first.return_value = None
        with self.assertRaises(HTTPException):
            send_booking_voucher(self.session, self.booking, self.restaurant, 78, 90)
        self.session.add.assert_not_called()

    def test_valid_voucher_queues_message_and_notification_without_commit(self):
        voucher = {"code":"WELCOME10", "title":"Ưu đãi", "kind":"percent", "value":10, "minimum":100000, "expires_at":datetime.now(timezone.utc)+timedelta(days=1)}
        discount_result = MagicMock()
        discount_result.mappings.return_value.first.return_value = voucher
        conversation_result = MagicMock()
        conversation_result.scalar_one.return_value = 99
        self.session.execute.side_effect = [discount_result, conversation_result]
        self.assertEqual(send_booking_voucher(self.session, self.booking, self.restaurant, 78, 90), 99)
        message, notification = [call.args[0] for call in self.session.add.call_args_list]
        self.assertIsInstance(message, ChatMessage)
        self.assertEqual(message.sender_id, 78)
        self.assertEqual(message.conversation_id, 99)
        self.assertIn("WELCOME10", message.content)
        self.assertIn("Giảm 10%", message.content)
        self.assertIsInstance(notification, Notification)
        self.assertEqual(notification.userId, 12)
        self.assertEqual(notification.conversationId, 99)
        self.session.commit.assert_not_called()
        self.assertEqual(self.session.execute.call_args_list[0].args[1], {"id":90,"restaurant_id":56})


if __name__ == "__main__":
    unittest.main()
