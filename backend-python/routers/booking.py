from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy import func
from sqlmodel import select  # type: ignore

from database import SessionDep
from models.booking import Booking
from models.bookingItem import BookingItem
from models.menuItem import RestaurantMenuList
from models.restaurant import Restaurant
from models.user import User
from models.violationReport import ViolationReport
from routers.deps import get_current_user
from schemas.bookingSchema import BookingCreate, BookingResponse, BookingItemOut


router = APIRouter(prefix="/v1/bookings", tags=["Booking"])
# Việt Nam dùng UTC+7 quanh năm, nên không cần dữ liệu IANA timezone trên Windows.
APP_TIME_ZONE = timezone(timedelta(hours=7))


def get_booking_meal_time(booking: Booking) -> datetime | None:
	try:
		return datetime.strptime(
			f"{booking.date} {booking.time[:5]}",
			"%Y-%m-%d %H:%M",
		).replace(tzinfo=APP_TIME_ZONE)
	except (TypeError, ValueError):
		return None


def auto_complete_expired_confirmed_bookings(
	session: Any,
	now: datetime | None = None,
) -> int:
	current_time = now or datetime.now(APP_TIME_ZONE)
	if current_time.tzinfo is None:
		current_time = current_time.replace(tzinfo=APP_TIME_ZONE)

	completion_deadline = current_time - timedelta(days=3)
	confirmed_bookings = session.exec(
		select(Booking).where(Booking.status == "confirmed")
	).all()
	completed_count = 0

	for booking in confirmed_bookings:
		meal_time = get_booking_meal_time(booking)

		if meal_time and meal_time <= completion_deadline:
			booking.status = "completed"
			session.add(booking)
			completed_count += 1

	if completed_count:
		session.commit()

	return completed_count


def _get_restaurant_or_404(session: Any, restaurant_id: int) -> Restaurant:
	restaurant = session.get(Restaurant, restaurant_id)
	if not restaurant:
		raise HTTPException(status_code=404, detail="Restaurant not found")
	return restaurant


def _ensure_restaurant_access(restaurant: Restaurant, current_user: User) -> None:
	if current_user.role == "admin":
		return
	if current_user.role == "manager" and restaurant.manager_id == current_user.userId:
		return
	raise HTTPException(status_code=403, detail="You do not have permission to access this restaurant")


def _serialize_booking(session: Any, booking: Booking) -> BookingResponse:
	restaurant = session.get(Restaurant, booking.restaurantId)
	item_rows = session.exec(
		select(BookingItem, RestaurantMenuList)
		.join(RestaurantMenuList, BookingItem.itemId == RestaurantMenuList.id)
		.where(BookingItem.bookingId == booking.bookingId)
		.order_by(RestaurantMenuList.category.asc(), RestaurantMenuList.name.asc(), BookingItem.bookingItemId.asc())
	).all()

	booking_items = [
		BookingItemOut(
			bookingItemId=booking_item.bookingItemId,
			itemId=booking_item.itemId,
			quantity=booking_item.quantity,
			price=booking_item.price,
			name=menu_item.name,
			category=menu_item.category,
			image_url=menu_item.image_url,
			description=menu_item.description,
		)
		for booking_item, menu_item in item_rows
	]

	return BookingResponse(
		bookingId=booking.bookingId,
		userId=booking.userId,
		restaurantId=booking.restaurantId,
		restaurantName=restaurant.name if restaurant else None,
		date=booking.date,
		time=booking.time,
		guestCount=booking.guestCount,
		childCount=booking.childCount,
		requestSeats=booking.requestSeats,
		assignedSeats=booking.assignedSeats,
		status=booking.status,
		contactName=booking.contactName,
		contactEmail=booking.contactEmail,
		contactPhone=booking.contactPhone,
		note=booking.note,
		createdAt=booking.createdAt,
		booking_items=booking_items,
	)


def _persist_booking_status(session: Any, booking: Booking, status: str) -> BookingResponse:
	booking.status = status
	session.add(booking)
	session.commit()
	session.refresh(booking)
	return _serialize_booking(session, booking)


@router.post("", response_model=BookingResponse)
def create_booking(
	booking_data: BookingCreate,
	current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
	session: SessionDep,  # type: ignore
):
	active_strike_count = session.exec(
		select(func.count(ViolationReport.id)).where(
			ViolationReport.target_user_id == current_user.userId,
			ViolationReport.target_type == "customer",
			ViolationReport.status.in_(["open", "appeal_pending"]),
		)
	).one()

	should_suspend = active_strike_count >= 3
	if (
		current_user.is_suspended != should_suspend
		or current_user.report_strikes != active_strike_count
	):
		current_user.is_suspended = should_suspend
		current_user.report_strikes = active_strike_count
		session.add(current_user)
		session.commit()

	if should_suspend:
		raise HTTPException(
			status_code=403,
			detail="Tài khoản đã bị tạm khóa chức năng đặt bàn do có cờ vi phạm",
		)
	restaurant = _get_restaurant_or_404(session, booking_data.restaurantId)
	if not restaurant.is_active:
		raise HTTPException(status_code=400, detail="This restaurant is not accepting bookings")
	if booking_data.childCount < 0 or booking_data.childCount > booking_data.guestCount:
		raise HTTPException(status_code=422, detail="Child count must be between 0 and total guest count")
	if booking_data.requestSeats < booking_data.guestCount:
		raise HTTPException(
			status_code=422,
			detail="Số chỗ yêu cầu phải đủ cho toàn bộ người lớn và trẻ em",
		)

	menu_item_map: dict[int, RestaurantMenuList] = {}
	if booking_data.items:
		item_ids = [item.itemId for item in booking_data.items]
		menu_items = session.exec(
			select(RestaurantMenuList).where(RestaurantMenuList.id.in_(item_ids))
		).all()
		menu_item_map = {item.id: item for item in menu_items}

		for item in booking_data.items:
			menu_item = menu_item_map.get(item.itemId)
			if not menu_item or menu_item.restaurant_id != restaurant.id:
				raise HTTPException(status_code=400, detail=f"Menu item {item.itemId} is not available for this restaurant")
			if not menu_item.is_available:
				raise HTTPException(status_code=400, detail=f"Menu item {menu_item.name} is not available")

	now = datetime.now(timezone.utc).isoformat()
	db_booking = Booking(
		userId=current_user.userId,
		restaurantId=booking_data.restaurantId,
		date=booking_data.date,
		time=booking_data.time,
		guestCount=booking_data.guestCount,
		childCount=booking_data.childCount,
		requestSeats=booking_data.requestSeats,
		assignedSeats=0,
		status="pending",
		contactName=booking_data.contactName,
		contactEmail=booking_data.contactEmail,
		contactPhone=booking_data.contactPhone,
		note=booking_data.note,
		createdAt=now,
	)

	session.add(db_booking)
	session.flush()

	if booking_data.items:
		for item in booking_data.items:
			menu_item = menu_item_map.get(item.itemId)
			booking_item = BookingItem(
				bookingId=db_booking.bookingId,
				itemId=menu_item.id,
				quantity=max(1, item.quantity),
				price=menu_item.price,
			)
			session.add(booking_item)

		session.commit()

	session.refresh(db_booking)
	return _serialize_booking(session, db_booking)


@router.get("/me", response_model=list[BookingResponse])
def get_my_bookings(
	current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
	session: SessionDep,  # type: ignore
):
	auto_complete_expired_confirmed_bookings(session)
	bookings = session.exec(
		select(Booking)
		.where(Booking.userId == current_user.userId)
		.order_by(Booking.bookingId.desc())
	).all()
	return [_serialize_booking(session, booking) for booking in bookings]


