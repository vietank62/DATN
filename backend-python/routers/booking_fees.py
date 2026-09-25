from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Security, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import func, or_
from sqlmodel import select
from database import SessionDep
from models import Booking, Restaurant, User
from models.bookingFee import BookingFee
from models.depositPayment import DepositPayment
from routers.deps import get_current_user
from core.booking_fees import settle_restaurant_fees
from core.booking_policy import APP_TIME_ZONE

router = APIRouter(prefix="/v1/booking-fees", tags=["Booking fees"])
class FeeReceipt(BaseModel):
    proof_url: HttpUrl

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
    fees = session.exec(
        select(BookingFee).where(BookingFee.restaurant_id.in_(restaurant_names)).order_by(BookingFee.id.desc())
    ).all()
    return [
        {**fee.model_dump(), "restaurantName": restaurant_names.get(fee.restaurant_id, "Nhà hàng không còn hoạt động")}
        for fee in fees
    ]

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
