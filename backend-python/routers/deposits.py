"""Customer booking deposits and restaurant withdrawal workflow."""

from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Security, Header
from pydantic import BaseModel, Field
from sqlalchemy import func  # type: ignore
from sqlmodel import select  # type: ignore

from database import SessionDep
from models import Booking, Notification, Restaurant, User
from models.depositPayment import DepositPayment
from models.withdrawalRequest import WithdrawalRequest
from routers.deps import get_current_user
from core.deposit_checkout import checkout_status, create_checkout, process_gateway_ipn
from models.depositCheckout import DepositCheckout


router = APIRouter(prefix="/v1/deposits", tags=["Booking deposits & withdrawals"])


class WithdrawalCreate(BaseModel):
    amount: int = Field(gt=0)
    bank_name: str = Field(default="", max_length=120)
    account_name: str = Field(default="", max_length=120)
    account_number: str = Field(default="", max_length=50)
    qr_image_url: Optional[str] = Field(default=None, max_length=500)


class WithdrawalDecision(BaseModel):
    transfer_proof_url: Optional[str] = Field(default=None, max_length=500)
    admin_note: Optional[str] = Field(default=None, max_length=1000)


def _manager_restaurant(session, user: User) -> Restaurant:
    restaurant = session.exec(select(Restaurant).where(Restaurant.manager_id == user.userId)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Tài khoản chưa liên kết nhà hàng")
    return restaurant


def _withdrawal_balance(session, restaurant_id: int) -> dict[str, int]:
    """Return withdrawal totals with one aggregate query instead of loading rows."""
    paid_deposit_stats = (
        select(
            func.coalesce(func.sum(DepositPayment.amount), 0).label("total_deposit"),
            func.count(DepositPayment.id).label("completed_bookings"),
        )
        .join(Booking, DepositPayment.booking_id == Booking.bookingId)
        .where(
            DepositPayment.restaurant_id == restaurant_id,
            DepositPayment.status == "paid",
            Booking.status == "completed",
        )
        .subquery()
    )
    withdrawal_stats = (
        select(
            func.coalesce(
                func.sum(WithdrawalRequest.amount).filter(
                    WithdrawalRequest.status.in_({"pending", "paid"})
                ),
                0,
            ).label("reserved_withdrawal"),
            func.coalesce(
                func.sum(WithdrawalRequest.amount).filter(
                    WithdrawalRequest.status == "paid"
                ),
                0,
            ).label("paid_out"),
        )
        .where(WithdrawalRequest.restaurant_id == restaurant_id)
        .subquery()
    )
    (
        total_deposit,
        completed_bookings,
        reserved_withdrawal,
        paid_out,
    ) = session.exec(
        select(
            paid_deposit_stats.c.total_deposit,
            paid_deposit_stats.c.completed_bookings,
            withdrawal_stats.c.reserved_withdrawal,
            withdrawal_stats.c.paid_out,
        )
    ).one()

    total_deposit = int(total_deposit or 0)
    reserved_withdrawal = int(reserved_withdrawal or 0)
    paid_out = int(paid_out or 0)

    return {
        "totalDeposit": total_deposit,
        "reservedWithdrawal": reserved_withdrawal,
        "paidOut": paid_out,
        "availableBalance": max(0, total_deposit - reserved_withdrawal),
        "completedBookings": int(completed_bookings or 0),
    }

@router.get("/bookings/{booking_id}/status")
def get_deposit_status(
    booking_id: int, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
):
    return checkout_status(session, booking_id, current_user.userId)


@router.post("/bookings/{booking_id}/checkout")
def create_deposit_checkout(
    booking_id: int, session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
):
    return create_checkout(session, booking_id, current_user.userId)


@router.post("/sepay/ipn")
def gateway_ipn(
    payload: dict, session: SessionDep,
    x_secret_key: Annotated[str | None, Header()] = None,
):
    return process_gateway_ipn(session, payload, x_secret_key)


@router.get("/admin/payment-reviews")
def payment_reviews(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    return session.exec(select(DepositCheckout).where(DepositCheckout.status == "review")
        .order_by(DepositCheckout.id.desc())).all()


@router.get("/manager/summary")
def manager_deposit_summary(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
):
    return _withdrawal_balance(session, _manager_restaurant(session, current_user).id)


@router.get("/manager/finance")
def manager_finance(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
):
    restaurant = _manager_restaurant(session, current_user)
    withdrawals = session.exec(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.restaurant_id == restaurant.id)
        .order_by(WithdrawalRequest.id.desc())
    ).all()
    return {
        "summary": _withdrawal_balance(session, restaurant.id),
        "withdrawals": withdrawals,
    }


@router.get("/manager/withdrawals")
def manager_withdrawals(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
):
    restaurant = _manager_restaurant(session, current_user)
    return session.exec(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.restaurant_id == restaurant.id)
        .order_by(WithdrawalRequest.id.desc())
    ).all()


