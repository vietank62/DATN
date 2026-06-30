from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship  # type: ignore

if TYPE_CHECKING:
    from .user import User


class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    title: str
    message: str
    isRead: bool = Field(default=False)
    createdAt: str
    type: str = Field(default="system")  # new_booking, expiring_booking, cancelled_booking

    user: Optional["User"] = Relationship()
