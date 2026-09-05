from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore


class DepositPayment(SQLModel, table=True):
    """A customer's SePay payment for one booking deposit."""

    __tablename__ = "deposit_payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", unique=True, index=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    user_id: int = Field(foreign_key="user.userId", index=True)
    amount: int
    transaction_code: str = Field(unique=True, index=True)
    status: str = Field(default="pending", max_length=20, index=True)
    created_at: str
    paid_at: Optional[str] = None
    sepay_transaction_id: Optional[str] = Field(default=None, unique=True)
