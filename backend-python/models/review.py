from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, Text
from sqlmodel import ARRAY, SQLModel, Field, Relationship  # type: ignore

if TYPE_CHECKING:
    from .user import User
    from .restaurant import Restaurant


class Review(SQLModel, table=True):
    reviewId: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    restaurantId: int = Field(foreign_key="restaurants.id")
    bookingId: Optional[int] = Field(default=None, foreign_key="booking.bookingId", unique=True)
    rating: int
    comment: Optional[str] = None
    image_urls: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    createdAt: Optional[str] = None

    user: Optional["User"] = Relationship()
    restaurant: Optional["Restaurant"] = Relationship()
