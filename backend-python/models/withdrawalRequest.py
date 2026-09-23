from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore


class WithdrawalRequest(SQLModel, table=True):
    __tablename__ = "withdrawal_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    amount: int
    bank_name: str
    account_name: str
    account_number: str
    qr_image_url: Optional[str] = None
    status: str = Field(default="pending", max_length=20, index=True)
    requested_at: str
    processed_at: Optional[str] = None
    processed_by: Optional[int] = Field(default=None, foreign_key="user.userId")
    transfer_proof_url: Optional[str] = None
    admin_note: Optional[str] = None
