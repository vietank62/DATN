from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversations.id", index=True)
    sender_id: int = Field(foreign_key="user.userId", index=True)
    content: str = Field(max_length=2000)
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
