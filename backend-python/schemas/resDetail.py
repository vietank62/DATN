from typing import List, Optional
from pydantic import BaseModel, Field

class RestaurantDetailCreate(BaseModel):
    restaurant_id: int 
    image_urls: Optional[List[str]] = None
    image_menu: Optional[List[str]] = None
    price_range: Optional[str] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None
    opening_time: Optional[List[str]] = None
    parking_info: Optional[str] = None
    utilities: Optional[List[int]] = None
    regulations: Optional[str] = None