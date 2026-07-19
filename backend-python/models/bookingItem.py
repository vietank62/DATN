from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship # type: ignore

if TYPE_CHECKING:
    from .booking import Booking
    from .menuItem import RestaurantMenuList
    
class BookingItem(SQLModel, table=True):
    bookingItemId: Optional[int] = Field(default=None, primary_key=True)
    bookingId: int = Field(foreign_key="booking.bookingId")
    itemId: int = Field(foreign_key="restaurant_menu_lists.id")
    quantity: int = Field(default=1)
    price: float = Field(default=0.0) 
    
    booking: Optional["Booking"] = Relationship(back_populates="booking_items")