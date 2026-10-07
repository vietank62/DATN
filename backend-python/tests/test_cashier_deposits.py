import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock
import main
from fastapi import HTTPException
from core.cashier_deposits import apply_deposit_credits


class DepositCreditTests(unittest.TestCase):
    def setUp(self):
        self.session = MagicMock()
        self.session.exec.return_value.all.return_value = [(SimpleNamespace(bookingId=27, depositAmount=100000), SimpleNamespace(amount=100000))]
        self.order = {"bookingId": 27, "lines": [{"price": 200000, "quantity": 1}], "discount": 0, "vat": 8}
        self.previous = {"orders": {"1": deepcopy(self.order)}, "shifts": [{"bills": []}]}

    def settle(self, price=200000, previous=None):
        bill = {**self.order, "id": "new", "lines": [{"price": price, "quantity": 1}], "depositCredit": 999999}
        data = {"orders": {}, "shifts": [{"bills": [bill]}]}
        apply_deposit_credits(self.session, 1, data, self.previous if previous is None else previous)
        return data, bill

    def test_verified_deposit_overrides_client_amount(self):
        _, bill = self.settle()
        self.assertEqual(bill["depositCredit"], 100000)

    def test_split_payment_only_uses_remaining_deposit(self):
        previous = deepcopy(self.previous)
        previous["shifts"][0]["bills"] = [{**self.order, "id": "old", "depositCredit": 60000}]
        data = {"orders": {"1": deepcopy(self.order)}, "shifts": [{"bills": [*previous["shifts"][0]["bills"], {**self.order, "id": "new"}]}]}
        apply_deposit_credits(self.session, 1, data, previous)
        self.assertEqual(data["shifts"][0]["bills"][1]["depositCredit"], 40000)
        self.assertEqual(data["orders"]["1"]["depositCredit"], 0)

    def test_credit_cannot_exceed_total_including_vat(self):
        _, bill = self.settle(price=50000)
        self.assertEqual(bill["depositCredit"], 54000)

    def test_unpaid_or_refunded_deposit_is_not_deducted(self):
        self.session.exec.return_value.all.return_value = []
        _, bill = self.settle()
        self.assertEqual(bill["depositCredit"], 0)

    def test_existing_bill_credit_cannot_be_reapplied_or_removed(self):
        data, bill = self.settle()
        original = deepcopy(data)
        bill["depositCredit"] = 999999
        apply_deposit_credits(self.session, 1, data, original)
        self.assertEqual(bill["depositCredit"], 100000)
        with self.assertRaises(HTTPException):
            apply_deposit_credits(self.session, 1, {"orders": {}, "shifts": []}, original)

    def test_unlinked_booking_cannot_claim_deposit(self):
        with self.assertRaises(HTTPException):
            self.settle(previous={"orders": {}, "shifts": []})

    def test_preview_does_not_change_historical_bills(self):
        data = deepcopy(self.previous)
        apply_deposit_credits(self.session, 1, data)
        self.assertEqual(data["orders"]["1"]["depositCredit"], 100000)


if __name__ == "__main__":
    unittest.main()
