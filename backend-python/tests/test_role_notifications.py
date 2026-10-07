import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from fastapi import HTTPException
from models.notification import Notification
from routers.notification import notification_snapshot, mark_notification_read
from routers.partner import notify_admins_of_application


class RoleNotificationTests(unittest.TestCase):
    def test_snapshot_counts_all_unread_not_only_visible_items(self):
        session = MagicMock()
        item = Notification(id=1, userId=2, title="Thông báo", message="Nội dung", createdAt="2026-10-06", isRead=False)
        session.exec.side_effect = [MagicMock(all=lambda: [item]), MagicMock(one=lambda: 25)]
        snapshot = notification_snapshot(session, 2)
        self.assertEqual(snapshot["unreadCount"], 25)
        self.assertEqual(len(snapshot["items"]), 1)

    def test_cannot_mark_another_users_notification_read(self):
        session = MagicMock()
        session.get.return_value = SimpleNamespace(userId=3)
        with self.assertRaises(HTTPException):
            mark_notification_read(1, SimpleNamespace(userId=2), session)
        session.commit.assert_not_called()

    def test_new_application_notifies_each_admin(self):
        session = MagicMock()
        session.exec.return_value.all.return_value = [SimpleNamespace(userId=2), SimpleNamespace(userId=3)]
        notify_admins_of_application(session, SimpleNamespace(name="Nhà hàng"), is_new=True)
        notices = [call.args[0] for call in session.add.call_args_list]
        self.assertEqual([notice.userId for notice in notices], [2, 3])
        self.assertTrue(all(notice.type == "approval_pending" for notice in notices))

    def test_application_update_notifies_admin(self):
        session = MagicMock()
        session.exec.return_value.all.return_value = [SimpleNamespace(userId=2)]
        notify_admins_of_application(session, SimpleNamespace(name="Nhà hàng"))
        self.assertIn("cập nhật", session.add.call_args.args[0].title)


if __name__ == "__main__":
    unittest.main()
