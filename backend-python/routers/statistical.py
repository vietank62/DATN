from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Security
from sqlalchemy import func
from datetime import date
from database import SessionDep
from models import Booking, Restaurant, User, MenuItem
from schemas import ManagerStats, AdminStats
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

    return ManagerStats(
        totalBookings=total_bookings,
        todayBookings=today_bookings,
        totalRevenue=0.0,
        avgRating=restaurant.rating,
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
