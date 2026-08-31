from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship # type: ignore
from typing import List

if TYPE_CHECKING:
    from .restaurant import Restaurant
    from .favorite import Favorite

class User(SQLModel, table=True):
    __tablename__ = "user"
    
    userId: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True)
    phone: str = Field(unique=True)
    password: str
    role: str = Field(default="customer")
    avatar: Optional[str] = None
    createdAt: Optional[str] = None
    report_strikes: int = Field(default=0)
    is_suspended: bool = Field(default=False)
    
    restaurant: Optional["Restaurant"] = Relationship(
        back_populates="manager",
        sa_relationship_kwargs={"uselist": False}
    )
    favorite: List["Favorite"] = Relationship(back_populates="user")
