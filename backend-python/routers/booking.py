from fastapi import APIRouter, HTTPException
from database import SessionDep
from models import Booking, Restaurant
from schemas import BookingCreate, BookingUpdate

router = APIRouter()

@router.post("/api/create-booking/", tags=["Booking"])
def create_booking(booking: BookingCreate, session: SessionDep):
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return booking

@router.get("/api/get-all-booking/", tags=["Booking"])
def get_all_bookings(session: SessionDep):
    bookings = session.query(Booking).all()
    return bookings

@router.get("/api/get-bookings-by-user/{user_id}", tags=["Booking"])
def get_bookings_by_user_id(user_id: int, session: SessionDep):
    bookings = session.query(Booking).filter(Booking.userId == user_id).all()
    return bookings

@router.get("/api/get-bookings-by-restaurant/{restaurant_id}", tags=["Booking"])
def get_bookings_by_restaurant_id(restaurant_id: int, session: SessionDep):
    bookings = session.query(Booking).filter(Booking.restaurantId == restaurant_id).all()
    return bookings

@router.get("/api/get-booking/{booking_id}", tags=["Booking"])
def get_booking_by_id(booking_id: int, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == booking_id).first()
    return booking

@router.delete("/api/delete-booking/{booking_id}", tags=["Booking"])
def delete_booking_by_id(booking_id: int, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == booking_id).first()
    if booking:
        session.delete(booking)
        session.commit()
        return {"message": "Booking deleted successfully"}
    return {"message": "Booking not found"}

@router.put("/api/update-booking/{booking_id}", tags=["Booking"])
def update_booking_by_id(booking_id: int, updated_booking: BookingUpdate, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == booking_id).first()
    if booking:
        update_data = updated_booking.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(booking, field, value)
        session.commit()
        session.refresh(booking)
        return booking
    return {"message": "Booking not found"}

@router.put("/api/bookings/{id}/confirm", tags=["Booking"])
def confirm_booking(id: int, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="Booking already confirmed")
    
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot confirm cancelled booking")
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == booking.restaurantId).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Kiểm tra số ghế còn lại
    if restaurant.availableSeats < booking.requestSeats:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough seats. Only {restaurant.availableSeats} seats available"
        )
    
    # Xác nhận booking
    booking.status = "confirmed"
    booking.assignedSeats = booking.requestSeats
    
    # Giảm số ghế available của nhà hàng
    restaurant.availableSeats -= booking.assignedSeats
    
    session.commit()
    session.refresh(booking)
    session.refresh(restaurant)
    
    return {
        "message": "Booking confirmed successfully",
        "booking": booking,
        "restaurant_available_seats": restaurant.availableSeats
    }

@router.put("/api/bookings/{id}/cancel", tags=["Booking"])
def cancel_booking(id: int, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")
    if booking.status == "confirmed" and booking.assignedSeats > 0:
        restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == booking.restaurantId).first()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        # Trả lại ghế cho nhà hàng
        restaurant.availableSeats += booking.assignedSeats
        session.add(restaurant)
    
    # Hủy booking
    booking.status = "cancelled"
    session.commit()
    session.refresh(booking)
    
    return {
        "message": "Booking cancelled successfully",
        "booking": booking
    }

@router.put("/api/bookings/{id}/complete", tags=["Booking"])
def complete_booking(id: int, session: SessionDep):
    booking = session.query(Booking).filter(Booking.bookingId == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Booking already completed")
    
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot complete cancelled booking")
    
    if booking.status == "pending":
        raise HTTPException(status_code=400, detail="Cannot complete pending booking. Please confirm first")
    
    # Hoàn thành booking
    booking.status = "completed"
    session.commit()
    session.refresh(booking)
    
    return {
        "message": "Booking completed successfully",
        "booking": booking
    }
    
