from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship # type: ignore

if TYPE_CHECKING:
    from .resModel import Restaurant

class User(SQLModel, table=True):
    userId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True)
    phone: str = Field(unique=True)
    password: str
    role: str = Field(default="customer")
    avatar: Optional[str] = None
    createdAt: Optional[str] = None
    
    restaurant: Optional["Restaurant"] = Relationship(
        back_populates="manager",
        sa_relationship_kwargs={"uselist": False}
    )