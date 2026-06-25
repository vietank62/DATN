
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class RestaurantCreate(BaseModel):
    name: str
    slug: str
    image_url: Optional[List[str]] = None
    address: str
    district: str
    city: Optional[str] = None
    price_avg: int = 0
    category: Optional[List[str]] = None
    suitable_for: Optional[List[str]] = None
    service_types: Optional[List[str]] = None
    capacity: int = 0
    manager_id: int
    
class RestaurantBase(BaseModel):
    id: int
    name: str
    slug: str
    image_url: Optional[List[str]] = None
    address: str
    district: str
    city: Optional[str] = None
    price_avg: int = 0
    rating: Optional[float] = None
    like_count: Optional[int] = None
    has_exclusive: Optional[bool] = None
    category: Optional[List[str]] = None
    suitable_for: Optional[List[str]] = None
    service_types: Optional[List[str]] = None
    capacity: int = 0
    is_active: bool
    created_at: datetime