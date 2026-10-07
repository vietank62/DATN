import unittest
from pydantic import ValidationError
from routers.cashier import Bill, InvoiceRequest


class InvoiceRequestTests(unittest.TestCase):
    def test_company_required_fields(self):
        with self.assertRaises(ValidationError):
            InvoiceRequest(buyerType="company", requestedAt="2026-10-03T00:00:00Z")

    def test_individual_requires_name(self):
        with self.assertRaises(ValidationError):
            InvoiceRequest(buyerType="individual", requestedAt="2026-10-03T00:00:00Z")

    def test_email_and_status_validation(self):
        for extra in ({"email": "not-an-email"}, {"status": "issued"}):
            with self.assertRaises(ValidationError):
                InvoiceRequest(buyerType="individual", customerName="Khách", requestedAt="2026-10-03T00:00:00Z", **extra)

    def test_request_survives_bill_roundtrip(self):
        invoice = InvoiceRequest(buyerType="company", companyName="TableNow", taxCode="0123456789", address="TP. Hồ Chí Minh", email="test@example.com", requestedAt="2026-10-03T00:00:00Z")
        bill = Bill(id="test", table="A1", time="2026-10-03T00:00:00Z", method="Tiền mặt", lines=[], note="", discount=0, guests=1, vat=8, invoiceRequest=invoice)
        saved = Bill.model_validate(bill.model_dump(exclude_none=True))
        self.assertEqual(saved.invoiceRequest, invoice)
        self.assertEqual(saved.invoiceRequest.status, "requested")


if __name__ == "__main__":
    unittest.main()
