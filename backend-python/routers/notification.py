from fastapi import APIRouter, Depends
from typing import Annotated
from database import SessionDep
from models import Notification, User, Booking, Restaurant
from sqlmodel import select, Session # type: ignore
from routers.authentication import get_current_user
import asyncio
from datetime import datetime
from database import engine
from routers.booking import send_booking_email

router = APIRouter()


@router.get("/api/notifications/", tags=["Notification"])
def get_notifications(session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    notifications = session.exec(
        select(Notification)
        .where(Notification.userId == current_user.userId)
        .order_by(Notification.id.desc())
        .limit(50)
    ).all()
    return notifications


@router.put("/api/notifications/{notification_id}/read", tags=["Notification"])
def mark_notification_read(notification_id: int, session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    notification = session.exec(
        select(Notification).where(Notification.id == notification_id, Notification.userId == current_user.userId)
    ).first()
    if notification:
        notification.isRead = True
        session.commit()
        return {"success": True}
    return {"success": False, "message": "Not found"}


@router.put("/api/notifications/read-all", tags=["Notification"])
def mark_all_notifications_read(session: SessionDep, current_user: Annotated[User, Depends(get_current_user)]):
    notifications = session.exec(
        select(Notification).where(Notification.userId == current_user.userId, Notification.isRead == False)
    ).all()
    for notif in notifications:
        notif.isRead = True
        session.add(notif)
    session.commit()
    return {"success": True}


async def auto_cancel_and_notify_loop():
    """Background loop: auto-cancel expired pending bookings and send notifications."""
    while True:
        try:
            now = datetime.now()
            with Session(engine) as session:
                pending_bookings = session.exec(select(Booking).where(Booking.status == "pending")).all()
                for booking in pending_bookings:
                    try:
                        booking_dt_str = f"{booking.date} {booking.time}"
                        booking_dt = (
                            datetime.fromisoformat(booking_dt_str)
                            if 'T' in booking_dt_str
                            else datetime.strptime(booking_dt_str, "%Y-%m-%d %H:%M")
                        )
                        minutes_diff = (booking_dt - now).total_seconds() / 60.0

                        restaurant = session.exec(select(Restaurant).where(Restaurant.id == booking.restaurantId)).first()
                        if not restaurant:
                            continue
                        manager_id = restaurant.manager_id

                        # 30 minutes before -> send expiry warning
                        if 0 < minutes_diff <= 30:
                            existing = session.exec(
                                select(Notification)
                                .where(Notification.userId == manager_id)
                                .where(Notification.type == f"expiring_{booking.bookingId}")
                            ).first()
                            if not existing:
                                session.add(Notification(
                                    userId=manager_id,
                                    title="Đơn đặt bàn sắp hết hạn",
                                    message=f"Đơn #{booking.bookingId} của {booking.contactName} vào lúc {booking.time} sắp tới giờ.",
                                    type=f"expiring_{booking.bookingId}",
                                    createdAt=now.isoformat(timespec="seconds")
                                ))
                                session.commit()

                        # Overdue by 30 minutes -> auto-cancel
                        if minutes_diff <= -30:
                            booking.status = "cancelled"
                            session.add(booking)
                            session.add(Notification(
                                userId=manager_id,
                                title="Đơn đã tự động huỷ",
                                message=f"Đơn #{booking.bookingId} của {booking.contactName} đã bị huỷ tự động do quá hạn 30 phút.",
                                type="system",
                                createdAt=now.isoformat(timespec="seconds")
                            ))
                            session.commit()

                            if booking.contactEmail:
                                content = (
                                    f"Kính gửi Quý khách {booking.contactName},\n\n"
                                    f"Yêu cầu đặt bàn #{booking.bookingId} tại {restaurant.name} lúc {booking.time} ngày {booking.date} "
                                    f"đã bị tự động huỷ do quá hạn 30 phút.\n\n"
                                    f"Trân trọng,\nĐội ngũ TableNow"
                                )
                                asyncio.create_task(asyncio.to_thread(
                                    send_booking_email,
                                    booking.contactEmail,
                                    f"⚠️ [TableNow] Tự động huỷ đơn #{booking.bookingId}",
                                    content
                                ))
                    except Exception as e:
                        print(f"Error processing booking {booking.bookingId}: {e}")
        except Exception as e:
            print(f"Background task error: {e}")
        await asyncio.sleep(300)  # Run every 5 minutes
