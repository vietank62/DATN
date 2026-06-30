from typing import Optional
from pydantic import BaseModel  # type: ignore


class BookingCreate(BaseModel):
    userId: int
    restaurantId: int
    date: str
    time: str
    guestCount: int
    requestSeats: int
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None


class BookingUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    guestCount: Optional[int] = None
    requestSeats: Optional[int] = None
    assignedSeats: Optional[int] = None
    status: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    note: Optional[str] = None
    isPaid: Optional[bool] = None
