from datetime import datetime, timezone
from typing import List, Optional

from sqlmodel import ARRAY, Column, Field, SQLModel, Text  # type: ignore


class ApprovalHistory(SQLModel, table=True):
    __tablename__ = "approval_histories"

    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    manager_id: int = Field(foreign_key="user.userId", index=True)
    admin_id: Optional[int] = Field(default=None, foreign_key="user.userId")
    action: str = Field(max_length=20, index=True)
    request_type: str = Field(max_length=20)
    change_fields: Optional[List[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(Text)),
    )
    rejection_reason: Optional[str] = Field(default=None, sa_column=Column(Text))
    deactivate_restaurant: Optional[bool] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
