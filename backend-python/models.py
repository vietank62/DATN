from typing import Optional
from sqlmodel import SQLModel, Field

class User(SQLModel, table = True):
    userId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique = True)
    phone: str = Field(unique = True)
    password: str
    role : str = Field(default = "user")

class Restaurant(SQLModel, table=True):
    restaurantId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    address: str
    district: str
    cuisine: str
    priceRange: str
    rating: float
    reviewCount: int
    imageUrl: Optional[str] = None
    openTime: str  
    closeTime: str
    phone: str
    featured: bool = Field(default=False)

class MenuItem(SQLModel, table=True):
    itemId: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurant.restaurantId")
    name: str 
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    available: bool = Field(default=True)
    category: Optional[str] = None 
