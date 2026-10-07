"""Service-fee reporting and QR payment for restaurant managers."""
import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Security, Header
from pydantic import BaseModel, HttpUrl
from sqlalchemy import func, or_
from sqlmodel import select

from database import SessionDep
from models import Booking, Notification, Payment, Restaurant, User
from models.bookingFee import BookingFee
from models.depositPayment import DepositPayment
from routers.deps import get_current_user
from core.admin_notifications import notify_admins
from core.booking_fees import settle_restaurant_fees
from core.booking_policy import APP_TIME_ZONE
from core.sepay_gateway import SIGNED_FIELDS, gateway_config

router = APIRouter(prefix="/v1/booking-fees", tags=["Booking fees"])
FEE_PAYMENT_TTL = timedelta(minutes=10)


class FeeReceipt(BaseModel):
    proof_url: HttpUrl


def _manager_restaurant(session, user: User) -> Restaurant:
    restaurant = session.exec(
        select(Restaurant).where(Restaurant.manager_id == user.userId).with_for_update()
    ).first()
    if not restaurant:
        raise HTTPException(404, "Tài khoản chưa liên kết nhà hàng")
    return restaurant


def _fee_ids(payment: Payment) -> list[int]:
    encoded = payment.bookingIds or ""
    if not encoded.startswith("fees:"):
        return []
    try:
        return [int(value) for value in encoded.removeprefix("fees:").split(",") if value]
    except ValueError:
        return []


def _payment_expired(payment: Payment, now: datetime) -> bool:
    try:
        return now >= datetime.fromisoformat(payment.createdAt) + FEE_PAYMENT_TTL
    except (TypeError, ValueError):
        return True


