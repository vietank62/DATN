from pydantic import BaseModel
from typing import Optional

class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: Optional[str] = "customer"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    
class UserOut(BaseModel):
    userId: int
    name: str
    email: str
    phone: str
    role: str
    avatar: Optional[str] = None
    createdAt: Optional[str] = None