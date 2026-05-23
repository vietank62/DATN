from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Depends, Security, Query
from sqlalchemy import func, extract
from datetime import date
from database import SessionDep
from models import Booking, Restaurant, User, MenuItem, Review
from schemas import ManagerStats, AdminStats, BookingChartResponse, MenuChartResponse, StatusChartResponse, MonthlyBookingStat, MenuDistributionStat, BookingStatusStat
from routers.authentication import get_current_user

router = APIRouter()

@router.get("/api/stats/manager/{restaurantId}", tags=["Statistics"], response_model=ManagerStats)
def get_manager_stats(restaurantId: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    today_str = date.today().isoformat()

    total_bookings = session.query(Booking).filter(Booking.restaurantId == restaurantId).count()

    today_bookings = session.query(Booking).filter(
        Booking.restaurantId == restaurantId,
        Booking.date == today_str
    ).count()

    pending_bookings = session.query(Booking).filter(
        Booking.restaurantId == restaurantId,
        Booking.status == "pending"
    ).count()

    confirmed_bookings = session.query(Booking).filter(
        Booking.restaurantId == restaurantId,
        Booking.status == "confirmed"
    ).count()

    avg_rating_result = session.query(func.avg(Review.rating)).filter(Review.restaurantId == restaurantId).scalar()
    avg_rating = round(avg_rating_result, 1) if avg_rating_result else 0.0

    return ManagerStats(
        totalBookings=total_bookings,
        todayBookings=today_bookings,
        totalRevenue=0.0,
        avgRating=avg_rating,
        pendingBookings=pending_bookings,
        confirmedBookings=confirmed_bookings
    )

@router.get("/api/stats/admin", tags=["Statistics"], response_model=AdminStats)
def get_admin_stats(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    today = date.today()
    current_year_month = f"{today.year}-{today.month:02d}"

    total_restaurants = session.query(Restaurant).count()

    active_restaurants = session.query(Restaurant).filter(Restaurant.availableSeats > 0).count()

    total_users = session.query(User).count()

    new_users_this_month = session.query(User).filter(
        User.createdAt.like(f"{current_year_month}%")
    ).count()

    total_bookings = session.query(Booking).count()

    return AdminStats(
        totalRestaurants=total_restaurants,
        totalUsers=total_users,
        totalBookings=total_bookings,
        totalRevenue=0.0,
        activeRestaurants=active_restaurants,
        newUsersThisMonth=new_users_this_month
    )


@router.get("/api/stats/manager/{restaurantId}/monthly-bookings", tags=["Statistics"], response_model=BookingChartResponse)
def get_monthly_bookings(
    restaurantId: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
    year: Optional[int] = Query(default=None)
):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if year is None:
        year = date.today().year

    MONTH_LABELS = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6",
                    "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]

    # Count bookings per month for the year
    results = session.query(
        func.substr(Booking.date, 6, 2).label("month"),
        func.count(Booking.bookingId).label("count")
    ).filter(
        Booking.restaurantId == restaurantId,
        func.substr(Booking.date, 1, 4) == str(year)
    ).group_by(func.substr(Booking.date, 6, 2)).all()

    month_map = {int(r.month): r.count for r in results}

    monthly = [
        MonthlyBookingStat(
            month=m,
            count=month_map.get(m, 0),
            label=MONTH_LABELS[m - 1]
        )
        for m in range(1, 13)
    ]

    total_year = sum(m.count for m in monthly)

    return BookingChartResponse(monthly=monthly, totalYear=total_year, year=year)


@router.get("/api/stats/manager/{restaurantId}/menu-distribution", tags=["Statistics"], response_model=MenuChartResponse)
def get_menu_distribution(
    restaurantId: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    results = session.query(
        func.coalesce(MenuItem.category, "Khác").label("category"),
        func.count(MenuItem.itemId).label("count")
    ).filter(
        MenuItem.restaurantId == restaurantId
    ).group_by(func.coalesce(MenuItem.category, "Khác")).all()

    total = sum(r.count for r in results)

    distribution = [
        MenuDistributionStat(
            category=r.category or "Khác",
            count=r.count,
            percentage=round((r.count / total * 100), 1) if total > 0 else 0.0
        )
        for r in results
    ]

    return MenuChartResponse(distribution=distribution, totalItems=total)


@router.get("/api/stats/manager/{restaurantId}/booking-status", tags=["Statistics"], response_model=StatusChartResponse)
def get_booking_status_distribution(
    restaurantId: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    STATUS_LABELS = {
        "pending": "Chờ xác nhận",
        "confirmed": "Đã xác nhận",
        "completed": "Hoàn thành",
        "cancelled": "Đã huỷ"
    }

    results = session.query(
        Booking.status,
        func.count(Booking.bookingId).label("count")
    ).filter(
        Booking.restaurantId == restaurantId
    ).group_by(Booking.status).all()

    total = sum(r.count for r in results)

    distribution = [
        BookingStatusStat(
            status=STATUS_LABELS.get(r.status, r.status),
            count=r.count,
            percentage=round((r.count / total * 100), 1) if total > 0 else 0.0
        )
        for r in results
    ]

    return StatusChartResponse(distribution=distribution, totalBookings=total)
