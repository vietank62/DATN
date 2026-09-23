from typing import Annotated
from fastapi import APIRouter, Security, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlmodel import select
from database import SessionDep
from models import Restaurant, User
from models.bookingFee import BookingFee
from routers.deps import get_current_user
from core.booking_fees import settle_restaurant_fees

router = APIRouter(prefix="/v1/booking-fees", tags=["Booking fees"])
class FeeReceipt(BaseModel):
    proof_url: HttpUrl

@router.get("")
def list_fees(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    query = select(Restaurant)
    if current_user.role != "admin":
        query = query.where(Restaurant.manager_id == current_user.userId)
    restaurants = session.exec(query.with_for_update()).all()
    for restaurant in restaurants:
        settle_restaurant_fees(session, restaurant)
    session.commit()
    return session.exec(select(BookingFee).where(BookingFee.restaurant_id.in_([r.id for r in restaurants])).order_by(BookingFee.id.desc())).all()

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
