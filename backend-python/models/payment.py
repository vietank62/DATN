from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship  # type: ignore

if TYPE_CHECKING:
    from .restaurant import Restaurant


class Payment(SQLModel, table=True):
    paymentId: Optional[int] = Field(default=None, primary_key=True)
    restaurantId: int = Field(foreign_key="restaurants.id")
    amount: float
    transactionCode: str = Field(unique=True, index=True)
    status: str = Field(default="pending")
    createdAt: str
    paidAt: Optional[str] = None
    bookingIds: Optional[str] = None
    sepayTransactionId: Optional[str] = None

    restaurant: Optional["Restaurant"] = Relationship()
