from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel, create_engine, Column, ARRAY, INTEGER, Index, Text # type: ignore
from sqlalchemy import text # type: ignore
from .user import User
from .menuItem import RestaurantMenuList
from .resDetail import RestaurantDetail
from .favorite import Favorite
class Restaurant(SQLModel, table=True):
    __tablename__ = "restaurants"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    name: str = Field(max_length=255, nullable=False)
    slug: str = Field(max_length=255, unique=True, nullable=False)
    image_url: Optional[str] = Field(default=None, max_length=500, nullable=True)
    address: str = Field(max_length=500, nullable=False)
    district: str = Field(max_length=100, nullable=False, index=True)
    city: Optional[str] = Field(default=None, max_length=100, nullable=True)
    latitude: Optional[float] = Field(default=None, nullable=True)
    longitude: Optional[float] = Field(default=None, nullable=True)
    price_avg: int = Field(default=0, index=True)
    rating: float = Field(default=0.0, index=True)
    review_count: int = Field(default=0, index=True)
    like_count: int = Field(default=0, index=True)
    has_exclusive: bool = Field(default=False, index=True)
    category: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    suitable_for: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    service_types: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    capacity: int = Field(default=0, index=True)
    cashier_payment_methods: List[str] = Field(default_factory=lambda: ["Tiền mặt", "Chuyển khoản", "ATM", "Apple Pay", "Visa"], sa_column=Column(ARRAY(Text), nullable=False))
    cashier_default_payment_method: str = Field(default="Tiền mặt", max_length=30)
    cashier_payment_method_options: List[str] = Field(default_factory=lambda: ["Tiền mặt", "Chuyển khoản", "ATM", "Apple Pay", "Visa"], sa_column=Column(ARRAY(Text), nullable=False))
    vat_enabled: bool = Field(default=True, nullable=False, sa_column_kwargs={"server_default": text("true")})
    menu_prices_visible: bool = Field(default=True, nullable=False, sa_column_kwargs={"server_default": text("true")})
    is_active: bool = Field(default=True)
    is_report_suspended: bool = Field(default=False)
    late_response_strikes: int = Field(default=0)
    approval_status: str = Field(default="approved", max_length=20, index=True)
    pending_approval_fields: Optional[List[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(Text)),
    )
    business_license_url: Optional[str] = Field(default=None, max_length=500)
    business_license_urls: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    tax_code: Optional[str] = Field(default=None, max_length=50)
    legal_documents_url: Optional[str] = Field(default=None, max_length=500)
    legal_documents_urls: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    policy_accepted_at: Optional[datetime] = Field(default=None)
    booking_opening_time: Optional[str] = Field(default=None, max_length=5)
    booking_lead_minutes: int = Field(default=120, nullable=False, sa_column_kwargs={"server_default": text("120")})
    booking_confirmation_minutes: int = Field(default=60, nullable=False, sa_column_kwargs={"server_default": text("60")})
    booking_hold_minutes: int = Field(default=30, ge=1, le=240, nullable=False, sa_column_kwargs={"server_default": text("30")})
    booking_duration_minutes: int = Field(default=120, ge=1, nullable=False, sa_column_kwargs={"server_default": text("120")})
    booking_closing_time: Optional[str] = Field(default=None, max_length=5)
    created_at: datetime = Field(
        default_factory=datetime.utcnow, 
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")}
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column_kwargs={"onupdate": text("CURRENT_TIMESTAMP")}
    )
    manager_id: Optional[int] = Field(default=None, foreign_key="user.userId", unique=True, nullable=True)
    website_url: Optional[str] = Field(default=None, max_length=500, nullable=True)
    manager: Optional["User"] = Relationship(back_populates="restaurant")
    detail: Optional["RestaurantDetail"] = Relationship(back_populates="restaurant", sa_relationship_kwargs={"uselist": False})
    menus: List["RestaurantMenuList"] = Relationship(back_populates="restaurant")
    favorite: List["Favorite"] = Relationship(back_populates="restaurant")
    
