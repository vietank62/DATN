from typing import Optional
from sqlmodel import Field, SQLModel


class RestaurantTable(SQLModel, table=True):
    __tablename__ = "restaurant_tables"
    id: Optional[int] = Field(default=None, primary_key=True)
    restaurant_id: int = Field(foreign_key="restaurants.id", index=True)
    name: str = Field(max_length=60, index=True)
    seats: int = Field(ge=1, le=100)
    is_active: bool = Field(default=True)


class BookingTable(SQLModel, table=True):
    __tablename__ = "booking_tables"
    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="booking.bookingId", index=True)
    table_id: int = Field(foreign_key="restaurant_tables.id", index=True)
