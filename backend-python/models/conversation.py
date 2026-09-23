from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore
from sqlalchemy import UniqueConstraint  # type: ignore


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "restaurant_id",
            name="uq_conversation_customer_restaurant",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="user.userId", index=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
