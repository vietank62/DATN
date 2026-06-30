from typing import Optional
from sqlmodel import SQLModel, Field  # type: ignore


class MenuItem(SQLModel, table=True):
    itemId: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurants.id")
    name: str
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    available: bool = Field(default=True)
    category: Optional[str] = None