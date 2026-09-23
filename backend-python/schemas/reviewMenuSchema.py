from typing import Optional
from pydantic import BaseModel, Field  # type: ignore


class ReviewCreate(BaseModel):
    bookingId: int
    userId: int
    restaurantId: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ReviewOut(BaseModel):
    bookingId: Optional[int] = None
    reviewId: int
    userId: int
    restaurantId: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    createdAt: Optional[str] = None
    userName: Optional[str] = None
    userAvatar: Optional[str] = None

    class Config:
        from_attributes = True


class MenuItemCreate(BaseModel):
    restaurantId: int
    name: str
    description: Optional[str] = None
    price: float
    image: Optional[str] = None
    available: bool = True
    category: Optional[str] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    available: Optional[bool] = None
    category: Optional[str] = None
