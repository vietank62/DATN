from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship  # type: ignore

if TYPE_CHECKING:
    from .user import User
    from .resModel import Restaurant


class Booking(SQLModel, table=True):
    bookingId: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    restaurantId: int = Field(foreign_key="restaurants.id")
    date: str
    time: str
    guestCount: int
    requestSeats: int
    assignedSeats: int = Field(default=0)
    status: str = Field(default="pending")
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    createdAt: Optional[str] = None
    isPaid: bool = Field(default=False)

    user: Optional["User"] = Relationship()
    restaurant: Optional["Restaurant"] = Relationship()
