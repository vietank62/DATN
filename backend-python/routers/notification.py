from typing import Annotated

from fastapi import APIRouter, HTTPException, Security
from sqlmodel import select  # type: ignore

from database import SessionDep
from models.notification import Notification
from models.user import User
from routers.deps import get_current_user


router = APIRouter(prefix="/v1/notifications", tags=["Notification"])


@router.get("/me", response_model=list[Notification])
def get_my_notifications(
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
    limit: int = 20,
):
    return session.exec(
        select(Notification)
        .where(Notification.userId == current_user.userId)
        .order_by(Notification.id.desc())
        .limit(min(max(limit, 1), 50))
    ).all()


@router.put("/read-all", response_model=dict)
def mark_all_notifications_read(
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
):
    notifications = session.exec(
        select(Notification).where(
            Notification.userId == current_user.userId,
            Notification.isRead == False,
        )
    ).all()

    for notification in notifications:
        notification.isRead = True
        session.add(notification)

    session.commit()
    return {"updated": len(notifications)}


@router.put("/{notification_id}/read", response_model=Notification)
def mark_notification_read(
    notification_id: int,
    current_user: Annotated[User, Security(get_current_user)],
    session: SessionDep,
):
    notification = session.get(Notification, notification_id)

    if not notification or notification.userId != current_user.userId:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.isRead = True
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification
