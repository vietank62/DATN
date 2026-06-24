from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel, Column, ARRAY, Text # type: ignore

if TYPE_CHECKING:
    from .resModel import Restaurant

class RestaurantDetail(SQLModel, table=True):
    __tablename__ = "restaurant_details"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    
    restaurant_id: int = Field(foreign_key="restaurants.id", unique=True, nullable=False)

    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    opening_time: Optional[str] = Field(default=None, max_length=50)
    closing_time: Optional[str] = Field(default=None, max_length=50)
    parking_info: Optional[str] = Field(default=None, max_length=255)
    wifi_password: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, sa_column=Column(Text))

    restaurant: "Restaurant" = Relationship(back_populates="detail")