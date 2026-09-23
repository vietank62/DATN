from typing import Optional
from sqlmodel import SQLModel, Field  # type: ignore
class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurants.id", index=True)
    senderId: int = Field(foreign_key="user.userId", index=True)
    recipientId: int = Field(foreign_key="user.userId", index=True)
    content: str
    createdAt: str
    readAt: Optional[str] = None
