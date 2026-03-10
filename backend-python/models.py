from typing import Optional
from sqlmodel import SQLModel, Field

class User(SQLModel, table = True):
    userId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique = True)
    phone: str = Field(unique = True)
    password: str
    role : str = Field(default = "customer")
    avatar: Optional[str] = None
    createdAt: Optional[str] = None

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
    description: Optional[str] = None
    openTime: str  
    closeTime: str
    phone: str
    featured: bool = Field(default=False)
    totalSeats: int
    availableSeats: int
    managerID : int = Field(foreign_key="user.userId")

class MenuItem(SQLModel, table=True):
    itemId: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurant.restaurantId")
    name: str 
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    available: bool = Field(default=True)
    category: Optional[str] = None 

class Booking(SQLModel, table=True):
    bookingId: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    restaurantId: int = Field(foreign_key="restaurant.restaurantId")
    date : str
    time : str
    guestCount: int
    requestSeats: int
    assignedSeats: int
    status: str = Field(default="pending")
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    createdAt: Optional[str] = None