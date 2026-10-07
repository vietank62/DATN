"""Shared notification helper for events that require administrator attention."""
from datetime import datetime, timezone

from sqlmodel import select

from models.notification import Notification
from models.user import User


def notify_admins(session, *, title: str, message: str, notification_type: str = "system", booking_id: int | None = None) -> int:
    """Queue an in-app notification for every active administrator.

    The caller owns the transaction, so this helper never commits on its own.
    """
    admins = session.exec(
        select(User).where(User.role == "admin", User.is_suspended.is_(False))
    ).all()
    created_at = datetime.now(timezone.utc).isoformat()
    for admin in admins:
        if admin.userId is None:
            continue
        session.add(Notification(
            userId=admin.userId,
            bookingId=booking_id,
            title=title,
            message=message,
            type=notification_type,
            createdAt=created_at,
        ))
    return len(admins)