@router.get("/manager/me", response_model=list[BookingResponse])
def get_my_restaurant_bookings(
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	auto_complete_expired_confirmed_bookings(session)
	restaurant = session.exec(
		select(Restaurant).where(Restaurant.manager_id == current_user.userId)
	).first()
	if not restaurant:
		raise HTTPException(status_code=404, detail="No restaurant is assigned to this manager")

	bookings = session.exec(
		select(Booking)
		.where(Booking.restaurantId == restaurant.id)
		.order_by(Booking.bookingId.desc())
	).all()
	return [_serialize_booking(session, booking) for booking in bookings]


@router.get("/restaurant/{restaurant_id}", response_model=list[BookingResponse])
def get_bookings_by_restaurant(
	restaurant_id: int,
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	auto_complete_expired_confirmed_bookings(session)
	restaurant = _get_restaurant_or_404(session, restaurant_id)
	_ensure_restaurant_access(restaurant, current_user)

	bookings = session.exec(
		select(Booking)
		.where(Booking.restaurantId == restaurant_id)
		.order_by(Booking.bookingId.desc())
	).all()
	return [_serialize_booking(session, booking) for booking in bookings]


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking_detail(
	booking_id: int,
	current_user: Annotated[User, Depends(get_current_user)],
	session: SessionDep,  # type: ignore
):
	auto_complete_expired_confirmed_bookings(session)
	booking = session.get(Booking, booking_id)
	if not booking:
		raise HTTPException(status_code=404, detail="Booking not found")

	restaurant = _get_restaurant_or_404(session, booking.restaurantId)
	if current_user.role == "admin":
		return _serialize_booking(session, booking)
	if current_user.role == "manager" and restaurant.manager_id == current_user.userId:
		return _serialize_booking(session, booking)
	if booking.userId != current_user.userId:
		raise HTTPException(status_code=403, detail="You do not have permission to view this booking")

	return _serialize_booking(session, booking)


@router.put("/{booking_id}/confirm", response_model=BookingResponse)
def confirm_booking(
	booking_id: int,
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	booking = session.get(Booking, booking_id)
	if not booking:
		raise HTTPException(status_code=404, detail="Booking not found")

	restaurant = _get_restaurant_or_404(session, booking.restaurantId)
	_ensure_restaurant_access(restaurant, current_user)

	if booking.status != "pending":
		raise HTTPException(status_code=400, detail="Only pending bookings can be confirmed")

	return _persist_booking_status(session, booking, "confirmed")


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
	booking_id: int,
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	booking = session.get(Booking, booking_id)
	if not booking:
		raise HTTPException(status_code=404, detail="Booking not found")

	restaurant = _get_restaurant_or_404(session, booking.restaurantId)
	_ensure_restaurant_access(restaurant, current_user)

	if booking.status == "cancelled":
		return _serialize_booking(session, booking)

	return _persist_booking_status(session, booking, "cancelled")


@router.put("/{booking_id}/complete", response_model=BookingResponse)
def complete_booking(
	booking_id: int,
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	booking = session.get(Booking, booking_id)
	if not booking:
		raise HTTPException(status_code=404, detail="Booking not found")

	restaurant = _get_restaurant_or_404(session, booking.restaurantId)
	_ensure_restaurant_access(restaurant, current_user)

	if booking.status != "confirmed":
		raise HTTPException(status_code=400, detail="Chỉ đơn đã xác nhận mới có thể hoàn thành")

	meal_time = get_booking_meal_time(booking)
	if not meal_time:
		raise HTTPException(
			status_code=400,
			detail="Ngày hoặc giờ đặt bàn không hợp lệ",
		)
	if meal_time > datetime.now(APP_TIME_ZONE):
		raise HTTPException(
			status_code=400,
			detail="Chỉ có thể hoàn thành đơn sau thời gian dùng bữa đã đặt",
		)

	return _persist_booking_status(session, booking, "completed")
