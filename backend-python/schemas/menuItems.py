from typing import List, Optional
from pydantic import BaseModel, Field

class MenuItemBase(BaseModel):
    id: int
    restaurant_id: int
    name: str = Field(max_length=255)
    category: str = Field(max_length=255)
    price: float = Field(default=0)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: bool = Field(default=True)
    
class MenuItemCreate(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(max_length=255)
    price: float = Field(default=0)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=500)
    is_available: bool = Field(default=True)
