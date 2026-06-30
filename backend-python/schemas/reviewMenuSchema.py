from typing import Optional
from pydantic import BaseModel  # type: ignore


class ReviewCreate(BaseModel):
    userId: int
    restaurantId: int
    rating: int
    comment: Optional[str] = None


class ReviewOut(BaseModel):
    reviewId: int
    userId: int
    restaurantId: int
    rating: int
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
