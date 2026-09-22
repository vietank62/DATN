"""Customer recipient collection and administrator-confirmed deposit refunds."""
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, HTTPException, Security, Response
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from sqlmodel import select
from database import SessionDep
from models import Booking, Notification, User, Restaurant
from models.depositRefund import DepositRefund
from models.depositPayment import DepositPayment
from routers.deps import get_current_user

router = APIRouter(prefix="/v1/deposits", tags=["Deposit refunds"])


class RefundRecipient(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    bank_name: str = Field(min_length=2,max_length=120)
    account_name: str = Field(min_length=2,max_length=120)
    account_number: str = Field(min_length=4,max_length=50,pattern=r"^[A-Za-z0-9]+$")
    qr_image_url: HttpUrl | None = None

    @field_validator("qr_image_url")
    @classmethod
    def valid_image(cls, value):
        if value and (value.scheme != "https" or len(str(value)) > 500):
            raise ValueError("Ảnh phải dùng liên kết HTTPS tối đa 500 ký tự")
        return value


class RefundCompletion(BaseModel):
    proof_url: HttpUrl

    @field_validator("proof_url")
    @classmethod
    def valid_proof(cls, value):
        if value.scheme != "https" or len(str(value)) > 500:
            raise ValueError("Minh chứng phải là liên kết HTTPS tối đa 500 ký tự")
        return value


def customer_refund(session, booking_id, user_id, lock=False):
    query = select(DepositRefund).where(DepositRefund.booking_id == booking_id, DepositRefund.customer_id == user_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    refund = session.exec(query).first()
    if not refund:
        raise HTTPException(404, "Không tìm thấy yêu cầu hoàn cọc của bạn")
    return refund


@router.get("/bookings/{booking_id}/refund")
def refund_details(booking_id: int, session: SessionDep, response: Response,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])]):
    response.headers["Cache-Control"] = "private, no-store"
    return customer_refund(session, booking_id, current_user.userId)


@router.put("/bookings/{booking_id}/refund/recipient")
def submit_recipient(booking_id: int, data: RefundRecipient, session: SessionDep, response: Response,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])]):
    response.headers["Cache-Control"] = "private, no-store"
    refund = customer_refund(session, booking_id, current_user.userId, lock=True)
    values = data.model_dump(mode="json")
    if refund.status == "processing" and all(getattr(refund,k) == v for k,v in values.items()):
        return refund
    if refund.status != "pending":
        raise HTTPException(409,"Thông tin hoàn cọc đã được tiếp nhận hoặc xử lý. Vui lòng kiểm tra tiến trình trên đơn.")
    for key,value in values.items():
        setattr(refund,key,value)
    refund.status = "processing"
    refund.submitted_at = datetime.now(timezone.utc).isoformat()
    session.add(refund)
    session.add(Notification(userId=current_user.userId,bookingId=booking_id,
        title="Đã tiếp nhận thông tin hoàn cọc",
        message=f"Thông tin nhận tiền cho đơn #{booking_id} đã được gửi thành công. Khoản hoàn {refund.amount:,}đ đang chờ xử lý; chúng tôi sẽ thông báo khi đã chuyển tiền.",
        type="refund_submitted",createdAt=refund.submitted_at))
    for admin in session.exec(select(User).where(User.role == "admin")).all():
        session.add(Notification(userId=admin.userId,bookingId=booking_id,title="Có yêu cầu hoàn cọc cần xử lý",
            message=f"Khách đã gửi tài khoản nhận {refund.amount:,}đ cho đơn #{booking_id}. Xem trong mục Tiền đặt cọc.",
            type="refund_ready",createdAt=refund.submitted_at))
    session.commit()
    session.refresh(refund)
    return refund


@router.get("/admin/refunds")
def admin_refunds(session: SessionDep, response: Response,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])], limit: int = 50, offset: int = 0):
    response.headers["Cache-Control"] = "private, no-store"
    rows = session.exec(select(DepositRefund,Restaurant.name).join(Booking,Booking.bookingId == DepositRefund.booking_id)
        .join(Restaurant,Restaurant.id == Booking.restaurantId).order_by(DepositRefund.id.desc())
        .offset(max(offset,0)).limit(max(1,min(limit,100)))).all()
    return [{**refund.model_dump(),"restaurant_name":name} for refund,name in rows]


@router.put("/admin/refunds/{refund_id}/complete")
def complete_refund(refund_id: int, data: RefundCompletion, session: SessionDep, response: Response,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    response.headers["Cache-Control"] = "private, no-store"
    reference = session.get(DepositRefund,refund_id)
    if not reference:
        raise HTTPException(404,"Không tìm thấy yêu cầu hoàn cọc")
    booking = session.exec(select(Booking).where(Booking.bookingId == reference.booking_id).with_for_update().execution_options(populate_existing=True)).first()
    refund = session.exec(select(DepositRefund).where(DepositRefund.id == refund_id).with_for_update().execution_options(populate_existing=True)).one()
    if refund.status == "refunded":
        return refund
    payment = session.exec(select(DepositPayment).where(DepositPayment.id == refund.deposit_payment_id).with_for_update().execution_options(populate_existing=True)).first()
    if refund.status != "processing" or not booking or not payment or payment.status != "refund_pending" or booking.depositStatus != "refund_pending":
        raise HTTPException(409,"Yêu cầu chưa đủ điều kiện xác nhận hoàn cọc")
    if payment.booking_id != refund.booking_id or payment.user_id != refund.customer_id or payment.amount != refund.amount or not all((refund.bank_name, refund.account_name, refund.account_number)):
        raise HTTPException(409,"Thông tin hoàn cọc không khớp khoản thanh toán. Cần kiểm tra lại trước khi xác nhận.")
    refund.status = "refunded"
    refund.proof_url = str(data.proof_url)
    refund.processed_by = current_user.userId
    refund.refunded_at = datetime.now(timezone.utc).isoformat()
    booking.depositStatus = "refunded"
    payment.status = "refunded"
    session.add(refund); session.add(booking); session.add(payment)
    session.add(Notification(userId=refund.customer_id,bookingId=refund.booking_id,
        title="Đã hoàn tiền đặt cọc",
        message=f"Đã chuyển hoàn {refund.amount:,}đ cho đơn #{refund.booking_id}. Bạn xem minh chứng và kiểm tra tài khoản nhận tiền nhé.",
        type="refund_completed",createdAt=refund.refunded_at))
    session.commit()
    session.refresh(refund)
    return refund
