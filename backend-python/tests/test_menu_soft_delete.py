import unittest
from types import SimpleNamespace
from unittest.mock import patch

import main
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, create_engine
from models.menuItem import RestaurantMenuList
from models.bookingItem import BookingItem
from models.restaurant import Restaurant
from routers.menuitem import delete_menu_item, update_menu_item_availability


class MenuSoftDeleteTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        with self.engine.begin() as conn:
            conn.exec_driver_sql("PRAGMA foreign_keys=ON")
            conn.exec_driver_sql("CREATE TABLE restaurants (id INTEGER PRIMARY KEY)")
            conn.exec_driver_sql('CREATE TABLE booking ("bookingId" INTEGER PRIMARY KEY)')
            conn.exec_driver_sql("INSERT INTO restaurants VALUES (1)")
            conn.exec_driver_sql("INSERT INTO booking VALUES (27)")
        RestaurantMenuList.__table__.create(self.engine)
        BookingItem.__table__.create(self.engine)
        self.session = Session(self.engine)
        self.item = RestaurantMenuList(restaurant_id=1, name="Món cũ", category="Món chính", price=100000)
        self.session.add(self.item)
        self.session.commit()
        self.session.refresh(self.item)
        self.booking_item = BookingItem(bookingId=27, itemId=self.item.id, quantity=2, price=100000)
        self.session.add(self.booking_item)
        self.session.commit()
        self.owner = patch("routers.menuitem.require_restaurant_owner")
        self.owner.start()

    def tearDown(self):
        self.owner.stop()
        self.session.close()
        self.engine.dispose()

    def test_referenced_dish_can_be_deleted_without_destroying_history(self):
        tasks = BackgroundTasks()
        delete_menu_item(1, self.item.id, self.session, SimpleNamespace(userId=1), tasks)
        self.session.refresh(self.item)
        self.assertTrue(self.item.is_deleted)
        self.assertFalse(self.item.is_available)
        self.assertEqual(self.session.get(BookingItem, self.booking_item.bookingItemId).quantity, 2)
        self.assertEqual(len(tasks.tasks), 1)
        self.assertEqual(self.session.execute(text("SELECT COUNT(*) FROM restaurant_menu_lists WHERE is_deleted=false")).scalar(), 0)

    def test_physical_delete_would_violate_booking_foreign_key(self):
        self.session.delete(self.item)
        with self.assertRaises(IntegrityError):
            self.session.commit()
        self.session.rollback()

    def test_other_restaurant_cannot_delete_item(self):
        with self.assertRaises(HTTPException) as error:
            delete_menu_item(2, self.item.id, self.session, SimpleNamespace(userId=1), BackgroundTasks())
        self.assertEqual(error.exception.status_code, 404)
        self.assertFalse(self.item.is_deleted)

    def test_deleted_dish_cannot_be_reenabled(self):
        delete_menu_item(1, self.item.id, self.session, SimpleNamespace(userId=1), BackgroundTasks())
        original_get = self.session.get
        with patch.object(self.session, "get", side_effect=lambda model, key: SimpleNamespace(id=1) if model is Restaurant else original_get(model, key)):
            with self.assertRaises(HTTPException) as error:
                update_menu_item_availability(1, self.item.id, self.session, SimpleNamespace(userId=1), BackgroundTasks())
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
