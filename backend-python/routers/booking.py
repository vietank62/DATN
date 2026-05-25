from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Security, BackgroundTasks
from database import SessionDep
from models import Booking, Restaurant, User
from schemas import BookingCreate, BookingUpdate
from routers.authentication import get_current_user
from sqlmodel import select

router = APIRouter()

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_booking_email(to_email: str, subject: str, content: str):
    """
    Real email sender using Gmail SMTP.
    Requires an App Password from your Google Account.
    """
    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD")

    if not sender_email or not sender_password or sender_password == "SMTP_PASSWORD":
        print(f"📧 SENDING EMAIL TO: {to_email}\n📌 SUBJECT: {subject}\n📝 CONTENT:\n{content}")
        return

    try:
        # Create the email message
        msg = MIMEMultipart()
        msg['From'] = f"TableNow <{sender_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add email body
        msg.attach(MIMEText(content, 'plain', 'utf-8'))
        
        # Connect to Gmail SMTP server
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()  # Secure the connection
        server.login(sender_email, sender_password)
        
        # Send email
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Gửi email thành công tới {to_email}")
    except Exception as e:
        print(f"❌ Lỗi gửi email tới {to_email}: {str(e)}")

def _enrich_bookings(bookings: list[Booking], session) -> list[dict]:
    """Add restaurantName to each booking via a single query."""
    if not bookings:
        return []
    restaurant_ids = list({b.restaurantId for b in bookings})
    restaurants = session.exec(select(Restaurant).where(Restaurant.restaurantId.in_(restaurant_ids))).all()
    name_map = {r.restaurantId: r.name for r in restaurants}
    results = []
    for b in bookings:
        d = b.model_dump() if hasattr(b, 'model_dump') else b.__dict__.copy()
        d["restaurantName"] = name_map.get(b.restaurantId, "")
        results.append(d)
    return results

@router.post("/api/create-booking/", tags=["Booking"])
def create_booking(booking_data: BookingCreate, background_tasks: BackgroundTasks, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    booking = Booking(
        **booking_data.model_dump(),
        createdAt=datetime.now().isoformat(timespec="seconds"),
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)

    # Send confirmation email via background task
    if booking.contactEmail:
        restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == booking.restaurantId)).first()
        restaurant_name = restaurant.name if restaurant else f"Nhà hàng #{booking.restaurantId}"
        
        email_content = f"Xin chào {booking.contactName},\n\nYêu cầu đặt bàn của bạn tại {restaurant_name} vào lúc {booking.time} ngày {booking.date} cho {booking.requestSeats} người đã được ghi nhận và đang chờ xác nhận từ nhà hàng.\n\nCảm ơn bạn đã sử dụng TableNow!"
        background_tasks.add_task(send_booking_email, booking.contactEmail, f"Xác nhận yêu cầu đặt bàn #{booking.bookingId}", email_content)

    return booking

