"""Isolated lifecycle tests: no requests to real SePay or the configured database."""
import base64
import hashlib
import hmac
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select
from models.bookingItem import BookingItem
from models.booking import Booking
from models.depositPayment import DepositPayment
from models.depositCheckout import DepositCheckout
from models.notification import Notification
from models.user import User
from core.deposit_expiry import deposit_deadline, expire_unpaid_bookings
from core.deposit_checkout import create_checkout, checkout_status, process_gateway_ipn, maintain_checkout_sessions


class DepositCheckoutTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SEPAY_MERCHANT_ID": "test-merchant", "SEPAY_SECRET_KEY": "test-signing-secret",
            "SEPAY_IPN_SECRET_KEY": "test-ipn-secret", "SEPAY_ENV": "sandbox",
            "FRONTEND_URL": "https://frontend.example.test",
        })
        self.env.start()
        self.created = datetime(2030, 1, 1, 0, 0, tzinfo=timezone.utc)
        self.now = self.created
        self.clock = patch("core.deposit_checkout.utc_now", side_effect=lambda: self.now)
        self.clock.start()
        self.cancel = patch("core.deposit_checkout.cancel_gateway_order", return_value=True)
        self.cancel_mock = self.cancel.start()
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine, tables=[Booking.__table__, DepositPayment.__table__,
            DepositCheckout.__table__, Notification.__table__, User.__table__])
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()
        self.cancel.stop()
        self.clock.stop()
        self.env.stop()

    def booking(self, status="awaiting_payment", deposit_status="pending"):
        booking = Booking(userId=1, restaurantId=1, date="2030-01-02", time="18:00",
            guestCount=4, requestSeats=4, contactName="Test", contactEmail="test@example.com",
            contactPhone="0900000000", status=status, depositAmount=100000,
            depositStatus=deposit_status, createdAt=self.created.isoformat())
        self.session.add(booking)
        self.session.flush()
        payment = DepositPayment(booking_id=booking.bookingId, restaurant_id=1, user_id=1,
            amount=100000, transaction_code=f"TNBK{booking.bookingId}",
            status=deposit_status, created_at=booking.createdAt)
        self.session.add(payment)
        self.session.commit()
        return booking, payment

    def payload(self, form, minute=5, transaction_id="tx-1", amount="100000"):
        paid = self.created + timedelta(minutes=minute)
        return {"notification_type": "ORDER_PAID", "timestamp": int(self.now.timestamp()),
            "order": {"order_status": "CAPTURED", "order_currency": "VND", "order_amount": "100000.00",
                "order_invoice_number": form["invoiceNumber"]},
            "transaction": {"id": transaction_id, "transaction_status": "APPROVED",
                "transaction_type": "PAYMENT", "transaction_amount": amount,
                "transaction_currency": "VND", "payment_method": "BANK_TRANSFER",
                "transaction_date": paid.astimezone(timezone(timedelta(hours=7))).strftime("%Y-%m-%d %H:%M:%S")}}

    def ipn(self, data):
        return process_gateway_ipn(self.session, data, "test-ipn-secret")

    def test_active_status_poll_uses_one_select_without_writes(self):
        from sqlalchemy import event
        booking, _ = self.booking()
        booking_id = booking.bookingId
        create_checkout(self.session, booking_id, 1)
        statements = []
        def capture(conn, cursor, statement, parameters, context, many):
            statements.append(statement)
        event.listen(self.engine, "before_cursor_execute", capture)
        try:
            result = checkout_status(self.session, booking_id, 1)
        finally:
            event.remove(self.engine, "before_cursor_execute", capture)
        self.assertTrue(result["canCheckout"])
        self.assertEqual(len(statements), 1)
        self.assertTrue(statements[0].lstrip().upper().startswith("SELECT"))

    def test_scoped_expiry_does_not_modify_other_customers(self):
        first, _ = self.booking()
        second, _ = self.booking()
        second.userId = 2
        self.session.add(second)
        self.session.commit()
        count = expire_unpaid_bookings(self.session, self.created + timedelta(minutes=31), user_id=1)
        self.assertEqual(count, 1)
        self.assertEqual(first.status, "payment_expired")
        self.assertEqual(second.status, "awaiting_payment")

    def test_order_expires_at_30_minutes_once(self):
        booking, payment = self.booking()
        self.assertEqual(expire_unpaid_bookings(self.session, self.created + timedelta(minutes=30, microseconds=-1)), 0)
        self.assertEqual(expire_unpaid_bookings(self.session, self.created + timedelta(minutes=30)), 1)
        self.assertEqual((booking.status, booking.depositStatus, payment.status), ("payment_expired", "expired", "expired"))
        self.assertEqual(expire_unpaid_bookings(self.session, self.created + timedelta(hours=1)), 0)
        self.assertEqual(len(self.session.exec(select(Notification)).all()), 1)

    def test_active_session_reused_without_extending_any_deadline(self):
        booking, _ = self.booking()
        first = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=4)
        second = create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(first["invoiceNumber"], second["invoiceNumber"])
        self.assertEqual(first["expiresAt"], second["expiresAt"])
        self.assertEqual(datetime.fromisoformat(second["expiresAt"]), self.created + timedelta(minutes=10))
        self.assertEqual(datetime.fromisoformat(second["bookingExpiresAt"]), self.created + timedelta(minutes=30))

    def test_session_expiry_does_not_expire_booking_and_can_retry(self):
        booking, payment = self.booking()
        first = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=10)
        status = checkout_status(self.session, booking.bookingId, 1)
        self.assertEqual(status["sessionStatus"], "expired")
        self.assertTrue(status["canCheckout"])
        second = create_checkout(self.session, booking.bookingId, 1)
        self.assertNotEqual(first["invoiceNumber"], second["invoiceNumber"])
        self.assertEqual(booking.status, "awaiting_payment")
        self.assertEqual(payment.status, "pending")
        self.assertEqual(len(self.session.exec(select(DepositCheckout)).all()), 2)

    def test_last_session_cannot_outlive_order(self):
        booking, _ = self.booking()
        self.now += timedelta(minutes=27)
        form = create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(form["expiresAt"], form["bookingExpiresAt"])
        self.now = self.created + timedelta(minutes=30)
        with self.assertRaises(HTTPException) as error:
            create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(len(self.session.exec(select(DepositCheckout)).all()), 1)

    def test_no_session_created_for_other_customer(self):
        booking, _ = self.booking()
        with self.assertRaises(HTTPException) as error:
            create_checkout(self.session, booking.bookingId, 2)
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(len(self.session.exec(select(DepositCheckout)).all()), 0)

    def test_no_session_created_if_config_missing(self):
        booking, _ = self.booking()
        with patch.dict(os.environ, {"SEPAY_IPN_SECRET_KEY": ""}):
            with self.assertRaises(HTTPException) as error:
                create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(len(self.session.exec(select(DepositCheckout)).all()), 0)

    def test_signature_matches_documented_field_order(self):
        booking, _ = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(form["checkoutUrl"], "https://pay-sandbox.sepay.vn/v1/checkout/init")
        text = (f"order_amount=100000,merchant=test-merchant,currency=VND,operation=PURCHASE,"
            f"order_description=Dat coc don dat ban {booking.bookingId},order_invoice_number={form['invoiceNumber']},"
            f"customer_id=1,payment_method=BANK_TRANSFER,success_url=https://frontend.example.test/account/bookings/{booking.bookingId}?payment=success,"
            f"error_url=https://frontend.example.test/account/bookings/{booking.bookingId}?payment=error,"
            f"cancel_url=https://frontend.example.test/account/bookings/{booking.bookingId}?payment=cancel")
        expected = base64.b64encode(hmac.new(b"test-signing-secret", text.encode(), hashlib.sha256).digest()).decode()
        self.assertEqual(form["fields"]["signature"], expected)
        self.assertNotIn("test-signing-secret", str(form))

    def test_success_and_repeated_ipn_are_idempotent(self):
        booking, payment = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        data = self.payload(form)
        self.assertTrue(self.ipn(data)["success"])
        self.assertTrue(self.ipn(data)["success"])
        self.assertEqual((booking.status, payment.status), ("pending", "paid"))
        self.assertEqual(len(self.session.exec(select(DepositCheckout).where(DepositCheckout.status == "paid")).all()), 1)

    def test_ipn_uses_transaction_time_instead_of_arrival_time(self):
        booking, payment = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=31)
        checkout_status(self.session, booking.bookingId, 1)
        self.assertEqual(booking.status, "payment_expired")
        self.ipn(self.payload(form, minute=9))
        self.assertEqual((booking.status, payment.status), ("pending", "paid"))

    def test_late_payment_is_saved_for_review_and_retry_blocked(self):
        booking, payment = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=11)
        data = self.payload(form, minute=10)
        self.ipn(data)
        self.ipn(data)
        self.assertEqual(payment.status, "pending")
        self.assertTrue(checkout_status(self.session, booking.bookingId, 1)["needsReview"])
        self.assertFalse(checkout_status(self.session, booking.bookingId, 1)["canCheckout"])
        with self.assertRaises(HTTPException):
            create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(len(self.session.exec(select(Notification)).all()), 1)

    def test_wrong_amount_and_currency_never_confirm(self):
        for field, value in [("transaction_amount", "99999"), ("transaction_currency", "USD")]:
            booking, payment = self.booking()
            form = create_checkout(self.session, booking.bookingId, 1)
            data = self.payload(form, transaction_id=field)
            data["transaction"][field] = value
            self.ipn(data)
            self.assertEqual(payment.status, "pending")

    def test_wrong_ipn_secret_never_confirms(self):
        booking, payment = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        with self.assertRaises(HTTPException) as error:
            process_gateway_ipn(self.session, self.payload(form), "wrong")
        self.assertEqual(error.exception.status_code, 401)
        self.assertEqual(payment.status, "pending")

    def test_transaction_cannot_be_reused_for_another_invoice(self):
        booking, _ = self.booking()
        first = create_checkout(self.session, booking.bookingId, 1)
        self.ipn(self.payload(first))
        other, payment = self.booking()
        second = create_checkout(self.session, other.bookingId, 1)
        with self.assertRaises(HTTPException) as error:
            self.ipn(self.payload(second))
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(payment.status, "pending")

    def test_two_sessions_paid_only_credit_booking_once(self):
        booking, payment = self.booking()
        first = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=10)
        second = create_checkout(self.session, booking.bookingId, 1)
        self.ipn(self.payload(first, minute=9))
        self.ipn(self.payload(second, minute=11, transaction_id="second-tx"))
        self.assertEqual(payment.sepay_transaction_id, "tx-1")
        self.assertEqual(len(self.session.exec(select(DepositCheckout).where(DepositCheckout.status == "review")).all()), 1)

    def test_worker_expires_and_cancels_gateway_session_without_customer_request(self):
        booking, _ = self.booking()
        form = create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=10)
        maintain_checkout_sessions(self.session)
        self.cancel_mock.assert_called_once_with(form["invoiceNumber"])
        attempt = self.session.exec(select(DepositCheckout)).one()
        self.assertEqual(attempt.status, "expired")
        self.assertTrue(attempt.cancellation_synced)
        self.assertEqual(booking.status, "awaiting_payment")

    def test_failed_cancellation_is_retried(self):
        booking, _ = self.booking()
        create_checkout(self.session, booking.bookingId, 1)
        self.now += timedelta(minutes=10)
        self.cancel_mock.return_value = False
        maintain_checkout_sessions(self.session)
        self.assertFalse(self.session.exec(select(DepositCheckout)).one().cancellation_synced)
        self.cancel_mock.return_value = True
        # Retry must wait for its scheduled backoff rather than hammering SePay.
        self.now += timedelta(seconds=30)
        maintain_checkout_sessions(self.session)
        self.assertTrue(self.session.exec(select(DepositCheckout)).one().cancellation_synced)

    def test_already_paid_booking_cannot_start_new_checkout(self):
        booking, _ = self.booking(status="pending", deposit_status="paid")
        with self.assertRaises(HTTPException):
            create_checkout(self.session, booking.bookingId, 1)
        self.assertEqual(expire_unpaid_bookings(self.session, self.created + timedelta(hours=1)), 0)

    def test_gateway_http_routes_and_secret_header(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from database import get_session
        from routers.deposits import router
        from routers.deps import get_current_user
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_session] = lambda: self.session
        app.dependency_overrides[get_current_user] = lambda: User(userId=1, name="Test", email="test@example.com", phone="0", password="unused")
        # The endpoint runs in TestClient's thread; use a dedicated shareable test engine.
        from sqlalchemy.pool import StaticPool
        self.session.close()
        self.engine.dispose()
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine, tables=[Booking.__table__, DepositPayment.__table__,
            DepositCheckout.__table__, Notification.__table__, User.__table__])
        self.session = Session(self.engine)
        booking, payment = self.booking()
        client = TestClient(app)
        checkout = client.post(f"/v1/deposits/bookings/{booking.bookingId}/checkout")
        self.assertEqual(checkout.status_code, 200)
        body = self.payload(checkout.json())
        self.assertEqual(client.post("/v1/deposits/sepay/ipn", json=body).status_code, 401)
        response = client.post("/v1/deposits/sepay/ipn", json=body, headers={"X-Secret-Key": "test-ipn-secret"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        status = client.get(f"/v1/deposits/bookings/{booking.bookingId}/status")
        self.assertEqual(status.json()["depositStatus"], "paid")
        self.assertFalse(status.json()["canCheckout"])

    def test_timezone_offset_preserves_order_deadline(self):
        booking, _ = self.booking()
        booking.createdAt = self.created.astimezone(timezone(timedelta(hours=7))).isoformat()
        self.assertEqual(deposit_deadline(booking), self.created + timedelta(minutes=30))


if __name__ == "__main__":
    unittest.main()
