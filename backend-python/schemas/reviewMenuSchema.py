from typing import Optional
from pydantic import BaseModel, field_validator

class ReviewCreate(BaseModel):
    bookingId: int
    userId: int
    restaurantId: int
    rating: int
    comment: Optional[str] = None
    @field_validator("rating")
    @classmethod
    def rating_range(cls, value: int) -> int:
        if value < 1 or value > 5: raise ValueError("Đánh giá phải từ 1 đến 5 sao")
        return value
    @field_validator("comment")
    @classmethod
    def comment_length(cls, value: Optional[str]) -> Optional[str]:
        value = value.strip() if value else None
        if value and len(value) > 1000: raise ValueError("Bình luận tối đa 1000 ký tự")
        return value
class ReviewOut(BaseModel):
    reviewId: int; userId: int; restaurantId: int; bookingId: Optional[int] = None; rating: int; comment: Optional[str] = None; createdAt: Optional[str] = None; userName: Optional[str] = None; userAvatar: Optional[str] = None
    class Config: from_attributes = True
class MenuItemCreate(BaseModel):
    restaurantId: int; name: str; description: Optional[str] = None; price: float; image: Optional[str] = None; available: bool = True; category: Optional[str] = None
class MenuItemUpdate(BaseModel):
    name: Optional[str] = None; description: Optional[str] = None; price: Optional[float] = None; image: Optional[str] = None; available: Optional[bool] = None; category: Optional[str] = None
