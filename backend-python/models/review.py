from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship  # type: ignore

if TYPE_CHECKING:
    from .user import User
    from .resModel import Restaurant


class Review(SQLModel, table=True):
    reviewId: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    restaurantId: int = Field(foreign_key="restaurants.id")
    rating: int
    comment: Optional[str] = None
    createdAt: Optional[str] = None

    user: Optional["User"] = Relationship()
    restaurant: Optional["Restaurant"] = Relationship()
