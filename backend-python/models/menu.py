from typing import Optional
from sqlmodel import SQLModel, Field # type: ignore

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