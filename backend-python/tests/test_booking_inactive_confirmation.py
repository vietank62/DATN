import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import main
from fastapi import BackgroundTasks, HTTPException
from routers.booking import confirm_booking, ConfirmationPayload


class InactiveConfirmationTests(unittest.TestCase):
    def test_inactive_suspended_and_unapproved_cannot_confirm(self):
        for active, suspended, approval in [(False, False, "approved"), (True, True, "approved"), (True, False, "pending")]:
            session = MagicMock()
            session.exec.return_value.first.return_value = SimpleNamespace(status="pending", restaurantId=1)
            restaurant = SimpleNamespace(is_active=active,is_report_suspended=suspended,approval_status=approval)
            with patch("routers.booking._get_restaurant_or_404",return_value=restaurant), patch("routers.booking._ensure_restaurant_access"), patch("routers.booking.send_booking_voucher") as send, patch("routers.booking._persist_booking_status") as persist:
                with self.assertRaises(HTTPException) as error:
                    confirm_booking(BackgroundTasks(),1,SimpleNamespace(userId=1),session,ConfirmationPayload(voucher_id=2))
                self.assertEqual(error.exception.status_code,409)
                send.assert_not_called()
                persist.assert_not_called()
                session.commit.assert_not_called()
