from typing import Optional
from sqlmodel import SQLModel, Field

class BookingFee(SQLModel, table=True):
    __tablename__ = "booking_fees"
    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", unique=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    amount: int
    due_at: str
    settled_amount: int = Field(default=0)
    deducted_amount: int = Field(default=0)
    reminder_month: Optional[str] = None
    proof_url: Optional[str] = None
