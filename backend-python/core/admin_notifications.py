"""Notification helpers for administrator work queues."""
from datetime import datetime, timezone
from typing import Any

from sqlmodel import select

from models import Notification, User


def notify_admins(
    session: Any,
    *,
    title: str,
    message: str,
    notification_type: str,
    booking_id: int | None = None,
) -> None:
    """Queue the same actionable notification for every administrator."""
    admins = session.exec(select(User).where(User.role == "admin")).all()
    created_at = datetime.now(timezone.utc).isoformat()
    for admin in admins:
        session.add(
            Notification(
                userId=admin.userId,
                bookingId=booking_id,
                title=title,
                message=message,
                type=notification_type,
                createdAt=created_at,
            )
        )
