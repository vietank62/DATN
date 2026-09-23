from typing import Annotated
from fastapi import APIRouter, HTTPException, Security
from sqlmodel import select
from database import SessionDep
from models import Notification, User
from routers.deps import get_current_user

router = APIRouter(prefix="/v1/notifications", tags=["Notification"])

@router.get("/")
def get_notifications(session: SessionDep, current_user: Annotated[User, Security(get_current_user)]):
    return session.exec(select(Notification).where(Notification.userId == current_user.userId).order_by(Notification.id.desc()).limit(50)).all()

@router.put("/{notification_id}/read")
def mark_notification_read(notification_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user)]):
    notification = session.get(Notification, notification_id)
    if not notification or notification.userId != current_user.userId: raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    notification.isRead = True; session.add(notification); session.commit()
    return {"success": True}

@router.put("/read-all")
def mark_all_notifications_read(session: SessionDep, current_user: Annotated[User, Security(get_current_user)]):
    for notification in session.exec(select(Notification).where(Notification.userId == current_user.userId, Notification.isRead == False)).all():
        notification.isRead = True; session.add(notification)
    session.commit()
    return {"success": True}
