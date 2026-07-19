from datetime import datetime, timezone
from typing import Annotated, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Security
from sqlmodel import select  # type: ignore

from database import SessionDep
from models.booking import Booking
from models.bookingItem import BookingItem
from models.menuItem import RestaurantMenuList
from models.restaurant import Restaurant
from models.user import User
from routers.deps import get_current_user
from schemas.bookingSchema import BookingCreate, BookingResponse, BookingItemOut


router = APIRouter(prefix="/v1/bookings", tags=["Booking"])


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


@router.post("/v1/bookings", response_model=BookingResponse)
def create_booking(
	booking_data: BookingCreate,
	current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
	session: SessionDep,  # type: ignore
):
	restaurant = _get_restaurant_or_404(session, booking_data.restaurantId)

	now = datetime.now(timezone.utc).isoformat()
	db_booking = Booking(
		userId=current_user.userId,
		restaurantId=booking_data.restaurantId,
		date=booking_data.date,
		time=booking_data.time,
		guestCount=booking_data.guestCount,
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
	session.commit()
	session.refresh(db_booking)

	if booking_data.items:
		item_ids = [item.itemId for item in booking_data.items]
		menu_items = session.exec(
			select(RestaurantMenuList).where(RestaurantMenuList.id.in_(item_ids))
		).all()
		menu_item_map = {item.id: item for item in menu_items}

		for item in booking_data.items:
			menu_item = menu_item_map.get(item.itemId)
			if not menu_item or menu_item.restaurant_id != restaurant.id:
				session.rollback()
				raise HTTPException(status_code=400, detail=f"Menu item {item.itemId} is not available for this restaurant")
			if not menu_item.is_available:
				session.rollback()
				raise HTTPException(status_code=400, detail=f"Menu item {menu_item.name} is not available")

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


@router.get("/v1/bookings/me", response_model=list[BookingResponse])
def get_my_bookings(
	current_user: Annotated[User, Security(get_current_user, scopes=["customer"])],
	session: SessionDep,  # type: ignore
):
	bookings = session.exec(
		select(Booking)
		.where(Booking.userId == current_user.userId)
		.order_by(Booking.bookingId.desc())
	).all()
	return [_serialize_booking(session, booking) for booking in bookings]


@router.get("/v1/bookings/restaurant/{restaurant_id}", response_model=list[BookingResponse])
def get_bookings_by_restaurant(
	restaurant_id: int,
	current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
	session: SessionDep,  # type: ignore
):
	restaurant = _get_restaurant_or_404(session, restaurant_id)
	_ensure_restaurant_access(restaurant, current_user)

	bookings = session.exec(
		select(Booking)
		.where(Booking.restaurantId == restaurant_id)
		.order_by(Booking.bookingId.desc())
	).all()
	return [_serialize_booking(session, booking) for booking in bookings]


@router.get("/v1/bookings/{booking_id}", response_model=BookingResponse)
def get_booking_detail(
	booking_id: int,
	current_user: Annotated[User, Depends(get_current_user)],
	session: SessionDep,  # type: ignore
):
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


@router.put("/v1/bookings/{booking_id}/confirm", response_model=BookingResponse)
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


@router.put("/v1/bookings/{booking_id}/cancel", response_model=BookingResponse)
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


@router.put("/v1/bookings/{booking_id}/complete", response_model=BookingResponse)
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
		raise HTTPException(status_code=400, detail="Only confirmed bookings can be completed")

	return _persist_booking_status(session, booking, "completed")
