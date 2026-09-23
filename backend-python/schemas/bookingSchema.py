from datetime import datetime
from typing import Optional
import re
from pydantic import BaseModel, field_validator, model_validator  # type: ignore

PHONE_PATTERN = re.compile(r"^(?:\+84|0)(?:3|5|7|8|9)\d{8}$")

class BookingItemCreate(BaseModel):
    itemId: int
    quantity: int = 1
    @field_validator("quantity")
    @classmethod
    def valid_quantity(cls, value: int) -> int:
        if value < 1 or value > 99: raise ValueError("Số lượng món phải từ 1 đến 99")
        return value

class BookingItemOut(BaseModel):
    bookingItemId: int; itemId: int; quantity: int; price: float; name: str; category: str
    image_url: Optional[str] = None; description: Optional[str] = None

class BookingResponse(BaseModel):
    bookingId: int; userId: int; restaurantId: int; restaurantName: Optional[str] = None
    date: str; time: str; guestCount: int; requestSeats: int; assignedSeats: int = 0; status: str
    contactName: str; contactEmail: str; contactPhone: str; note: Optional[str] = None; createdAt: Optional[str] = None
    booking_items: list[BookingItemOut] = []

class BookingCreate(BaseModel):
    restaurantId: int
    date: str
    time: str
    guestCount: int
    requestSeats: int
    contactName: str
    contactEmail: str
    contactPhone: str
    note: Optional[str] = None
    items: list[BookingItemCreate] = []
    @field_validator("guestCount", "requestSeats")
    @classmethod
    def positive_capacity(cls, value: int) -> int:
        if value < 1 or value > 500: raise ValueError("Số lượng khách và chỗ ngồi phải từ 1 đến 500")
        return value
    @field_validator("contactName")
    @classmethod
    def name_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2: raise ValueError("Họ tên phải có ít nhất 2 ký tự")
        return value
    @field_validator("contactEmail")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value): raise ValueError("Email không hợp lệ")
        return value
    @field_validator("contactPhone")
    @classmethod
    def phone_valid(cls, value: str) -> str:
        value = re.sub(r"[ .-]", "", value.strip())
        if not PHONE_PATTERN.fullmatch(value): raise ValueError("Số điện thoại Việt Nam không hợp lệ")
        return value
    @model_validator(mode="after")
    def booking_consistent(self):
        if self.requestSeats < self.guestCount: raise ValueError("Số chỗ ngồi không được nhỏ hơn tổng số khách")
        try: datetime.strptime(f"{self.date} {self.time}", "%Y-%m-%d %H:%M")
        except ValueError as error: raise ValueError("Ngày hoặc giờ đến không hợp lệ") from error
        return self

class BookingUpdate(BaseModel):
    date: Optional[str] = None; time: Optional[str] = None; guestCount: Optional[int] = None; requestSeats: Optional[int] = None; assignedSeats: Optional[int] = None; status: Optional[str] = None; contactName: Optional[str] = None; contactEmail: Optional[str] = None; contactPhone: Optional[str] = None; note: Optional[str] = None