@router.get("/api/get-all-booking/", tags=["Booking"])
def get_all_bookings(session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    bookings = session.exec(select(Booking)).all()
    return _enrich_bookings(bookings, session)

@router.get("/api/get-bookings-by-user/{user_id}", tags=["Booking"])
def get_bookings_by_user_id(user_id: int, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    bookings = session.exec(select(Booking).where(Booking.userId == user_id)).all()
    return _enrich_bookings(bookings, session)

@router.get("/api/get-bookings-by-restaurant/{restaurant_id}", tags=["Booking"])
def get_bookings_by_restaurant_id(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    bookings = session.exec(select(Booking).where(Booking.restaurantId == restaurant_id)).all()
    return _enrich_bookings(bookings, session)

@router.get("/api/get-booking/{booking_id}", tags=["Booking"])
def get_booking_by_id(booking_id: int, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id)).first()
    return booking

@router.delete("/api/delete-booking/{booking_id}", tags=["Booking"])
def delete_booking_by_id(booking_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id)).first()
    if booking:
        session.delete(booking)
        session.commit()
        return {"message": "Booking deleted successfully"}
    return {"message": "Booking not found"}

@router.put("/api/update-booking/{booking_id}", tags=["Booking"])
def update_booking_by_id(booking_id: int, updated_booking: BookingUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = session.exec(select(Booking).where(Booking.bookingId == booking_id)).first()
    if booking:
        update_data = updated_booking.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(booking, field, value)
        session.commit()
        session.refresh(booking)
        return booking
    return {"message": "Booking not found"}

@router.put("/api/bookings/{id}/confirm", tags=["Booking"])
def confirm_booking(id: int, background_tasks: BackgroundTasks, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = session.exec(select(Booking).where(Booking.bookingId == id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="Booking already confirmed")
    
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot confirm cancelled booking")
    
    restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == booking.restaurantId)).first()
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
    
    # Gửi email xác nhận
    if booking.contactEmail:
        email_content = f"Xin chào {booking.contactName},\n\nĐặt bàn của bạn tại {restaurant.name} vào lúc {booking.time} ngày {booking.date} đã được XÁC NHẬN.\n\nVui lòng đến đúng giờ. Hẹn gặp lại bạn!\n\nTrân trọng,\nĐội ngũ TableNow"
        background_tasks.add_task(send_booking_email, booking.contactEmail, f"✅ Đặt bàn thành công #{booking.bookingId}", email_content)
    
    return {
        "message": "Booking confirmed successfully",
        "booking": booking.model_dump(),
        "restaurant_available_seats": restaurant.availableSeats
    }

@router.put("/api/bookings/{id}/cancel", tags=["Booking"])
def cancel_booking(id: int, background_tasks: BackgroundTasks, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    booking = session.exec(select(Booking).where(Booking.bookingId == id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    # Kiểm tra thời gian hủy (chỉ áp dụng giới hạn 2 tiếng đối với khách hàng tự hủy)
    if current_user.role == "customer":
        try:
            booking_datetime_str = f"{booking.date} {booking.time}"
            booking_datetime = datetime.fromisoformat(booking_datetime_str) if 'T' in booking_datetime_str else datetime.strptime(booking_datetime_str, "%Y-%m-%d %H:%M")
            
            now = datetime.now()
            time_diff = booking_datetime - now
            
            if time_diff.total_seconds() < 2 * 3600:
                raise HTTPException(
                    status_code=400, 
                    detail="Bạn chỉ có thể hủy bàn trước thời gian đặt ít nhất 2 tiếng."
                )
        except ValueError:
            pass

    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")
    if booking.status == "confirmed" and booking.assignedSeats > 0:
        restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == booking.restaurantId)).first()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        # Trả lại ghế cho nhà hàng
        restaurant.availableSeats += booking.assignedSeats
        session.add(restaurant)
    
    # Hủy booking
    booking.status = "cancelled"
    session.commit()
    session.refresh(booking)
    
    # Gửi email huỷ
    if booking.contactEmail:
        email_content = f"Xin chào {booking.contactName},\n\nĐặt bàn #{booking.bookingId} của bạn vào lúc {booking.time} ngày {booking.date} đã được HUỶ thành công.\n\nHy vọng sẽ được phục vụ bạn vào lần sau!\n\nTrân trọng,\nĐội ngũ TableNow"
        background_tasks.add_task(send_booking_email, booking.contactEmail, f"❌ Huỷ đặt bàn #{booking.bookingId}", email_content)
    
    return {
        "message": "Booking cancelled successfully",
        "booking": booking.model_dump()
    }

@router.put("/api/bookings/{id}/complete", tags=["Booking"])
def complete_booking(id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    booking = session.exec(select(Booking).where(Booking.bookingId == id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Booking already completed")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot complete cancelled booking")
    
    if booking.status == "pending":
        raise HTTPException(status_code=400, detail="Cannot complete pending booking. Please confirm first")
    
    # Hoàn thành booking — trả lại ghế cho nhà hàng
    if booking.assignedSeats and booking.assignedSeats > 0:
        restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == booking.restaurantId)).first()
        if restaurant:
            restaurant.availableSeats = min(
                restaurant.totalSeats,
                restaurant.availableSeats + booking.assignedSeats,
            )
            session.add(restaurant)

    booking.status = "completed"
    session.commit()
    session.refresh(booking)
    
    return {
        "message": "Booking completed successfully",
        "booking": booking.model_dump()
    }

@router.get("/api/restaurants/{restaurant_id}/fee-stats", tags=["Booking"])
def get_fee_stats(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    # Verify that the restaurant exists
    restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurant_id)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    # Check that this manager actually manages this restaurant
    if restaurant.managerID != current_user.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view fee stats for this restaurant")

    bookings = session.exec(select(Booking).where(Booking.restaurantId == restaurant_id)).all()
    completed_bookings = [b for b in bookings if b.status == "completed"]
    unpaid_bookings = [b for b in completed_bookings if not b.isPaid]
    paid_bookings = [b for b in completed_bookings if b.isPaid]

    return {
        "totalBookings": len(bookings),
        "completedBookings": len(completed_bookings),
        "unpaidBookingsCount": len(unpaid_bookings),
        "paidBookingsCount": len(paid_bookings),
        "unpaidAmount": len(unpaid_bookings) * 6000,
        "paidAmount": len(paid_bookings) * 6000,
        "totalAmount": len(completed_bookings) * 6000
    }

@router.post("/api/restaurants/{restaurant_id}/pay-fees", tags=["Booking"])
def pay_fees(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == restaurant_id)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    if restaurant.managerID != current_user.userId and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to pay fees for this restaurant")

    bookings = session.exec(select(Booking).where(
        Booking.restaurantId == restaurant_id,
        Booking.status == "completed",
        Booking.isPaid == False
    )).all()
    
    for b in bookings:
        b.isPaid = True
        session.add(b)
        
    session.commit()
    return {"message": f"Successfully paid booking fees for {len(bookings)} bookings"}
