from typing import Optional
from pydantic import BaseModel, Field

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None
    scopes: list[str] | None = None
    
class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    
class UserOut(BaseModel):
    userId: int
    name: str
    email: str
    phone: str
    role: str
    avatar: Optional[str] = None
    createdAt: Optional[str] = None
    
class RestaurantCreate(BaseModel):
    name: str
    address: str
    district: str
    cuisine: str
    priceRange: str
    rating: float = 0.0
    reviewCount: int = 0
    imageUrl: Optional[str] = None
    description: Optional[str] = None
    openTime: str  
    closeTime: str
    featured: bool = False
    phone: str
    totalSeats: int
    availableSeats: int
    managerID: int

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    cuisine: Optional[str] = None
    priceRange: Optional[str] = None
    rating: Optional[float] = None
    reviewCount: Optional[int] = None
    imageUrl: Optional[str] = None
    description: Optional[str] = None
    openTime: Optional[str] = None  
    closeTime: Optional[str] = None
    featured: Optional[bool] = None
    phone: Optional[str] = None
    totalSeats: Optional[int] = None
    availableSeats: Optional[int] = None
    managerID: Optional[int] = None
    
class MenuItemCreate(BaseModel):
    restaurantId: int
    name: str 
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    category: Optional[str] = None
    
class MenuItemUpdate(BaseModel):
    restaurantId: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    available: Optional[bool] = None
    category: Optional[str] = None
    
class BookingCreate(BaseModel):
    userId: int
    restaurantId: int
    date : str
    time : str
    guestCount: int
    requestSeats: int
    assignedSeats: int = 0
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    
class BookingUpdate(BaseModel):
    date : Optional[str] = None
    time : Optional[str] = None
    guestCount: Optional[int] = None
    requestSeats: Optional[int] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None

class ManagerStats(BaseModel):
    totalBookings: int
    todayBookings: int
    totalRevenue: float
    avgRating: float
    pendingBookings: int
    confirmedBookings: int

class AdminStats(BaseModel):
    totalRestaurants: int
    totalUsers: int
    totalBookings: int
    totalRevenue: float
    activeRestaurants: int
    newUsersThisMonth: int