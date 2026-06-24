# from typing import Annotated, Optional
# from fastapi import APIRouter, HTTPException, Depends, Security, Query
# from sqlalchemy import func
# from datetime import date
# from database import SessionDep
# from models import Booking, Restaurant, User, MenuItem, Review
# from schemas import ManagerStats, AdminStats, BookingChartResponse, MenuChartResponse, StatusChartResponse, MonthlyBookingStat, MenuDistributionStat, BookingStatusStat
# from routers.authentication import get_current_user
# from sqlmodel import select

# router = APIRouter()

# @router.get("/api/stats/manager/{restaurantId}", tags=["Statistics"], response_model=ManagerStats)
# def get_manager_stats(restaurantId: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
#     restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurantId)).first()
#     if not restaurant:
#         raise HTTPException(status_code=404, detail="Restaurant not found")
        
#     if restaurant.managerID != current_user.userId and current_user.role != "admin":
#         raise HTTPException(status_code=403, detail="Not authorized to view stats for this restaurant")


#     today_str = date.today().isoformat()

#     total_bookings = session.exec(select(func.count(Booking.bookingId)).where(Booking.restaurantId == restaurantId)).first() or 0

#     today_bookings = session.exec(
#         select(func.count(Booking.bookingId))
#         .where(Booking.restaurantId == restaurantId, Booking.date == today_str)
#     ).first() or 0

#     pending_bookings = session.exec(
#         select(func.count(Booking.bookingId))
#         .where(Booking.restaurantId == restaurantId, Booking.status == "pending")
#     ).first() or 0

#     confirmed_bookings = session.exec(
#         select(func.count(Booking.bookingId))
#         .where(Booking.restaurantId == restaurantId, Booking.status == "confirmed")
#     ).first() or 0

#     avg_rating_result = session.exec(
#         select(func.avg(Review.rating)).where(Review.restaurantId == restaurantId)
#     ).first()
#     avg_rating = round(avg_rating_result, 1) if avg_rating_result else 0.0

#     return ManagerStats(
#         totalBookings=total_bookings,
#         todayBookings=today_bookings,
#         totalRevenue=0.0,
#         avgRating=avg_rating,
#         pendingBookings=pending_bookings,
#         confirmedBookings=confirmed_bookings
#     )

# @router.get("/api/stats/admin", tags=["Statistics"], response_model=AdminStats)
# def get_admin_stats(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
#     today = date.today()
#     current_year_month = f"{today.year}-{today.month:02d}"

#     total_restaurants = session.exec(select(func.count(Restaurant.restaurantId))).first() or 0

#     active_restaurants = session.exec(
#         select(func.count(Restaurant.restaurantId)).where(Restaurant.availableSeats > 0)
#     ).first() or 0

#     total_users = session.exec(select(func.count(User.userId))).first() or 0

#     new_users_this_month = session.exec(
#         select(func.count(User.userId)).where(User.createdAt.like(f"{current_year_month}%"))
#     ).first() or 0

#     total_bookings = session.exec(select(func.count(Booking.bookingId))).first() or 0

#     return AdminStats(
#         totalRestaurants=total_restaurants,
#         totalUsers=total_users,
#         totalBookings=total_bookings,
#         totalRevenue=0.0,
#         activeRestaurants=active_restaurants,
#         newUsersThisMonth=new_users_this_month
#     )


# @router.get("/api/stats/manager/{restaurantId}/monthly-bookings", tags=["Statistics"], response_model=BookingChartResponse)
# def get_monthly_bookings(
#     restaurantId: int,
#     session: SessionDep,
#     current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
#     year: Optional[int] = Query(default=None)
# ):
#     restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurantId)).first()
#     if not restaurant:
#         raise HTTPException(status_code=404, detail="Restaurant not found")

#     if restaurant.managerID != current_user.userId and current_user.role != "admin":
#         raise HTTPException(status_code=403, detail="Not authorized to view stats for this restaurant")


#     if year is None:
#         year = date.today().year

#     MONTH_LABELS = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6",
#                     "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]

#     # Count bookings per month for the year
#     results = session.exec(
#         select(
#             func.substr(Booking.date, 6, 2).label("month"),
#             func.count(Booking.bookingId).label("count")
#         ).where(
#             Booking.restaurantId == restaurantId,
#             func.substr(Booking.date, 1, 4) == str(year)
#         ).group_by(func.substr(Booking.date, 6, 2))
#     ).all()

#     month_map = {int(r[0]): r[1] for r in results}

#     monthly = [
#         MonthlyBookingStat(
#             month=m,
#             count=month_map.get(m, 0),
#             label=MONTH_LABELS[m - 1]
#         )
#         for m in range(1, 13)
#     ]

#     total_year = sum(m.count for m in monthly)

#     return BookingChartResponse(monthly=monthly, totalYear=total_year, year=year)


# @router.get("/api/stats/manager/{restaurantId}/menu-distribution", tags=["Statistics"], response_model=MenuChartResponse)
# def get_menu_distribution(
#     restaurantId: int,
#     session: SessionDep,
#     current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
# ):
#     restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurantId)).first()
#     if not restaurant:
#         raise HTTPException(status_code=404, detail="Restaurant not found")

#     if restaurant.managerID != current_user.userId and current_user.role != "admin":
#         raise HTTPException(status_code=403, detail="Not authorized to view stats for this restaurant")


#     results = session.exec(
#         select(
#             func.coalesce(MenuItem.category, "Khác").label("category"),
#             func.count(MenuItem.itemId).label("count")
#         ).where(
#             MenuItem.restaurantId == restaurantId
#         ).group_by(func.coalesce(MenuItem.category, "Khác"))
#     ).all()

#     total = sum(r[1] for r in results)

#     distribution = [
#         MenuDistributionStat(
#             category=r[0] or "Khác",
#             count=r[1],
#             percentage=round((r[1] / total * 100), 1) if total > 0 else 0.0
#         )
#         for r in results
#     ]

#     return MenuChartResponse(distribution=distribution, totalItems=total)


# @router.get("/api/stats/manager/{restaurantId}/booking-status", tags=["Statistics"], response_model=StatusChartResponse)
# def get_booking_status_distribution(
#     restaurantId: int,
#     session: SessionDep,
#     current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
# ):
#     restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurantId)).first()
#     if not restaurant:
#         raise HTTPException(status_code=404, detail="Restaurant not found")

#     if restaurant.managerID != current_user.userId and current_user.role != "admin":
#         raise HTTPException(status_code=403, detail="Not authorized to view stats for this restaurant")


#     STATUS_LABELS = {
#         "pending": "Chờ xác nhận",
#         "confirmed": "Đã xác nhận",
#         "completed": "Hoàn thành",
#         "cancelled": "Đã huỷ"
#     }

#     results = session.exec(
#         select(
#             Booking.status,
#             func.count(Booking.bookingId).label("count")
#         ).where(
#             Booking.restaurantId == restaurantId
#         ).group_by(Booking.status)
#     ).all()

#     total = sum(r[1] for r in results)

#     distribution = [
#         BookingStatusStat(
#             status=STATUS_LABELS.get(r[0], r[0]),
#             count=r[1],
#             percentage=round((r[1] / total * 100), 1) if total > 0 else 0.0
#         )
#         for r in results
#     ]

#     return StatusChartResponse(distribution=distribution, totalBookings=total)
