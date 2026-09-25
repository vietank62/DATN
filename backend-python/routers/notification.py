import asyncio
import json
import time
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request, Security
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlmodel import Session, select  # type: ignore

from database import SessionDep, engine
from models.notification import Notification
from models.user import User
from routers.deps import get_current_user


router = APIRouter(prefix="/v1/notifications", tags=["Notification"])



def notification_snapshot(session: Session, user_id: int, limit: int = 10):
    items = session.exec(select(Notification).where(Notification.userId == user_id)
                         .order_by(Notification.id.desc()).limit(min(max(limit, 1), 50))).all()
    unread = session.exec(select(func.count(Notification.id)).where(
        Notification.userId == user_id, Notification.isRead == False)).one()
    return {"items": [item.model_dump(mode="json") for item in items], "unreadCount": unread}


def read_stream_snapshot(user_id: int):
    # Short, fresh transactions see commits from all workers and scheduled jobs.
    with Session(engine) as session:
        return notification_snapshot(session, user_id)


@router.get("/snapshot")
def get_notification_snapshot(
    current_user: Annotated[User, Security(get_current_user)], session: SessionDep,
):
    return notification_snapshot(session, current_user.userId)


@router.get("/stream")
def stream_notifications(
    request: Request,
    current_user: Annotated[User, Security(get_current_user)], session: SessionDep,
):
    user_id = current_user.userId
    session.close()  # Release the auth transaction before holding the stream open.

    async def events():
        previous = None
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline and not await request.is_disconnected():
            snapshot = await run_in_threadpool(read_stream_snapshot, user_id)
            payload = json.dumps(snapshot, ensure_ascii=False, sort_keys=True)
            if payload != previous:
                yield f"event: notifications\ndata: {payload}\n\n"
                previous = payload
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(1)

    # Reauthenticate on reconnect; bounded streams also tolerate worker restarts.
    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
    })


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
