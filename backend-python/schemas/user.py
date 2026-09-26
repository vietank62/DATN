import re
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


_VIETNAM_PHONE_PATTERN = re.compile(r"^(?:0(?:3|5|7|8|9)\d{8}|(?:\+84|84)(?:3|5|7|8|9)\d{8})$")


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: Optional[str] = "customer"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized_phone = re.sub(r"[.\s-]", "", value.strip())
        if not _VIETNAM_PHONE_PATTERN.fullmatch(normalized_phone):
            raise ValueError("Số điện thoại Việt Nam không đúng định dạng")
        return normalized_phone


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    current_password: Optional[str] = None
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
    isSuspended: bool = False
    suspensionReason: Optional[str] = None
    appealStatus: Optional[str] = None


class SuspensionUpdate(BaseModel):
    suspended: bool
    reason: Optional[str] = None


class AppealCreate(BaseModel):
    explanation: str