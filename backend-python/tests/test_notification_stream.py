"""Offline notification regressions using SQLite, never the configured database."""
import os
os.environ["URL_DATABASE"] = "postgresql://test:test@localhost/test"
os.environ["UPSTASH_REDIS_REST_URL"] = "https://example.invalid"
os.environ["UPSTASH_REDIS_REST_TOKEN"] = "test"
import asyncio
import json
import unittest
from unittest.mock import AsyncMock, Mock, patch
from sqlalchemy import ARRAY, JSON
from sqlmodel import SQLModel, Session, create_engine
from models import Notification, User
from models.bookingItem import BookingItem
from models.violationReport import ViolationReport
from routers.notification import notification_snapshot, stream_notifications

for table in SQLModel.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, ARRAY):
            column.type = JSON()


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(name="Guest", email="guest@test.com", phone="0900000000", password="x")
        self.other = User(name="Other", email="other@test.com", phone="0900000001", password="x")
        self.session.add_all([self.user, self.other])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_all_types_total_unread_and_account_isolation(self):
        for i in range(12):
            self.session.add(Notification(userId=self.user.userId, title=str(i),
                message="event", type=f"type_{i}", createdAt="2026-09-26"))
        self.session.add(Notification(userId=self.other.userId, title="private",
            message="other account", createdAt="2026-09-26"))
        self.session.commit()
        result = notification_snapshot(self.session, self.user.userId)
        self.assertEqual(result["unreadCount"], 12)
        self.assertEqual(len(result["items"]), 10)
        self.assertEqual(result["items"][0]["title"], "11")
        self.assertTrue(all(item["userId"] == self.user.userId for item in result["items"]))
        oldest = self.session.get(Notification, 1)
        oldest.isRead = True
        self.session.add(oldest)
        self.session.commit()
        self.assertEqual(notification_snapshot(self.session, self.user.userId)["unreadCount"], 11)

    def test_stream_initial_event_changes_heartbeat_and_disconnect(self):
        async def run():
            first = {"items": [], "unreadCount": 0}
            changed = {"items": [{"id": 1, "type": "refund_required"}], "unreadCount": 1}
            read = {"items": [{"id": 1, "type": "refund_required", "isRead": True}], "unreadCount": 0}
            request = Mock()
            request.is_disconnected = AsyncMock(side_effect=[False, False, False, False, True])
            session = Mock()
            user = Mock(userId=7)
            with patch("routers.notification.read_stream_snapshot", side_effect=[first, first, changed, read]) as snapshots, patch("routers.notification.asyncio.sleep", new_callable=AsyncMock):
                response = stream_notifications(request, user, session)
                chunks = [chunk async for chunk in response.body_iterator]
                session.close.assert_called_once()
                self.assertEqual(len(chunks), 4)
                self.assertEqual(chunks[1], ": heartbeat\n\n")
                self.assertEqual(json.loads(chunks[2].split("data: ")[1]), changed)
                self.assertEqual(json.loads(chunks[3].split("data: ")[1]), read)
                self.assertTrue(all(call.args == (7,) for call in snapshots.call_args_list))
                self.assertEqual(response.headers["x-accel-buffering"], "no")
        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
