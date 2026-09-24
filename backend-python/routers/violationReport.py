from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy import func, or_, and_
from sqlmodel import select  # type: ignore

from database import SessionDep
from core.booking_policy import month_start
from models.depositPayment import DepositPayment
from models.booking import Booking
from models.notification import Notification
from models.restaurant import Restaurant
from models.user import User
from models.violationReport import ViolationReport
from routers.booking import APP_TIME_ZONE, get_booking_meal_time
from routers.deps import get_current_user, get_current_user_for_appeal
from schemas.violationReport import (
    ViolationAppealCreate,
    ViolationReportCreate,
    ViolationReviewCreate,
)


router = APIRouter(prefix="/v1/violation-reports", tags=["Violation report"])


def ensure_report_window(booking: Booking, minimum_delay: timedelta) -> None:
    meal_time = get_booking_meal_time(booking)
    now = datetime.now(APP_TIME_ZONE)

    if not meal_time:
        raise HTTPException(status_code=400, detail="Ngày hoặc giờ đặt bàn không hợp lệ")
    if now < meal_time + minimum_delay:
        raise HTTPException(status_code=400, detail="Chưa đến thời gian được phép gửi báo cáo")
    if now > meal_time + timedelta(days=7):
        raise HTTPException(status_code=400, detail="Đã quá thời hạn báo cáo 7 ngày sau bữa ăn")


def add_warning(session: SessionDep, user_id: int, title: str, message: str) -> None:
    session.add(Notification(
        userId=user_id,
        title=title,
        message=message,
        type="violation_warning",
        createdAt=datetime.now(timezone.utc).isoformat(),
    ))


@router.post("/customer", response_model=ViolationReport)
def report_customer(
    data: ViolationReportCreate,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
    session: SessionDep,
):
    booking = session.exec(select(Booking).where(Booking.bookingId == data.booking_id).with_for_update().execution_options(populate_existing=True)).first()
    restaurant = session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first()
    if not booking or not restaurant or booking.restaurantId != restaurant.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt bàn")
    if booking.status not in {"confirmed", "completed"}:
        raise HTTPException(status_code=400, detail="Chỉ có thể báo cáo khách không đến với đơn đã xác nhận")
    if session.exec(select(ViolationReport).where(ViolationReport.booking_id == booking.bookingId, ViolationReport.target_type == "customer")).first():
        raise HTTPException(status_code=409, detail="Đơn đặt bàn này đã được báo cáo")

    customer = session.exec(select(User).where(User.userId == booking.userId).with_for_update().execution_options(populate_existing=True)).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    customer.report_strikes = 1 + session.exec(select(func.count(ViolationReport.id)).where(
        ViolationReport.target_user_id == customer.userId,
        ViolationReport.target_type == "customer", ViolationReport.status != "dismissed",
        ViolationReport.created_at >= month_start())).one()
    if customer.report_strikes > 3:
        customer.is_permanently_banned = False
        customer.is_suspended = True
    payment = session.exec(select(DepositPayment).where(DepositPayment.booking_id == booking.bookingId).with_for_update()).first()
    if payment and payment.status == "paid":
        booking.depositStatus = "forfeited"
        session.add(booking)
    report = ViolationReport(booking_id=booking.bookingId, reporter_id=current_user.userId, target_user_id=customer.userId, target_type="customer", reason=data.reason, evidence_urls=data.evidence_urls or None)
    session.add(customer)
    session.add(report)
    add_warning(session, customer.userId, "Cảnh cáo vi phạm đặt bàn", f"Bạn nhận 1 vi phạm vì không đến dùng bữa. Số lần vi phạm hiện tại: {customer.report_strikes}.")
    session.commit()
    session.refresh(report)
    return report


@router.post("/restaurant", response_model=ViolationReport)
def report_restaurant(
    data: ViolationReportCreate,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
    session: SessionDep,
):
    booking = session.exec(select(Booking).where(Booking.bookingId == data.booking_id).with_for_update().execution_options(populate_existing=True)).first()
    if not booking or booking.userId != current_user.userId:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt bàn")
    if booking.status not in {"confirmed", "completed"}:
        raise HTTPException(status_code=400, detail="Chỉ có thể báo cáo nhà hàng từ đơn đã xác nhận hoặc hoàn thành")
    if session.exec(select(ViolationReport).where(ViolationReport.booking_id == booking.bookingId, ViolationReport.target_type == "restaurant")).first():
        raise HTTPException(status_code=409, detail="Đơn đặt bàn này đã báo cáo nhà hàng")

    restaurant = session.get(Restaurant, booking.restaurantId)
    if not restaurant or not restaurant.manager_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà hàng")
    restaurant.is_report_suspended = True
    restaurant.is_active = False
    report = ViolationReport(booking_id=booking.bookingId, reporter_id=current_user.userId, target_restaurant_id=restaurant.id, target_type="restaurant", source="customer_report", reason=data.reason, evidence_urls=data.evidence_urls or None)
    session.add(restaurant)
    session.add(report)
    add_warning(session, restaurant.manager_id, "Nhà hàng bị tạm ngưng", "Nhà hàng nhận report từ khách và đã tạm ngưng hiển thị. Hãy gửi giải trình cùng minh chứng.")
    session.commit()
    session.refresh(report)
    return report


