from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel, Column, ARRAY, Text, Integer # type: ignore

if TYPE_CHECKING:
    from .restaurant import Restaurant

class RestaurantDetail(SQLModel, table=True):
    __tablename__ = "restaurant_details"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", unique=True, nullable=False)
    image_urls: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    image_menu: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    price_range: Optional[str] = Field(default=None, max_length=50)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    opening_time: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    parking_info: Optional[str] = Field(default=None, max_length=255)
    utilities: Optional[List[int]] = Field(default=None, sa_column=Column(ARRAY(Integer)))
    
    restaurant: "Restaurant" = Relationship(back_populates="detail")