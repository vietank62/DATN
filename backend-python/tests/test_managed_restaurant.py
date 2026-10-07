import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from fastapi import HTTPException
from routers.restaurant_tables import managed_restaurant


class ManagedRestaurantTests(unittest.TestCase):
    def test_missing_link_has_distinct_error(self):
        session = MagicMock()
        session.exec.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as raised:
            managed_restaurant(session, SimpleNamespace(userId=1), lock=False)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.headers["X-Error-Code"], "RESTAURANT_NOT_LINKED")
        self.assertIn("hoàn tất hồ sơ", raised.exception.detail)

    def test_linked_restaurant_is_returned(self):
        session = MagicMock()
        restaurant = SimpleNamespace(id=3)
        session.exec.return_value.first.return_value = restaurant
        self.assertIs(managed_restaurant(session, SimpleNamespace(userId=1)), restaurant)
