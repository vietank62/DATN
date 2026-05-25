from typing import Optional, List
from sqlmodel import SQLModel, Field
from sqlalchemy import JSON

class User(SQLModel, table=True):
    userId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True)
    phone: str = Field(unique=True)
    password: str
    role: str = Field(default="customer")
    avatar: Optional[str] = None
    createdAt: Optional[str] = None

class Restaurant(SQLModel, table=True):
    restaurantId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    address: str
    district: str
    cuisine: List[str] = Field(default=[], sa_type=JSON)  # Mảng các loại ẩm thực (VD: ["Việt Nam", "Hải sản"])
    imageUrl: Optional[List[str]] = Field(default=None, sa_type=JSON)  # Mảng các đường dẫn ảnh
    description: Optional[str] = None
    openTime: str  
    closeTime: str
    phone: str
    featured: bool = Field(default=False)
    totalSeats: int
    availableSeats: int
    managerID : int = Field(foreign_key="user.userId")
    status: str = Field(default="pending") # pending, active, rejected
    businessLicenseUrl: Optional[str] = None
    taxId: Optional[str] = None
    rating: float = Field(default=0.0)
    reviewCount: int = Field(default=0)
    priceRange: str = Field(default="Chưa cập nhật")
    promotion: Optional[str] = Field(default=None)



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
    assignedSeats: int = Field(default=0)
    status: str = Field(default="pending")
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    createdAt: Optional[str] = None
    isPaid: bool = Field(default=False)

class Review(SQLModel, table=True):
    reviewId: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    restaurantId: int = Field(foreign_key="restaurant.restaurantId")
    rating: int 
    comment: Optional[str] = None
    createdAt: Optional[str] = None

class Payment(SQLModel, table=True):
    paymentId: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurant.restaurantId")
    amount: float
    transactionCode: str = Field(unique=True, index=True)
    status: str = Field(default="pending")
    createdAt: str
    paidAt: Optional[str] = None
    bookingIds: Optional[str] = None
    sepayTransactionId: Optional[str] = None

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    userId: int = Field(foreign_key="user.userId")
    title: str
    message: str
    isRead: bool = Field(default=False)
    createdAt: str
    type: str = Field(default="system") # new_booking, expiring_booking, cancelled_booking