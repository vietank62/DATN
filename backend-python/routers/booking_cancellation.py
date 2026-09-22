"""Cancellation decisions and refunds share one locked booking transaction."""
from datetime import datetime, timezone
from typing import Annotated, Literal
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from sqlmodel import select
from database import SessionDep
from models import Booking, Restaurant, User, Notification
from models.depositPayment import DepositPayment
from models.depositRefund import DepositRefund
from core.deposit_checkout import lock_booking, expire_checkout_rows
from core.booking_policy import CUSTOMER_CANCEL_LEAD
from routers.deps import get_current_user
from routers.booking import _serialize_booking, _ensure_restaurant_access, get_booking_meal_time, APP_TIME_ZONE

router = APIRouter(prefix="/v1/bookings", tags=["Booking cancellation"])

class CancellationInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    reason: str = Field(min_length=3, max_length=2000)
    source: Literal["restaurant", "customer"] = "restaurant"
    evidence_url: HttpUrl | None = None
    contacted_customer: bool = False

class CancellationDecision(BaseModel):
    approved: bool
    reason: str = Field(min_length=3, max_length=2000)

def notify(session, booking, user_id, message, kind="booking_cancelled"):
    session.add(Notification(userId=user_id, bookingId=booking.bookingId,
        title="Cập nhật đơn đặt bàn", message=message, type=kind,
        createdAt=datetime.now(timezone.utc).isoformat()))

def refund_deposit(session, booking):
    payment = session.exec(select(DepositPayment).where(DepositPayment.booking_id == booking.bookingId)
        .with_for_update().execution_options(populate_existing=True)).first()
    if not payment or payment.status != "paid" or booking.depositStatus == "forfeited":
        return
    payment.status = booking.depositStatus = "refund_pending"
    session.add(payment)
    if not session.exec(select(DepositRefund).where(DepositRefund.booking_id == booking.bookingId)).first():
        session.add(DepositRefund(booking_id=booking.bookingId, deposit_payment_id=payment.id,
            customer_id=booking.userId, amount=payment.amount, created_at=datetime.now(timezone.utc).isoformat()))
    notify(session, booking, booking.userId, "Bạn được hoàn tiền đặt cọc. Vui lòng mở đơn và cung cấp thông tin tài khoản nhận tiền.", "refund_required")

def finish_cancel(session, booking, reason, actor, evidence=None, failed=False):
    booking.status = "rejected" if failed else "cancelled"
    booking.cancellationStatus = "approved"
    booking.cancellationReason = reason
    booking.cancellationActor = actor
    booking.cancellationEvidence = str(evidence) if evidence else None
    refund_deposit(session, booking)
    if booking.depositStatus == "pending":
        payment = session.exec(select(DepositPayment).where(DepositPayment.booking_id == booking.bookingId).with_for_update()).first()
        if payment:
            payment.status = "cancelled"
            session.add(payment)
        booking.depositStatus = "cancelled"
    expire_checkout_rows(session, booking, datetime.now(timezone.utc))
    session.add(booking)
    notify(session, booking, booking.userId, f"Đơn đã được huỷ. Lý do: {reason}")

def get_owned_booking(session, booking_id, user):
    booking = lock_booking(session, booking_id)
    if not booking or booking.userId != user.userId:
        raise HTTPException(404, "Không tìm thấy đơn đặt bàn")
    return booking

@router.put("/{booking_id}/customer-cancel")
def customer_cancel(booking_id: int, data: CancellationInput, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])]):
    booking = get_owned_booking(session, booking_id, current_user)
    if booking.status not in {"pending", "awaiting_payment", "confirmed"}:
        raise HTTPException(409, "Đơn không còn có thể huỷ")
    restaurant = session.get(Restaurant, booking.restaurantId)
    if booking.status == "confirmed":
        meal = get_booking_meal_time(booking)
        if not meal or meal - datetime.now(APP_TIME_ZONE) < CUSTOMER_CANCEL_LEAD:
            raise HTTPException(409, "Còn dưới 1 giờ: vui lòng nhắn tin hoặc gọi hotline nhà hàng để yêu cầu huỷ")
        if booking.cancellationStatus == "requested":
            raise HTTPException(409, "Yêu cầu huỷ đang chờ nhà hàng xử lý")
        booking.cancellationStatus = "requested"
        booking.cancellationReason = data.reason
        booking.cancellationActor = "customer"
        session.add(booking)
    else:
        finish_cancel(session, booking, data.reason, "customer")
    if restaurant and restaurant.manager_id:
        notify(session, booking, restaurant.manager_id, f"Khách hàng yêu cầu huỷ đơn #{booking.bookingId}: {data.reason}", "cancellation_request")
    session.commit()
    return _serialize_booking(session, booking)

@router.put("/{booking_id}/cancellation-decision")
def cancellation_decision(booking_id: int, data: CancellationDecision, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = lock_booking(session, booking_id)
    if not booking:
        raise HTTPException(404, "Không tìm thấy đơn")
    _ensure_restaurant_access(session.get(Restaurant, booking.restaurantId), current_user)
    if booking.status != "confirmed" or booking.cancellationStatus != "requested":
        raise HTTPException(409, "Không có yêu cầu huỷ đang chờ xử lý")
    if data.approved:
        finish_cancel(session, booking, data.reason, "customer")
    else:
        booking.cancellationStatus = "rejected"
        booking.cancellationReason = data.reason
        session.add(booking)
        notify(session, booking, booking.userId, f"Nhà hàng từ chối yêu cầu huỷ; đơn vẫn đã xác nhận, cọc được giữ lại. Lý do: {data.reason}")
    session.commit()
    return _serialize_booking(session, booking)

@router.put("/{booking_id}/cancel")
def restaurant_cancel(booking_id: int, data: CancellationInput, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = lock_booking(session, booking_id)
    if not booking:
        raise HTTPException(404, "Không tìm thấy đơn")
    _ensure_restaurant_access(session.get(Restaurant, booking.restaurantId), current_user)
    if booking.status not in {"pending", "awaiting_payment", "confirmed"}:
        raise HTTPException(409, "Đơn không còn có thể huỷ")
    if data.source == "restaurant" and booking.status == "confirmed":
        if not data.contacted_customer or not data.evidence_url:
            raise HTTPException(422, "Nhà hàng phải liên hệ khách và đính kèm ảnh minh chứng khi huỷ bàn đã xác nhận")
    finish_cancel(session, booking, data.reason, data.source, data.evidence_url,
        failed=booking.status == "pending" and data.source == "restaurant")
    session.commit()
    return _serialize_booking(session, booking)
