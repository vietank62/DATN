"""Offline regression suite: never connects to the configured production database."""
import os
os.environ["URL_DATABASE"] = "postgresql://test:test@localhost/test"
os.environ["UPSTASH_REDIS_REST_URL"] = "https://example.invalid"
os.environ["UPSTASH_REDIS_REST_TOKEN"] = "test"
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi import HTTPException, BackgroundTasks
from sqlalchemy import ARRAY, JSON
from sqlmodel import SQLModel, Session, create_engine, select
from models import Booking, Restaurant, User, Review, Notification, Payment
from models.depositPayment import DepositPayment
from models.depositRefund import DepositRefund
from models.bookingFee import BookingFee
from models.violationReport import ViolationReport
from routers.booking import _serialize_booking, auto_complete_expired_confirmed_bookings, expire_unanswered_bookings, confirm_booking, complete_booking, create_booking, APP_TIME_ZONE
from routers.booking_cancellation import customer_cancel, restaurant_cancel, cancellation_decision, CancellationInput, CancellationDecision
from routers.violationReport import get_my_reports, report_customer, report_restaurant
from schemas.violationReport import ViolationReportCreate
from routers.review import create_review
from schemas.reviewMenuSchema import ReviewCreate
from schemas.bookingSchema import BookingCreate
from core.booking_fees import settle_restaurant_fees
from core.deposit_expiry import expire_unpaid_bookings, deposit_deadline
from core.deposit_checkout import create_checkout
from routers.booking_fees import create_fee_checkout, process_fee_payment_ipn
from routers.deposits import gateway_ipn
from models.depositCheckout import DepositCheckout