def _fee_checkout_form(payment: Payment) -> dict:
    config = gateway_config()
    callback = f"{config['frontend']}/manager/finance?feePayment={payment.paymentId}"
    values = {
        "order_amount": str(int(payment.amount)),
        "merchant": config["merchant"],
        "currency": "VND",
        "operation": "PURCHASE",
        "order_description": f"Thanh toan phi dich vu {payment.transactionCode}",
        "order_invoice_number": payment.transactionCode,
        "customer_id": str(payment.restaurantId),
        "payment_method": "BANK_TRANSFER",
        "success_url": callback,
        "error_url": callback,
        "cancel_url": callback,
    }
    fields = {key: values[key] for key in SIGNED_FIELDS}
    payload = ",".join(f"{key}={value}" for key, value in fields.items())
    fields["signature"] = base64.b64encode(
        hmac.new(config["secret"].encode(), payload.encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "checkoutUrl": config["checkout"],
        "fields": fields,
        "paymentId": payment.paymentId,
        "amount": int(payment.amount),
        "invoiceNumber": payment.transactionCode,
        "expiresAt": (datetime.fromisoformat(payment.createdAt) + FEE_PAYMENT_TTL).isoformat(),
    }


@router.get("/summary")
def fee_summary(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    query = select(Restaurant)
    if current_user.role != "admin":
        query = query.where(Restaurant.manager_id == current_user.userId)
    restaurants = session.exec(query).all()
    restaurant_ids = [restaurant.id for restaurant in restaurants if restaurant.id is not None]
    if not restaurant_ids:
        return {"month": datetime.now(APP_TIME_ZONE).strftime("%m/%Y"), "completedBookingsThisMonth": 0, "pendingBookings": 0, "depositBookingCount": 0, "heldDepositAmount": 0, "feesTotal": 0, "feesOutstanding": 0, "feesDeducted": 0, "feesDirectPaid": 0}

    month_start = datetime.now(APP_TIME_ZONE).replace(day=1).strftime("%Y-%m-%d")
    completed_bookings = session.exec(select(func.count(Booking.bookingId)).where(Booking.restaurantId.in_(restaurant_ids), Booking.status == "completed", Booking.date >= month_start)).one()
    pending_bookings = session.exec(select(func.count(Booking.bookingId)).where(Booking.restaurantId.in_(restaurant_ids), Booking.status == "pending")).one()
    deposit_bookings, held_deposit_amount = session.exec(select(func.count(DepositPayment.id), func.coalesce(func.sum(DepositPayment.amount), 0)).join(Booking, Booking.bookingId == DepositPayment.booking_id).where(DepositPayment.restaurant_id.in_(restaurant_ids), DepositPayment.status == "paid", or_(Booking.status.in_(["confirmed", "completed"]), Booking.depositStatus == "forfeited"))).one()
    fees_total, fees_settled, fees_deducted = session.exec(select(func.coalesce(func.sum(BookingFee.amount), 0), func.coalesce(func.sum(BookingFee.settled_amount), 0), func.coalesce(func.sum(BookingFee.deducted_amount), 0)).where(BookingFee.restaurant_id.in_(restaurant_ids))).one()
    fees_total, fees_settled, fees_deducted = int(fees_total or 0), int(fees_settled or 0), int(fees_deducted or 0)
    return {"month": datetime.now(APP_TIME_ZONE).strftime("%m/%Y"), "completedBookingsThisMonth": int(completed_bookings or 0), "pendingBookings": int(pending_bookings or 0), "depositBookingCount": int(deposit_bookings or 0), "heldDepositAmount": int(held_deposit_amount or 0), "feesTotal": fees_total, "feesOutstanding": max(0, fees_total - fees_settled), "feesDeducted": fees_deducted, "feesDirectPaid": max(0, fees_settled - fees_deducted)}


@router.get("")
def list_fees(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    query = select(Restaurant)
    if current_user.role != "admin":
        query = query.where(Restaurant.manager_id == current_user.userId)
    restaurants = session.exec(query.with_for_update()).all()
    for restaurant in restaurants:
        settle_restaurant_fees(session, restaurant)
    session.commit()
    restaurant_names = {restaurant.id: restaurant.name for restaurant in restaurants}
    rows = session.exec(
        select(BookingFee, Booking)
        .join(Booking, Booking.bookingId == BookingFee.booking_id)
        .where(BookingFee.restaurant_id.in_(restaurant_names))
        .order_by(BookingFee.id.desc())
    ).all()
    return [
        {
            **fee.model_dump(),
            "restaurantName": restaurant_names.get(fee.restaurant_id, "Nhà hàng không còn hoạt động"),
            "bookingDate": booking.date,
            "bookingTime": booking.time,
            "bookingStatus": booking.status,
            "guestCount": booking.guestCount,
            "customerName": booking.contactName,
            "customerPhone": booking.contactPhone,
            "depositAmount": booking.depositAmount,
        }
        for fee, booking in rows
    ]


@router.post("/payment/checkout")
def create_fee_checkout(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    gateway_config()
    restaurant = _manager_restaurant(session, current_user)
    settle_restaurant_fees(session, restaurant)
    session.flush()
    fees = session.exec(select(BookingFee).where(BookingFee.restaurant_id == restaurant.id, BookingFee.settled_amount < BookingFee.amount).order_by(BookingFee.due_at, BookingFee.id).with_for_update()).all()
    amount = sum(max(0, fee.amount - fee.settled_amount) for fee in fees)
    if not fees or amount <= 0:
        raise HTTPException(409, "Nhà hàng không còn khoản phí dịch vụ cần thanh toán.")

    now = datetime.now(timezone.utc)
    existing = session.exec(select(Payment).where(Payment.restaurantId == restaurant.id, Payment.status == "pending").order_by(Payment.paymentId.desc()).with_for_update()).all()
    for payment in existing:
        if _payment_expired(payment, now):
            payment.status = "expired"
        else:
            payment.status = "cancelled"
        session.add(payment)

    payment = Payment(
        restaurantId=restaurant.id,
        amount=float(amount),
        transactionCode=f"TNFEE-PENDING-{uuid4().hex[:16]}",
        status="pending",
        createdAt=now.isoformat(),
        bookingIds="fees:" + ",".join(str(fee.id) for fee in fees),
    )
    session.add(payment)
    session.flush()
    payment.transactionCode = f"TNFEE{payment.paymentId}"
    session.add(payment)
    form = _fee_checkout_form(payment)
    session.commit()
    return form


@router.get("/payment/{payment_id}/status")
def fee_payment_status(payment_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    payment = session.get(Payment, payment_id)
    restaurant = _manager_restaurant(session, current_user)
    if not payment or payment.restaurantId != restaurant.id:
        raise HTTPException(404, "Không tìm thấy phiên thanh toán phí dịch vụ")
    if payment.status == "pending" and _payment_expired(payment, datetime.now(timezone.utc)):
        payment.status = "expired"
        session.add(payment)
        session.commit()
    return {"paymentId": payment.paymentId, "status": payment.status, "amount": int(payment.amount), "invoiceNumber": payment.transactionCode, "expiresAt": (datetime.fromisoformat(payment.createdAt) + FEE_PAYMENT_TTL).isoformat(), "paidAt": payment.paidAt}


@router.post("/payment/sepay/ipn")
def process_fee_payment_ipn(payload: dict, session: SessionDep, x_secret_key: Annotated[str | None, Header()] = None):
    expected = os.getenv("SEPAY_IPN_SECRET_KEY", "").strip()
    if not expected or not hmac.compare_digest(expected.encode(), (x_secret_key or "").encode()):
        raise HTTPException(401, "IPN không hợp lệ")
    if payload.get("notification_type") != "ORDER_PAID":
        return {"success": True, "message": "Ignored notification"}
    order, transaction = payload.get("order"), payload.get("transaction")
    if not isinstance(order, dict) or not isinstance(transaction, dict):
        raise HTTPException(422, "Thiếu dữ liệu giao dịch")
    invoice = order.get("order_invoice_number")
    transaction_id = transaction.get("id")
    if not isinstance(invoice, str) or not invoice.startswith("TNFEE") or not isinstance(transaction_id, str):
        raise HTTPException(404, "Không tìm thấy phiên thanh toán phí")
    payment = session.exec(select(Payment).where(Payment.transactionCode == invoice).with_for_update()).first()
    if not payment:
        raise HTTPException(404, "Không tìm thấy phiên thanh toán phí")
    if payment.status == "completed":
        return {"success": True, "message": "Already processed"}
    try:
        amount = Decimal(str(transaction["transaction_amount"]))
        order_amount = Decimal(str(order["order_amount"]))
    except (KeyError, InvalidOperation):
        raise HTTPException(422, "Số tiền giao dịch không hợp lệ")
    if order.get("order_status") != "CAPTURED" or transaction.get("transaction_status") != "APPROVED" or transaction.get("transaction_type") != "PAYMENT" or order.get("order_currency") != "VND" or transaction.get("transaction_currency") != "VND" or amount != Decimal(str(payment.amount)) or order_amount != Decimal(str(payment.amount)) or _payment_expired(payment, datetime.now(timezone.utc)):
        payment.status = "review"
        session.add(payment)
        session.commit()
        return {"success": True, "message": "Payment requires review"}
    existing = session.exec(select(Payment).where(Payment.sepayTransactionId == transaction_id)).first()
    if existing and existing.paymentId != payment.paymentId:
        raise HTTPException(409, "Mã giao dịch đã được sử dụng")
    fees = session.exec(select(BookingFee).where(BookingFee.id.in_(_fee_ids(payment)), BookingFee.restaurant_id == payment.restaurantId).with_for_update()).all()
    remaining = int(payment.amount)
    for fee in fees:
        outstanding = max(0, fee.amount - fee.settled_amount)
        settled = min(outstanding, remaining)
        fee.settled_amount += settled
        remaining -= settled
        session.add(fee)
    if remaining:
        raise HTTPException(409, "Khoản phí thanh toán không còn khớp dữ liệu hiện tại")
    payment.status = "completed"
    payment.paidAt = datetime.now(timezone.utc).isoformat()
    payment.sepayTransactionId = transaction_id
    session.add(payment)
    restaurant = session.get(Restaurant, payment.restaurantId)
    if restaurant and restaurant.manager_id:
        session.add(Notification(userId=restaurant.manager_id, title="Đã thanh toán phí dịch vụ", message=f"Đã ghi nhận thanh toán {int(payment.amount):,}đ cho các khoản phí dịch vụ.", type="fee_payment_completed", createdAt=payment.paidAt))
    notify_admins(session, title="Nhà hàng đã thanh toán phí dịch vụ", message=f"{restaurant.name if restaurant else 'Nhà hàng'} đã thanh toán {int(payment.amount):,}đ phí dịch vụ.", notification_type="fee_payment_completed")
    session.commit()
    return {"success": True, "message": "Service fee payment processed", "paymentId": payment.paymentId}


@router.put("/{fee_id}/paid")
def record_payment(fee_id: int, data: FeeReceipt, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    reference = session.get(BookingFee, fee_id)
    if not reference:
        raise HTTPException(404, "Không tìm thấy phí đặt bàn")
    session.exec(select(Restaurant).where(Restaurant.id == reference.restaurant_id).with_for_update()).one()
    fee = session.exec(select(BookingFee).where(BookingFee.id == fee_id).with_for_update().execution_options(populate_existing=True)).one()
    if fee.settled_amount >= fee.amount:
        raise HTTPException(409, "Khoản phí đã được thanh toán")
    fee.settled_amount = fee.amount
    fee.proof_url = str(data.proof_url)
    session.add(fee)
    session.commit()
    return fee
