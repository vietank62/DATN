from typing import Optional
from sqlmodel import SQLModel, Field, Column, ARRAY, Text  # type: ignore

class CustomerPreference(SQLModel, table=True):
    __tablename__ = "customer_preferences"
    user_id: Optional[int] = Field(default=None, primary_key=True)
    categories: list[str] = Field(default_factory=list, sa_column=Column(ARRAY(Text), nullable=False))
    suitable_for: list[str] = Field(default_factory=list, sa_column=Column(ARRAY(Text), nullable=False))
    service_types: list[str] = Field(default_factory=list, sa_column=Column(ARRAY(Text), nullable=False))
    price_level: Optional[int] = Field(default=None, ge=1, le=5)
    city: Optional[str] = Field(default=None, max_length=100)
    updated_at: Optional[str] = None
