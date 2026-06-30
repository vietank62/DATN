from datetime import datetime
from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Depends, Security, BackgroundTasks
from database import SessionDep
from models import Booking, Restaurant, User, Notification
from schemas.bookingSchema import BookingCreate, BookingUpdate
from routers.authentication import get_current_user
from sqlmodel import select

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter()


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
        msg = MIMEMultipart()
        msg['From'] = f"TableNow <{sender_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(content, 'plain', 'utf-8'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
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
    restaurants = session.exec(select(Restaurant).where(Restaurant.id.in_(restaurant_ids))).all()
    name_map = {r.id: r.name for r in restaurants}
    results = []
    for b in bookings:
        d = b.model_dump() if hasattr(b, 'model_dump') else b.__dict__.copy()
        d["restaurantName"] = name_map.get(b.restaurantId, "")
        results.append(d)
    return results


@router.post("/api/create-booking/", tags=["Booking"])
def create_booking(
    booking_data: BookingCreate,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: Annotated[User, Depends(get_current_user)]
):
    booking = Booking(
        **booking_data.model_dump(),
        createdAt=datetime.now().isoformat(timespec="seconds"),
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)

    # Send confirmation email via background task
    if booking.contactEmail:
        restaurant = session.exec(select(Restaurant).where(Restaurant.id == booking.restaurantId)).first()
        restaurant_name = restaurant.name if restaurant else f"Nhà hàng #{booking.restaurantId}"

        email_content = (
            f"Kính gửi Quý khách {booking.contactName},\n\n"
            f"Lời đầu tiên, TableNow xin chân thành cảm ơn Quý khách đã tin tưởng và lựa chọn dịch vụ của chúng tôi để đặt bàn cho buổi tiệc sắp tới.\n\n"
            f"Hệ thống của chúng tôi đã ghi nhận yêu cầu đặt bàn của Quý khách với thông tin chi tiết như sau:\n\n"
            f"--------------------------------------------------\n"
            f"📌 THÔNG TIN CHI TIẾT ĐƠN ĐẶT BÀN:\n"
            f"--------------------------------------------------\n"
            f"• Mã đơn đặt bàn: #{booking.bookingId}\n"
            f"• Nhà hàng: {restaurant_name}\n"
            f"• Thời gian: {booking.time} - Ngày {booking.date}\n"
            f"• Số lượng khách: {booking.guestCount} người (yêu cầu {booking.requestSeats} ghế)\n"
            f"• Ghi chú thêm: {booking.note or 'Không có'}\n"
            f"--------------------------------------------------\n\n"
            f"Hiện tại, yêu cầu đặt bàn của Quý khách đã được chuyển tới Ban quản lý nhà hàng {restaurant_name} và đang được xử lý kiểm tra chỗ trống.\n\n"
            f"Ngay sau khi nhà hàng xác nhận đặt bàn thành công, chúng tôi sẽ lập tức gửi email thông báo chính thức kèm theo mã xác nhận để Quý khách sẵn sàng trải nghiệm.\n\n"
            f"Nếu Quý khách có bất kỳ yêu cầu điều chỉnh thông tin nào, xin vui lòng liên hệ ngay với TableNow qua hotline chăm sóc khách hàng 1900 6868 để được hỗ trợ tận tình.\n\n"
            f"Kính chúc Quý khách có một ngày tràn đầy niềm vui và có những trải nghiệm ẩm thực tuyệt vời sắp tới!\n\n"
            f"Trân trọng,\n"
            f"Đội ngũ TableNow"
        )
        background_tasks.add_task(
            send_booking_email,
            booking.contactEmail,
            f"🔔 [TableNow] Yêu cầu đặt bàn của Quý khách tại {restaurant_name} đã được ghi nhận",
            email_content
        )

        if restaurant:
            notif = Notification(
                userId=restaurant.manager_id,
                title="Có đơn đặt bàn mới",
                message=f"Khách hàng {booking.contactName} vừa đặt bàn cho {booking.requestSeats} người lúc {booking.time} ngày {booking.date}.",
                type="new_booking",
                createdAt=datetime.now().isoformat(timespec="seconds")
            )
            session.add(notif)
            session.commit()

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
    if current_user.role == "manager":
        restaurant = session.exec(select(Restaurant).where(Restaurant.id == restaurant_id)).first()
        if not restaurant or restaurant.manager_id != current_user.userId:
            raise HTTPException(status_code=403, detail="Not authorized to view bookings for this restaurant")

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
def update_booking_by_id(
    booking_id: int,
    updated_booking: BookingUpdate,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
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
def confirm_booking(
    id: int,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])],
    assignedSeats: Optional[int] = None
):
    booking = session.exec(select(Booking).where(Booking.bookingId == id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin đặt bàn")

    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="Đơn đặt bàn này đã được xác nhận từ trước")

    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Không thể xác nhận đơn đặt bàn đã bị hủy")

    restaurant = session.exec(select(Restaurant).where(Restaurant.id == booking.restaurantId)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin nhà hàng")

    seats_to_assign = assignedSeats if assignedSeats is not None else booking.requestSeats

    # Kiểm tra số ghế còn lại dựa trên capacity
    if restaurant.capacity < seats_to_assign:
        raise HTTPException(
            status_code=400,
            detail=f"Nhà hàng không đủ bàn trống. Sức chứa hiện tại: {restaurant.capacity} chỗ."
        )

    # Xác nhận booking
    booking.status = "confirmed"
    booking.assignedSeats = seats_to_assign

    # Giảm capacity của nhà hàng
    restaurant.capacity -= seats_to_assign

    session.commit()
    session.refresh(booking)
    session.refresh(restaurant)

    # Gửi email xác nhận
    if booking.contactEmail:
        email_content = (
            f"Kính gửi Quý khách {booking.contactName},\n\n"
            f"TableNow xin trân trọng thông báo: Yêu cầu đặt bàn của Quý khách đã được nhà hàng {restaurant.name} CHÍNH THỨC XÁC NHẬN thành công!\n\n"
            f"Chúng tôi vô cùng háo hức được đồng hành cùng Quý khách trong trải nghiệm ẩm thực sắp tới. Thông tin chi tiết bàn đặt của Quý khách như sau:\n\n"
            f"--------------------------------------------------\n"
            f"✨ THÔNG TIN BÀN ĐẶT CHÍNH THỨC:\n"
            f"--------------------------------------------------\n"
            f"• Mã đặt bàn: #{booking.bookingId}\n"
            f"• Nhà hàng: {restaurant.name}\n"
            f"• Địa chỉ: {restaurant.address}, {restaurant.district}\n"
            f"• Thời gian đón khách: {booking.time} - Ngày {booking.date}\n"
            f"• Số lượng khách: {booking.guestCount} người\n"
            f"• Số ghế đã chuẩn bị: {booking.assignedSeats or booking.requestSeats} ghế\n"
            f"--------------------------------------------------\n\n"
            f"💡 MỘT SỐ LƯU Ý DÀNH CHO QUÝ KHÁCH:\n"
            f"- Xin vui lòng đến đúng giờ để đảm bảo trải nghiệm dịch vụ chu đáo nhất. Nhà hàng sẽ giữ bàn cho Quý khách tối đa 15 phút so với giờ hẹn đặt bàn.\n"
            f"- Khi đến nhà hàng, Quý khách chỉ cần cung cấp Họ tên và Mã đặt bàn #{booking.bookingId} cho nhân viên tiếp tân để được dẫn tới vị trí bàn tiệc riêng tư đã chuẩn bị sẵn.\n\n"
            f"Chúc Quý khách có một bữa tiệc ấm cúng, trọn vẹn niềm vui và ngon miệng bên người thân và bạn bè tại {restaurant.name}!\n\n"
            f"Trân trọng,\n"
            f"Đội ngũ TableNow"
        )
        background_tasks.add_task(
            send_booking_email,
            booking.contactEmail,
            f"🎉 [TableNow] Xác nhận đặt bàn THÀNH CÔNG tại {restaurant.name} - Đơn #{booking.bookingId}",
            email_content
        )

    return {
        "message": "Booking confirmed successfully",
        "booking": booking.model_dump(),
        "restaurant_capacity": restaurant.capacity
    }


@router.put("/api/bookings/{id}/cancel", tags=["Booking"])
def cancel_booking(
    id: int,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: Annotated[User, Depends(get_current_user)]
):
    booking = session.exec(select(Booking).where(Booking.bookingId == id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")

    # Kiểm tra thời gian hủy (chỉ áp dụng giới hạn 2 tiếng đối với khách hàng tự hủy)
    if current_user.role == "customer":
        try:
            booking_datetime_str = f"{booking.date} {booking.time}"
            booking_datetime = (
                datetime.fromisoformat(booking_datetime_str)
                if 'T' in booking_datetime_str
                else datetime.strptime(booking_datetime_str, "%Y-%m-%d %H:%M")
            )
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

    restaurant = None
    if booking.status == "confirmed":
        restaurant = session.exec(select(Restaurant).where(Restaurant.id == booking.restaurantId)).first()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Trả lại ghế cho nhà hàng
        seats_to_restore = booking.assignedSeats if booking.assignedSeats and booking.assignedSeats > 0 else booking.requestSeats
        restaurant.capacity += seats_to_restore
        session.add(restaurant)

    # Hủy booking
    booking.status = "cancelled"
    session.commit()
    session.refresh(booking)

    # Gửi email huỷ
    if booking.contactEmail and restaurant:
        email_content = (
            f"Kính gửi Quý khách {booking.contactName},\n\n"
            f"TableNow xin xác nhận: Đơn đặt bàn #{booking.bookingId} của Quý khách tại {restaurant.name} vào lúc {booking.time} ngày {booking.date} đã được HUỶ thành công theo yêu cầu.\n\n"
            f"Chúng tôi rất tiếc vì lỡ hẹn với Quý khách trong dịp này. Mọi thông tin đặt chỗ của Quý khách tại nhà hàng đã được giải phóng trên hệ thống.\n\n"
            f"--------------------------------------------------\n"
            f"📌 THÔNG TIN ĐƠN ĐẶT BÀN ĐÃ HUỶ:\n"
            f"--------------------------------------------------\n"
            f"• Mã đặt bàn: #{booking.bookingId}\n"
            f"• Nhà hàng: {restaurant.name}\n"
            f"• Thời gian đã đặt: {booking.time} - Ngày {booking.date}\n"
            f"--------------------------------------------------\n\n"
            f"Nếu việc huỷ đặt bàn này là do sự thay đổi kế hoạch đột xuất, chúng tôi hy vọng sẽ có cơ hội được phục vụ Quý khách trong những dịp tụ họp tiếp theo.\n\n"
            f"Kính chúc Quý khách luôn có những kế hoạch vui tươi và tràn đầy hạnh phúc!\n\n"
            f"Trân trọng,\n"
            f"Đội ngũ TableNow"
        )
        background_tasks.add_task(
            send_booking_email,
            booking.contactEmail,
            f"❌ [TableNow] Thông báo huỷ đặt bàn #{booking.bookingId} thành công",
            email_content
        )

    return {
        "message": "Booking cancelled successfully",
        "booking": booking.model_dump()
    }


@router.put("/api/bookings/{id}/complete", tags=["Booking"])
def complete_booking(
    id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
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
    if booking.status == "confirmed":
        seats_to_restore = booking.assignedSeats if booking.assignedSeats and booking.assignedSeats > 0 else booking.requestSeats
        restaurant = session.exec(select(Restaurant).where(Restaurant.id == booking.restaurantId)).first()
        if restaurant:
            restaurant.capacity += seats_to_restore
            session.add(restaurant)

    booking.status = "completed"
    session.commit()
    session.refresh(booking)

    return {
        "message": "Booking completed successfully",
        "booking": booking.model_dump()
    }


@router.get("/api/restaurants/{restaurant_id}/fee-stats", tags=["Booking"])
def get_fee_stats(
    restaurant_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    restaurant = session.exec(select(Restaurant).where(Restaurant.id == restaurant_id)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if restaurant.manager_id != current_user.userId and current_user.role != "admin":
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
def pay_fees(
    restaurant_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]
):
    restaurant = session.exec(select(Restaurant).where(Restaurant.id == restaurant_id)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if restaurant.manager_id != current_user.userId and current_user.role != "admin":
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
