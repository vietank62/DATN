from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel, Column, ARRAY, Text # type: ignore

if TYPE_CHECKING:
    from .resModel import Restaurant

class RestaurantMenuList(SQLModel, table=True):
    __tablename__ = "restaurant_menu_lists"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", nullable=False)
    dish_name: str = Field(max_length=255, nullable=False)
    price: int = Field(default=0, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: bool = Field(default=True, index=True) 
    
    restaurant: "Restaurant" = Relationship(back_populates="menus")