from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel, create_engine, Column, ARRAY, INTEGER, Index, Text # type: ignore
from sqlalchemy import text # type: ignore
from .user import User
from .menuItem import RestaurantMenuList
from .resDetail import RestaurantDetail
class Restaurant(SQLModel, table=True):
    __tablename__ = "restaurants"

    id: Optional[int] = Field(default=None, primary_key=True, index=True)
    name: str = Field(max_length=255, nullable=False)
    slug: str = Field(max_length=255, unique=True, nullable=False)
    image_url: str = Field(default=None, sa_column=Column(Text))
    address: str = Field(max_length=500, nullable=False)
    district: str = Field(max_length=100, nullable=False, index=True)
    city: Optional[str] = Field(default=None, max_length=100, nullable=True)
    price_avg: int = Field(default=0, index=True)
    rating: float = Field(default=0.0, index=True)
    review_count: int = Field(default=0, index=True)
    like_count: int = Field(default=0, index=True)
    has_exclusive: bool = Field(default=False, index=True)
    category: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    suitable_for: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    service_types: List[str] = Field(default=None, sa_column=Column(ARRAY(Text)))
    capacity: int = Field(default=0, index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow, 
        sa_column_kwargs={"server_default": text("CURRENT_TIMESTAMP")}
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column_kwargs={"onupdate": text("CURRENT_TIMESTAMP")}
    )
    manager_id: Optional[int] = Field(default=None, foreign_key="user.userId", unique=True, nullable=True)
    manager: Optional["User"] = Relationship(back_populates="restaurant")
    detail: Optional["RestaurantDetail"] = Relationship(back_populates="restaurant", sa_relationship_kwargs={"uselist": False})
    menus: List["RestaurantMenuList"] = Relationship(back_populates="restaurant")
    