@router.get("/manager/summary")
def manager_violation_summary(current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first()
    if not restaurant:
        raise HTTPException(404, "Tài khoản chưa liên kết nhà hàng")
    report_count, active_reports = session.exec(select(
        func.count(ViolationReport.id),
        func.count(ViolationReport.id).filter(ViolationReport.status != "dismissed"),
    ).where(ViolationReport.target_restaurant_id == restaurant.id,
            ViolationReport.target_type == "restaurant",
            ViolationReport.source == "customer_report")).one()
    # Threshold escalation records are not extra violations. The counter tracks active late responses.
    warnings = session.exec(select(Notification).outerjoin(Booking, Booking.bookingId == Notification.bookingId)
        .where(Notification.type == "late_response_warning", or_(
            Booking.restaurantId == restaurant.id,
            and_(Notification.bookingId == None, Notification.userId == current_user.userId)))
        .order_by(Notification.id.desc()).limit(100)).all()
    late_count = max(0, restaurant.late_response_strikes)
    return {
        "late_response_count": late_count,
        "customer_report_count": active_reports,
        "total_active_count": late_count + active_reports,
        "customer_report_history_count": report_count,
        "late_response_history": [{"id": n.id, "booking_id": n.bookingId, "message": n.message,
            "created_at": n.createdAt} for n in warnings],
    }


@router.get("/me", response_model=list[ViolationReport])
def get_my_reports(current_user: Annotated[User, Security(get_current_user)], session: SessionDep):
    if current_user.role == "customer":
        statement = select(ViolationReport).where(ViolationReport.target_user_id == current_user.userId)
    elif current_user.role == "manager":
        restaurant = session.exec(select(Restaurant).where(Restaurant.manager_id == current_user.userId)).first()
        statement = select(ViolationReport).where(ViolationReport.target_restaurant_id == (restaurant.id if restaurant else -1))
    else:
        raise HTTPException(status_code=403, detail="Tính năng này không khả dụng cho tài khoản hiện tại")
    return session.exec(statement.order_by(ViolationReport.created_at.desc())).all()


@router.post("/{report_id}/appeal", response_model=ViolationReport)
def appeal_report(report_id: int, data: ViolationAppealCreate, current_user: Annotated[User, Depends(get_current_user_for_appeal)], session: SessionDep):
    report = session.get(ViolationReport, report_id)
    if not report or report.status not in {"open", "appeal_rejected"}:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo đang có hiệu lực")
    is_customer_target = report.target_type == "customer" and report.target_user_id == current_user.userId
    is_manager_target = report.target_type == "restaurant" and session.exec(select(Restaurant).where(Restaurant.id == report.target_restaurant_id, Restaurant.manager_id == current_user.userId)).first()
    if not is_customer_target and not is_manager_target:
        raise HTTPException(status_code=403, detail="Bạn không có quyền giải trình cho báo cáo này")
    report.appeal_reason = data.reason
    report.appeal_evidence_urls = data.evidence_urls or None
    report.status = "appeal_pending"
    session.add(report); session.commit(); session.refresh(report)
    return report


@router.get("", response_model=list[ViolationReport])
def get_reports(current_user: Annotated[User, Security(get_current_user, scopes=["admin"])], session: SessionDep, limit: int = 20, offset: int = 0):
    return session.exec(select(ViolationReport).order_by(ViolationReport.created_at.desc()).offset(offset).limit(min(limit, 50))).all()


@router.post("/{report_id}/review", response_model=ViolationReport)
def review_report(report_id: int, data: ViolationReviewCreate, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])], session: SessionDep):
    report = session.get(ViolationReport, report_id)
    if not report or report.status != "appeal_pending":
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu giải trình")
    report.admin_id = current_user.userId; report.admin_note = data.admin_note; report.reviewed_at = datetime.now(timezone.utc)
    report.status = "dismissed" if data.approved else "appeal_rejected"
    if data.approved and report.target_type == "customer" and report.target_user_id:
        user = session.get(User, report.target_user_id)
        if user:
            user.report_strikes = max(0, user.report_strikes - 1); user.is_suspended = user.is_permanently_banned; session.add(user)
    if data.approved and report.target_type == "restaurant" and report.target_restaurant_id:
        restaurant = session.get(Restaurant, report.target_restaurant_id)
        if restaurant:
            other_open = session.exec(select(ViolationReport).where(ViolationReport.target_restaurant_id == restaurant.id, ViolationReport.status != "dismissed", ViolationReport.id != report.id)).first()
            if not other_open:
                restaurant.is_report_suspended = False; restaurant.is_active = restaurant.approval_status == "approved"; session.add(restaurant)
            if report.source == "late_response":
                restaurant.late_response_strikes = 0
                session.add(restaurant)
    session.add(report); session.commit(); session.refresh(report)
    return report
