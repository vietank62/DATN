from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore


class DepositRefund(SQLModel, table=True):
    """Refund queue created when a restaurant fails to respond in time."""

    __tablename__ = "deposit_refunds"

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", unique=True, index=True)
    deposit_payment_id: int = Field(foreign_key="deposit_payments.id", unique=True)
    customer_id: int = Field(foreign_key="user.userId", index=True)
    amount: int
    status: str = Field(default="pending", max_length=20, index=True)
    created_at: str
    refunded_at: Optional[str] = None
    proof_url: Optional[str] = None
