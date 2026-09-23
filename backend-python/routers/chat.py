from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, field_validator
from sqlmodel import select, or_  # type: ignore
from database import SessionDep
from models import User, Restaurant, Notification
from models.chatMessage import ChatMessage
from routers.deps import get_current_user

router = APIRouter(prefix="/v1/chat", tags=["Chat"])
class MessageCreate(BaseModel):
    content: str
    recipientId: Optional[int] = None
    @field_validator("content")
    @classmethod
    def content_valid(cls, value: str) -> str:
        value = value.strip()
        if not value or len(value) > 2000: raise ValueError("Tin nhắn phải có từ 1 đến 2000 ký tự")
        return value

def access_restaurant(session, restaurant_id, user):
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant: raise HTTPException(status_code=404, detail="Không tìm thấy nhà hàng")
    if user.role == "admin" or restaurant.manager_id == user.userId: return restaurant, True
    return restaurant, False

@router.get("/restaurants/{restaurant_id}/messages")
def list_messages(restaurant_id: int, participant_id: Optional[int] = None, session: SessionDep = None, current_user: Annotated[User, Security(get_current_user)] = None):
    restaurant, is_manager = access_restaurant(session, restaurant_id, current_user)
    other_id = participant_id if is_manager else restaurant.manager_id
    if not other_id: return []
    if is_manager and not participant_id: raise HTTPException(status_code=400, detail="Quản lý cần chọn khách hàng để xem hội thoại")
    rows = session.exec(select(ChatMessage).where(ChatMessage.restaurantId == restaurant_id, or_((ChatMessage.senderId == current_user.userId) & (ChatMessage.recipientId == other_id), (ChatMessage.senderId == other_id) & (ChatMessage.recipientId == current_user.userId))).order_by(ChatMessage.id.asc())).all()
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        if row.recipientId == current_user.userId and not row.readAt: row.readAt = now; session.add(row)
    session.commit()
    return rows

@router.post("/restaurants/{restaurant_id}/messages")
def send_message(restaurant_id: int, payload: MessageCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user)]):
    restaurant, is_manager = access_restaurant(session, restaurant_id, current_user)
    recipient_id = payload.recipientId if is_manager else restaurant.manager_id
    if not recipient_id or recipient_id == current_user.userId: raise HTTPException(status_code=400, detail="Không xác định được người nhận")
    recipient = session.get(User, recipient_id)
    if not recipient: raise HTTPException(status_code=404, detail="Không tìm thấy người nhận")
    now = datetime.now(timezone.utc).isoformat()
    message = ChatMessage(restaurantId=restaurant_id, senderId=current_user.userId, recipientId=recipient_id, content=payload.content, createdAt=now)
    session.add(message)
    session.add(Notification(userId=recipient_id, title="Tin nhắn mới", message=f"Bạn có tin nhắn mới về {restaurant.name}", type="chat_message", createdAt=now))
    session.commit(); session.refresh(message)
    return message
