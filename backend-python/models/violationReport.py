from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import ARRAY, Field, SQLModel  # type: ignore


class ViolationReport(SQLModel, table=True):
    __tablename__ = "violation_reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", index=True)
    reporter_id: int = Field(foreign_key="user.userId", index=True)
    target_user_id: Optional[int] = Field(default=None, foreign_key="user.userId", index=True)
    target_restaurant_id: Optional[int] = Field(default=None, foreign_key="restaurants.id", index=True)
    target_type: str = Field(max_length=20, index=True)
    source: str = Field(default="customer_report", max_length=30)
    reason: str = Field(sa_column=Column(Text, nullable=False))
    evidence_urls: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    status: str = Field(default="open", max_length=30, index=True)
    appeal_reason: Optional[str] = Field(default=None, sa_column=Column(Text))
    appeal_evidence_urls: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    admin_id: Optional[int] = Field(default=None, foreign_key="user.userId")
    admin_note: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = Field(default=None)
