import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from routers.cashier import Order, TableOrderUpdate, save_table_order


class TableOrderTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.session.exec.return_value.first.return_value = 7
        self.session.execute.return_value.first.return_value = SimpleNamespace(version=4)
        self.restaurant = SimpleNamespace(id=1, vat_enabled=True)
        self.order = Order(lines=[], note="Ghi chú mới", discount=100, guests=4, vat=0)

    def call(self, order):
        with patch("routers.cashier.managed_restaurant", return_value=self.restaurant) as managed:
            result = save_table_order(7, TableOrderUpdate(version=3, order=order), self.session, SimpleNamespace())
            managed.assert_called_once_with(self.session, unittest.mock.ANY)
            return result

    def test_single_table_update_and_vat(self):
        result = self.call(self.order)
        self.assertEqual(result["version"], 4)
        self.assertEqual(result["order"]["vat"], 8)
        self.assertEqual(result["order"]["note"], "Ghi chú mới")
        statement, values = self.session.execute.call_args.args
        self.assertIn("jsonb_set", str(statement))
        self.assertIn("version=:version", str(statement))
        self.assertEqual(values["table_key"], "7")
        self.assertNotIn("shifts", values["order_data"])
        self.session.commit.assert_called_once()

    def test_delete_order_uses_one_path(self):
        result = self.call(None)
        self.assertIsNone(result["order"])
        self.assertIn("data #-", str(self.session.execute.call_args.args[0]))

    def test_conflicting_version_does_not_commit(self):
        self.session.execute.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as error:
            self.call(self.order)
        self.assertEqual(error.exception.status_code, 409)
        self.session.rollback.assert_called_once()
        self.session.commit.assert_not_called()

    def test_other_restaurant_table_is_rejected(self):
        self.session.exec.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as error:
            self.call(self.order)
        self.assertEqual(error.exception.status_code, 404)
        self.session.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
