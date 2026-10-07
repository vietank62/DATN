"""Hold expiry integration: real ORM writes in an isolated SQLite database."""
import unittest
from datetime import datetime
from sqlalchemy import ARRAY, JSON, text
from sqlmodel import SQLModel, Session, create_engine, select
import main
from models import User, Restaurant, Booking, Notification
from models.violationReport import ViolationReport
from core.booking_hold_expiry import release_expired_holds
from core.booking_capacity import APP_TIME_ZONE, remaining_seats
from models.restaurantTable import RestaurantTable, BookingTable


class BookingHoldDatabaseTests(unittest.TestCase):
    def setUp(self):
        for table in SQLModel.metadata.tables.values():
            for column in table.columns:
                if isinstance(column.type, ARRAY):
                    column.type = JSON()
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.session.execute(text("CREATE TABLE table_booking_incidents (booking_id INTEGER, restaurant_id INTEGER, state TEXT, cleared_at TEXT)"))
        self.manager = User(name="Manager", email="manager@hold.test", phone="1", password="test", role="manager")
        self.customer = User(name="Customer", email="customer@hold.test", phone="2", password="test")
        self.session.add_all([self.manager, self.customer]); self.session.flush()
        self.restaurant = Restaurant(name="Test", slug="hold-test", address="Test", district="Test",
            manager_id=self.manager.userId, booking_hold_minutes=30)
        self.session.add(self.restaurant); self.session.flush()
        self.table = RestaurantTable(name="A1", seats=4, restaurant_id=self.restaurant.id)
        self.session.add(self.table); self.session.flush()
        self.booking = Booking(restaurantId=self.restaurant.id, userId=self.customer.userId,
            date="2026-10-07", time="19:00", guestCount=2, requestSeats=2, status="confirmed",
            contactName="Customer", contactEmail="customer@hold.test", contactPhone="2",
            depositAmount=100000, depositStatus="paid")
        self.session.add(self.booking); self.session.flush()
        self.session.add(BookingTable(booking_id=self.booking.bookingId, table_id=self.table.id))
        self.session.commit()
        self.workspace = {"orders": {str(self.table.id): {"bookingId": self.booking.bookingId,
            "preordersImported": True, "lines": [{"id": 9}]}}, "shifts": []}
        self.now = datetime(2026, 10, 7, 19, 30, tzinfo=APP_TIME_ZONE)

    def tearDown(self):
        self.session.close(); self.engine.dispose()

    def release(self):
        return release_expired_holds(self.session, self.restaurant, self.workspace, self.now)

    def test_commit_frees_capacity_and_notifies_once(self):
        self.assertEqual(remaining_seats(self.session, self.restaurant, "2026-10-07", "19:40")[0], 0)
        self.assertEqual(self.release(), [self.booking.bookingId])
        self.session.commit(); self.session.refresh(self.booking)
        self.assertEqual(self.booking.status, "cancelled")
        self.assertEqual(self.booking.depositStatus, "paid")
        self.assertEqual(remaining_seats(self.session, self.restaurant, "2026-10-07", "19:40")[0], 4)
        self.assertEqual(self.workspace["orders"], {})
        self.assertEqual(self.release(), [])
        self.assertEqual(len(self.session.exec(select(Notification)).all()), 2)

    def test_real_query_excludes_arrived_guest(self):
        self.booking.attendance = "arrived"
        self.session.add(self.booking); self.session.commit()
        self.assertEqual(self.release(), [])
        self.assertEqual(self.booking.status, "confirmed")

    def test_real_query_excludes_table_full_incident(self):
        self.session.add(ViolationReport(booking_id=self.booking.bookingId,
            reporter_id=self.manager.userId, target_restaurant_id=self.restaurant.id,
            target_type="restaurant", source="table_full", reason="Khách đã tới nhưng hết bàn"))
        self.session.commit()
        self.assertEqual(self.release(), [])
        self.assertEqual(self.booking.status, "confirmed")

    def test_real_query_isolates_other_restaurant(self):
        other = Restaurant(name="Other", slug="other-hold", address="Test", district="Test")
        self.session.add(other); self.session.flush()
        self.assertEqual(release_expired_holds(self.session, other, self.workspace, self.now), [])
        self.assertEqual(self.booking.status, "confirmed")

    def test_rollback_restores_booking_and_removes_notifications(self):
        self.release(); self.session.rollback(); self.session.refresh(self.booking)
        self.assertEqual(self.booking.status, "confirmed")
        self.assertIsNone(self.booking.attendance)
        self.assertEqual(len(self.session.exec(select(Notification)).all()), 0)


if __name__ == "__main__":
    unittest.main()
