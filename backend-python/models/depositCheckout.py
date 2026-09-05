"""One gateway invoice per checkout attempt; booking deposit totals stay separate."""
from typing import Optional
from sqlmodel import SQLModel, Field #type: ignore


class DepositCheckout(SQLModel, table=True):
    __tablename__ = "deposit_checkouts"
    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", index=True)
    invoice_number: str = Field(unique=True, index=True, max_length=80)
    amount: int
    created_at: str
    expires_at: str
    status: str = Field(default="pending", index=True, max_length=30)
    gateway_transaction_id: Optional[str] = Field(default=None, unique=True)
    paid_at: Optional[str] = None
    received_amount: Optional[str] = None
    review_reason: Optional[str] = None
    cancellation_synced: bool = Field(default=False)

    cancel_attempts: int = Field(default=0)
    next_cancel_at: Optional[str] = Field(default=None, index=True)
