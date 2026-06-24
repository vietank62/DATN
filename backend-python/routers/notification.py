# from fastapi import APIRouter, Depends, Security
# from typing import Annotated
# from database import SessionDep
# from models import Notification, User, Booking, Restaurant
# from sqlmodel import select, Session
# from routers.authentication import get_current_user
# import asyncio
# from datetime import datetime
# from database import engine
# from routers.booking import send_booking_email

# router = APIRouter()

# @router.get("/api/notifications/", tags=["Notification"])
# def get_notifications(session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
#     notifications = session.exec(
#         select(Notification)
#         .where(Notification.userId == current_user.userId)
#         .order_by(Notification.id.desc())
#         .limit(50)
#     ).all()
#     return notifications

# @router.put("/api/notifications/{notification_id}/read", tags=["Notification"])
# def mark_notification_read(notification_id: int, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
#     notification = session.exec(select(Notification).where(Notification.id == notification_id, Notification.userId == current_user.userId)).first()
#     if notification:
#         notification.isRead = True
#         session.commit()
#         return {"success": True}
#     return {"success": False, "message": "Not found"}

# @router.put("/api/notifications/read-all", tags=["Notification"])
# def mark_all_notifications_read(session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
#     notifications = session.exec(select(Notification).where(Notification.userId == current_user.userId, Notification.isRead == False)).all()
#     for notif in notifications:
#         notif.isRead = True
#         session.add(notif)
#     session.commit()
#     return {"success": True}

# async def auto_cancel_and_notify_loop():
#     while True:
#         try:
#             now = datetime.now()
#             with Session(engine) as session:
#                 pending_bookings = session.exec(select(Booking).where(Booking.status == "pending")).all()
#                 for booking in pending_bookings:
#                     try:
#                         booking_datetime_str = f"{booking.date} {booking.time}"
#                         booking_dt = datetime.fromisoformat(booking_datetime_str) if 'T' in booking_datetime_str else datetime.strptime(booking_datetime_str, "%Y-%m-%d %H:%M")
                        
#                         time_diff = booking_dt - now
#                         minutes_diff = time_diff.total_seconds() / 60.0

#                         # Get restaurant manager
#                         restaurant = session.exec(select(Restaurant).where(Restaurant.restaurantId == booking.restaurantId)).first()
#                         if not restaurant:
#                             continue
                        
#                         manager_id = restaurant.managerID

#                         # 1. 30 phút trước giờ đặt bàn -> Gửi thông báo sắp hết hạn
#                         if 0 < minutes_diff <= 30:
#                             existing_notif = session.exec(
#                                 select(Notification)
#                                 .where(Notification.userId == manager_id)
#                                 .where(Notification.type == f"expiring_{booking.bookingId}")
#                             ).first()
#                             if not existing_notif:
#                                 notif = Notification(
#                                     userId=manager_id,
#                                     title="Đơn đặt bàn sắp hết hạn",
#                                     message=f"Đơn #{booking.bookingId} của {booking.contactName} vào lúc {booking.time} sắp tới giờ. Vui lòng kiểm tra và xác nhận.",
#                                     type=f"expiring_{booking.bookingId}",
#                                     createdAt=now.isoformat(timespec="seconds")
#                                 )
#                                 session.add(notif)
#                                 session.commit()

#                         # 2. Đã quá giờ đặt bàn 30 phút (grace period) -> Tự động huỷ
#                         if minutes_diff <= -30:
#                             booking.status = "cancelled"
#                             session.add(booking)
                            
#                             # Thông báo manager
#                             notif = Notification(
#                                 userId=manager_id,
#                                 title="Đơn đã tự động huỷ",
#                                 message=f"Đơn #{booking.bookingId} của {booking.contactName} đã bị huỷ tự động do quá hạn 30 phút.",
#                                 type="system",
#                                 createdAt=now.isoformat(timespec="seconds")
#                             )
#                             session.add(notif)
#                             session.commit()
                            
#                             # Gửi email cho khách
#                             if booking.contactEmail:
#                                 email_content = (
#                                     f"Kính gửi Quý khách {booking.contactName},\n\n"
#                                     f"TableNow xin trân trọng thông báo: Yêu cầu đặt bàn #{booking.bookingId} của Quý khách tại nhà hàng {restaurant.name} vào lúc {booking.time} ngày {booking.date} đã bị tự động huỷ trên hệ thống do quá hạn 30 phút so với giờ hẹn đặt bàn mà Quý khách chưa đến check-in.\n\n"
#                                     f"Để đảm bảo công bằng cho tất cả các khách hàng khác và quy trình vận hành bàn trống của nhà hàng, hệ thống bắt buộc phải giải phóng vị trí bàn đặt này.\n\n"
#                                     f"--------------------------------------------------\n"
#                                     f"📌 THÔNG TIN ĐƠN ĐẶT BÀN ĐÃ QUÁ HẠN:\n"
#                                     f"--------------------------------------------------\n"
#                                     f"• Mã đặt bàn: #{booking.bookingId}\n"
#                                     f"• Nhà hàng: {restaurant.name}\n"
#                                     f"• Thời gian hẹn ban đầu: {booking.time} - Ngày {booking.date}\n"
#                                     f"--------------------------------------------------\n\n"
#                                     f"Nếu Quý khách vẫn có nhu cầu dùng bữa tại nhà hàng, kính mong Quý khách vui lòng truy cập lại ứng dụng TableNow để đặt bàn mới hoặc liên hệ trực tiếp với hotline của nhà hàng để kiểm tra chỗ trống hiện tại.\n\n"
#                                     f"TableNow rất mong nhận được sự thông cảm sâu sắc từ Quý khách và hy vọng sẽ có cơ hội được hỗ trợ Quý khách chu đáo hơn trong những lần trải nghiệm tiếp theo.\n\n"
#                                     f"Chúc Quý khách một ngày tốt lành và bình an!\n\n"
#                                     f"Trân trọng,\n"
#                                     f"Đội ngũ TableNow"
#                                 )
#                                 # Không dùng background_tasks ở đây vì ngoài request, gọi hàm thẳng
#                                 asyncio.create_task(asyncio.to_thread(send_booking_email, booking.contactEmail, f"⚠️ [TableNow] Thông báo tự động huỷ đơn đặt bàn #{booking.bookingId} do quá hạn", email_content))
#                     except Exception as e:
#                         print(f"Error processing booking {booking.bookingId}: {e}")
#         except Exception as e:
#             print(f"Background task error: {e}")
        
#         await asyncio.sleep(300) # Chạy lại mỗi 5 phút
