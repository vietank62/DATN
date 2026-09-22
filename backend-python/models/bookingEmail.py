from typing import Optional
from sqlmodel import SQLModel, Field

class BookingEmail(SQLModel, table=True):
    __tablename__ = "booking_emails"
    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", index=True)
    event: str
    recipient: str
    subject: str
    body: str
    sent_at: Optional[str] = None
    attempts: int = Field(default=0)
    next_attempt_at: Optional[str] = None
