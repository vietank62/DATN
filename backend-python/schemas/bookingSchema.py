from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator  # type: ignore


class BookingItemCreate(BaseModel):
    itemId: int
    quantity: int = Field(default=1, ge=1)


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
    depositAmount: int = 0
    depositStatus: str = "not_required"
    depositPaidAt: Optional[str] = None
    depositExpiresAt: Optional[str] = None
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
    guestCount: int = Field(ge=1)
    childCount: int = Field(default=0, ge=0)
    requestSeats: int = Field(ge=1)
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    items: list[BookingItemCreate] = []


    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")

    @field_validator("time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        return datetime.strptime(value, "%H:%M").strftime("%H:%M")


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