# SQLite storage equivalents for PostgreSQL array columns in this isolated test process.
for table in SQLModel.metadata.tables.values():
    for column in table.columns:
        if isinstance(column.type, ARRAY):
            column.type = JSON()

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.customer = User(name="Guest", email="guest@test.com", phone="0900000000", password="x")
        self.manager = User(name="Manager", email="manager@test.com", phone="0900000001", password="x", role="manager")
        self.session.add_all([self.customer, self.manager]); self.session.flush()
        self.restaurant = Restaurant(name="Test", slug="test", address="Test", district="Test", manager_id=self.manager.userId,
                                     is_active=True, approval_status="approved", booking_lead_minutes=180, booking_confirmation_minutes=120)
        self.session.add(self.restaurant); self.session.commit()
        # SQLite cannot execute PostgreSQL interval expressions. Keep the real
        # state transitions/refund writes, replacing only the candidate prefilter.
        original_exec = self.session.exec
        def sqlite_exec(statement, *args, **kwargs):
            if "make_interval" in str(statement):
                return original_exec(select(Booking).where(Booking.status == "pending"))
            return original_exec(statement, *args, **kwargs)
        interval_patch = patch.object(self.session, "exec", side_effect=sqlite_exec)
        interval_patch.start()
        self.addCleanup(interval_patch.stop)
    def tearDown(self):
        self.session.close(); self.engine.dispose()
    def booking(self, status="pending", hours=5, deposit=False):
        meal = datetime.now(APP_TIME_ZONE) + timedelta(hours=hours)
        row = Booking(userId=self.customer.userId, restaurantId=self.restaurant.id, date=meal.strftime("%Y-%m-%d"), time=meal.strftime("%H:%M"), guestCount=2, requestSeats=2, status=status, contactName="Guest", contactEmail="guest@test.com", contactPhone="0900000000", createdAt=datetime.now(timezone.utc).isoformat(), depositAmount=100000 if deposit else 0, depositStatus="paid" if deposit else "not_required")
        self.session.add(row); self.session.flush()
        if deposit:
            self.session.add(DepositPayment(booking_id=row.bookingId, restaurant_id=self.restaurant.id, user_id=self.customer.userId, amount=100000, status="paid", transaction_code=f"TNBK{row.bookingId}", created_at=row.createdAt))
        self.session.commit(); return row
    def test_manager_can_pay_all_outstanding_service_fees_by_qr(self):
        os.environ["SEPAY_MERCHANT_ID"] = "test-merchant"
        os.environ["SEPAY_SECRET_KEY"] = "test-secret"
        os.environ["SEPAY_IPN_SECRET_KEY"] = "test-ipn-secret"
        os.environ["SEPAY_ENV"] = "sandbox"
        os.environ["FRONTEND_URL"] = "http://localhost:5173"
        booking = self.booking("completed")
        fee = BookingFee(
            booking_id=booking.bookingId,
            restaurant_id=self.restaurant.id,
            amount=6000,
            due_at=datetime.now(timezone.utc).isoformat(),
        )
        self.session.add(fee)
        self.session.commit()

        checkout = create_fee_checkout(self.session, self.manager)
        self.assertEqual(checkout["amount"], 6000)
        self.assertTrue(checkout["invoiceNumber"].startswith("TNFEE"))
        payment = self.session.get(Payment, checkout["paymentId"])
        self.assertIsNotNone(payment)

        result = process_fee_payment_ipn({
            "notification_type": "ORDER_PAID",
            "order": {
                "order_invoice_number": checkout["invoiceNumber"],
                "order_amount": "6000",
                "order_status": "CAPTURED",
                "order_currency": "VND",
            },
            "transaction": {
                "id": "fee-payment-test-1",
                "transaction_amount": "6000",
                "transaction_status": "APPROVED",
                "transaction_type": "PAYMENT",
                "transaction_currency": "VND",
            },
        }, self.session, "test-ipn-secret")
        self.assertTrue(result["success"])
        self.session.refresh(fee)
        self.session.refresh(payment)
        self.assertEqual(fee.settled_amount, 6000)
        self.assertEqual(payment.status, "completed")
    def test_create_booking_succeeds_when_capacity_is_available(self):
        meal = datetime.now(APP_TIME_ZONE) + timedelta(hours=4)
        self.restaurant.capacity = 10
        self.session.add(self.restaurant)
        self.session.commit()

        created = create_booking(
            BackgroundTasks(),
            BookingCreate(
                restaurantId=self.restaurant.id,
                date=meal.strftime("%Y-%m-%d"),
                time=meal.strftime("%H:%M"),
                guestCount=2,
                childCount=0,
                requestSeats=2,
                contactName="Guest",
                contactEmail="guest@test.com",
                contactPhone="0900000000",
            ),
            self.customer,
            self.session,
        )

        self.assertEqual(created.status, "pending")
        self.assertEqual(created.requestSeats, 2)
    def test_completion_waits_seven_days(self):
        early=self.booking("confirmed",hours=-6*24); due=self.booking("confirmed",hours=-7*24-1)
        early.attendance = "no_show"; due.attendance = "no_show"
        self.session.add_all([early, due]); self.session.commit()
        self.assertEqual(auto_complete_expired_confirmed_bookings(self.session),1)
        self.session.refresh(early); self.session.refresh(due)
        self.assertEqual(early.status,"confirmed"); self.assertEqual(due.status,"completed")
    def test_expiry_two_hours_and_no_duplicate_refund(self):
        row=self.booking(hours=1,deposit=True)
        self.assertEqual(expire_unanswered_bookings(self.session),1)
        self.assertEqual(expire_unanswered_bookings(self.session),0)
        self.session.refresh(row)
        self.assertEqual(row.status,"expired"); self.assertEqual(row.depositStatus,"refund_pending"); self.assertEqual(row.cancellationActor,"system")
        self.assertEqual(len(self.session.exec(select(DepositRefund)).all()),1)
    def test_late_confirmation_blocked(self):
        row=self.booking(hours=1)
        with self.assertRaises(HTTPException): confirm_booking(BackgroundTasks(),row.bookingId,self.manager,self.session)
        self.session.refresh(row); self.assertEqual(row.status,"expired")
    def test_pending_customer_cancellation_refunds(self):
        row=self.booking(deposit=True)
        customer_cancel(row.bookingId,CancellationInput(reason="Thay đổi lịch"),self.session,self.customer)
        self.assertEqual(row.status,"cancelled"); self.assertEqual(row.depositStatus,"refund_pending")
    def test_confirmed_request_rejection_keeps_booking(self):
        row=self.booking("confirmed",hours=.5,deposit=True)
        customer_cancel(row.bookingId,CancellationInput(reason="Thay đổi lịch"),self.session,self.customer)
        self.assertEqual(row.status,"confirmed")
        cancellation_decision(row.bookingId,CancellationDecision(approved=False,reason="Đã chuẩn bị"),self.session,self.manager)
        self.assertEqual(row.status,"confirmed"); self.assertEqual(row.depositStatus,"paid")
    def test_confirmed_request_acceptance_refunds(self):
        row=self.booking("confirmed",hours=.5,deposit=True)
        customer_cancel(row.bookingId,CancellationInput(reason="Thay đổi lịch"),self.session,self.customer)
        cancellation_decision(row.bookingId,CancellationDecision(approved=True,reason="Đồng ý huỷ"),self.session,self.manager)
        self.assertEqual(row.status,"cancelled"); self.assertEqual(row.depositStatus,"refund_pending")
    def test_near_meal_confirmed_customer_requests_restaurant_decision(self):
        row=self.booking("confirmed",hours=.5)
        customer_cancel(row.bookingId,CancellationInput(reason="Thay đổi lịch"),self.session,self.customer)
        self.assertEqual(row.status, "confirmed")
        self.assertEqual(row.cancellationStatus, "requested")
    def test_near_meal_unconfirmed_customer_can_cancel(self):
        row=self.booking("pending",hours=.5)
        customer_cancel(row.bookingId,CancellationInput(reason="Thay đổi lịch"),self.session,self.customer)
        self.assertEqual(row.status, "cancelled")
    def test_restaurant_must_provide_evidence(self):
        row=self.booking("confirmed")
        with self.assertRaises(HTTPException): restaurant_cancel(row.bookingId,CancellationInput(reason="Nhà hàng có sự cố"),self.session,self.manager)
        restaurant_cancel(row.bookingId,CancellationInput(reason="Nhà hàng có sự cố",contacted_customer=True,evidence_url="https://example.com/proof.jpg"),self.session,self.manager)
        self.assertEqual(row.status,"cancelled")
    def test_restaurant_cannot_cancel_confirmed_booking_after_meal_time(self):
        row=self.booking("confirmed", hours=-0.1)
        with self.assertRaises(HTTPException):
            restaurant_cancel(row.bookingId, CancellationInput(reason="Nhà hàng có sự cố", contacted_customer=True, evidence_url="https://example.com/proof.jpg"), self.session, self.manager)
        self.session.refresh(row)
        self.assertEqual(row.status, "confirmed")

    def test_completed_booking_cannot_be_cancelled(self):
        row=self.booking("completed")
        with self.assertRaises(HTTPException): restaurant_cancel(row.bookingId,CancellationInput(reason="Không hợp lệ"),self.session,self.manager)
    def test_restaurant_report_expires_after_seven_days(self):
        row = self.booking("completed", hours=-8 * 24)
        with self.assertRaises(HTTPException):
            report_restaurant(ViolationReportCreate(booking_id=row.bookingId, reason="Nhà hàng không giữ bàn"), self.customer, self.session)

    def test_customer_report_expires_after_seven_days(self):
        row = self.booking("completed", hours=-8 * 24)
        with self.assertRaises(HTTPException):
            report_customer(ViolationReportCreate(booking_id=row.bookingId, reason="Khách không đến dùng bữa đúng giờ"), self.manager, self.session)

    def test_manager_can_track_submitted_customer_report(self):
        row = self.booking("completed", hours=-1)
        report = report_customer(
            ViolationReportCreate(booking_id=row.bookingId, reason="Khách không đến đúng giờ như đã xác nhận"),
            self.manager,
            self.session,
        )
        reports = get_my_reports(self.manager, self.session)
        self.assertIn(report.id, [item.id for item in reports])

    def test_customer_can_track_submitted_restaurant_report(self):
        row = self.booking("completed", hours=-1)
        report = report_restaurant(
            ViolationReportCreate(booking_id=row.bookingId, reason="Nhà hàng không giữ bàn đúng như đã xác nhận"),
            self.customer,
            self.session,
        )
        reports = get_my_reports(self.customer, self.session)
        self.assertIn(report.id, [item.id for item in reports])
        self.assertEqual(_serialize_booking(self.session, row).restaurantReportStatus, "open")

    def test_review_is_once_per_booking(self):
        first=self.booking("completed",hours=-1); second=self.booking("completed",hours=-2)
        for row in (first,second):
            create_review(ReviewCreate(bookingId=row.bookingId,userId=self.customer.userId,restaurantId=self.restaurant.id,rating=5),self.session,BackgroundTasks(),self.customer)
        with self.assertRaises(HTTPException): create_review(ReviewCreate(bookingId=first.bookingId,userId=self.customer.userId,restaurantId=self.restaurant.id,rating=5),self.session,BackgroundTasks(),self.customer)
        self.assertEqual(len(self.session.exec(select(Review)).all()),2)
    def test_four_reports_suspend_and_forfeit_deposit(self):
        for i in range(4):
            row=self.booking("confirmed",hours=-1,deposit=True)
            report_customer(ViolationReportCreate(booking_id=row.bookingId,reason="Khách không đến dùng bữa"),self.manager,self.session)
            self.assertEqual(self.customer.is_suspended, i == 3)
            self.assertEqual(row.depositStatus,"forfeited")
    def test_last_month_reports_do_not_count(self):
        old=self.booking("confirmed",hours=-40*24)
        self.session.add(ViolationReport(booking_id=old.bookingId,reporter_id=self.manager.userId,target_user_id=self.customer.userId,target_type="customer",reason="Old",created_at=datetime.now(timezone.utc)-timedelta(days=40)))
        self.session.commit()
        row=self.booking("confirmed",hours=-1)
        report_customer(ViolationReportCreate(booking_id=row.bookingId,reason="Vi phạm thỏa thuận"),self.manager,self.session)
        self.assertEqual(self.customer.report_strikes,1)
    def test_monthly_fee_deduction_is_idempotent(self):
        row=self.booking("completed",hours=-40*24,deposit=True)
        settle_restaurant_fees(self.session,self.restaurant); self.session.commit()
        settle_restaurant_fees(self.session,self.restaurant); self.session.commit()
        fees=self.session.exec(select(BookingFee)).all()
        self.assertEqual(len(fees),1); self.assertEqual(fees[0].deducted_amount,6000)
        self.assertEqual(len(self.session.exec(select(Notification).where(Notification.type=="booking_fee")).all()),1)
    def test_payment_expires_after_thirty_minutes(self):
        row=self.booking("awaiting_payment",deposit=True); row.depositStatus="pending"; row.createdAt=(datetime.now(timezone.utc)-timedelta(minutes=31)).isoformat()
        payment=self.session.exec(select(DepositPayment)).one(); payment.status="pending"; self.session.add(payment); self.session.add(row); self.session.commit()
        self.assertEqual(expire_unpaid_bookings(self.session),1); self.assertEqual(row.status,"payment_expired"); self.assertEqual(row.cancellationActor,"system")
    def test_qr_lifetime_is_remaining_deadline(self):
        row=self.booking("awaiting_payment",deposit=True); row.depositStatus="pending"; row.createdAt=(datetime.now(timezone.utc)-timedelta(minutes=25)).isoformat(); self.session.add(row); self.session.commit()
        with patch("core.deposit_checkout.gateway_config"), patch("core.deposit_checkout.checkout_form",return_value={}):
            create_checkout(self.session,row.bookingId,self.customer.userId)
        attempt=self.session.exec(select(DepositCheckout)).one()
        self.assertEqual(datetime.fromisoformat(attempt.expires_at),deposit_deadline(row))

if __name__ == "__main__": unittest.main()
