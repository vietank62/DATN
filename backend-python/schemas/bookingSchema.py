from typing import Optional
from pydantic import BaseModel  # type: ignore


class BookingItemCreate(BaseModel):
    itemId: int
    quantity: int = 1


class BookingItemOut(BaseModel):
    bookingItemId: int
    itemId: int
    quantity: int
    price: float
    name: str
    category: str
    image_url: Optional[str] = None
    description: Optional[str] = None


class BookingResponse(BaseModel):
    bookingId: int
    userId: int
    restaurantId: int
    restaurantName: Optional[str] = None
    date: str
    time: str
    guestCount: int
    childCount: int = 0
    requestSeats: int
    assignedSeats: int = 0
    status: str
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    createdAt: Optional[str] = None
    booking_items: list[BookingItemOut] = []


class BookingCreate(BaseModel):
    restaurantId: int
    date: str
    time: str
    guestCount: int
    childCount: int = 0
    requestSeats: int
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    items: list[BookingItemCreate] = []


class BookingUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    guestCount: Optional[int] = None
    childCount: Optional[int] = None
    requestSeats: Optional[int] = None
    assignedSeats: Optional[int] = None
    status: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    note: Optional[str] = None