@router.post("/manager/withdrawals")
def create_withdrawal(
    data: WithdrawalCreate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
):
    restaurant = _manager_restaurant(session, current_user)
    balance = _withdrawal_balance(session, restaurant.id)
    if data.amount > balance["availableBalance"]:
        raise HTTPException(status_code=400, detail="Số tiền vượt quá số dư có thể rút")
    if not data.qr_image_url and not (data.bank_name and data.account_name and data.account_number):
        raise HTTPException(status_code=422, detail="Nhập đủ thông tin tài khoản nhận hoặc đính kèm ảnh QR")
    withdrawal = WithdrawalRequest(
        restaurant_id=restaurant.id,
        **data.model_dump(),
        status="pending",
        requested_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(withdrawal)
    session.commit()
    session.refresh(withdrawal)
    return withdrawal


@router.get("/admin/withdrawals")
def admin_withdrawals(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    rows = session.exec(select(WithdrawalRequest).order_by(WithdrawalRequest.id.desc())).all()
    restaurants = {restaurant.id: restaurant.name for restaurant in session.exec(select(Restaurant)).all()}
    return [
        {**request.model_dump(), "restaurantName": restaurants.get(request.restaurant_id, "Nhà hàng đã xóa")}
        for request in rows
    ]


@router.put("/admin/withdrawals/{withdrawal_id}/pay")
def mark_withdrawal_paid(
    withdrawal_id: int,
    data: WithdrawalDecision,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    withdrawal = session.get(WithdrawalRequest, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu rút tiền")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Yêu cầu này đã được xử lý")
    if not data.transfer_proof_url:
        raise HTTPException(status_code=422, detail="Cần đính kèm minh chứng chuyển tiền")
    withdrawal.status = "paid"
    withdrawal.processed_at = datetime.now(timezone.utc).isoformat()
    withdrawal.processed_by = current_user.userId
    withdrawal.transfer_proof_url = data.transfer_proof_url
    withdrawal.admin_note = data.admin_note
    session.add(withdrawal)
    restaurant = session.get(Restaurant, withdrawal.restaurant_id)
    if restaurant and restaurant.manager_id:
        session.add(Notification(
            userId=restaurant.manager_id,
            title="Yêu cầu rút tiền đã được chuyển",
            message=f"Admin đã chuyển {withdrawal.amount:,}đ. Minh chứng đã được đính kèm trong mục Tiền đặt cọc.",
            createdAt=withdrawal.processed_at,
            type="withdrawal_paid",
        ))
    session.commit()
    session.refresh(withdrawal)
    return withdrawal


@router.put("/admin/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(
    withdrawal_id: int,
    data: WithdrawalDecision,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    withdrawal = session.get(WithdrawalRequest, withdrawal_id)
    if not withdrawal or withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Yêu cầu không thể từ chối")
    withdrawal.status = "rejected"
    withdrawal.processed_at = datetime.now(timezone.utc).isoformat()
    withdrawal.processed_by = current_user.userId
    withdrawal.admin_note = data.admin_note
    session.add(withdrawal)
    restaurant = session.get(Restaurant, withdrawal.restaurant_id)
    if restaurant and restaurant.manager_id:
        session.add(Notification(
            userId=restaurant.manager_id,
            title="Yêu cầu rút tiền bị từ chối",
            message=data.admin_note or "Vui lòng kiểm tra lại thông tin nhận tiền và gửi yêu cầu mới.",
            createdAt=withdrawal.processed_at,
            type="withdrawal_rejected",
        ))
    session.commit()
    session.refresh(withdrawal)
    return withdrawal
