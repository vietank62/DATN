from typing import Optional
from pydantic import BaseModel

class UserOut(BaseModel):
    userId: int
    name: str
    phone: str
    email: str
    role: str
    class Config:
        orm_mode = True


class MenuItemUpdate(BaseModel):
    restaurantId: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    available: Optional[bool] = None
    category: Optional[str] = None