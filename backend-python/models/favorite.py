from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship # type: ignore

if TYPE_CHECKING:
    from .user import User
    from .restaurant import Restaurant
    
class Favorite(SQLModel, table=True):
    __tablename__ = "favorite"
    
    userId: int = Field(foreign_key="user.userId", primary_key=True)
    restaurantId: int = Field(foreign_key="restaurants.id", primary_key=True)
    createdAt: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    user: Optional["User"] = Relationship(back_populates="favorite")
    restaurant: Optional["Restaurant"] = Relationship(back_populates="favorite")
