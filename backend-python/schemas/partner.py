from pydantic import BaseModel, Field
from typing import Optional


class PartnerApplicationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: str = Field(min_length=5, max_length=500)
    district: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    website_url: Optional[str] = Field(default=None, max_length=500)
    category: Optional[list[str]] = None
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    business_license_url: Optional[str] = None
    business_license_urls: Optional[list[str]] = None
    tax_code: str = Field(min_length=5, max_length=50)
    legal_documents_url: Optional[str] = None
    legal_documents_urls: Optional[list[str]] = None
    capacity: int = Field(gt=0)
    policy_accepted: bool


class PartnerOperationalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    website_url: Optional[str] = None
    category: Optional[list[str]] = None
    tax_code: Optional[str] = None
    business_license_url: Optional[str] = None
    business_license_urls: Optional[list[str]] = None
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    legal_documents_urls: Optional[list[str]] = None
    capacity: Optional[int] = None
    price_avg: Optional[int] = Field(default=None, ge=0)
    price_range: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None
    opening_time: Optional[list[str]] = None
    booking_opening_time: Optional[str] = None
    booking_closing_time: Optional[str] = None
    parking_info: Optional[str] = None
    utilities: Optional[list[int]] = None
    regulations: Optional[str] = None


class PartnerRejectRequest(BaseModel):
    rejection_reason: str = Field(min_length=3, max_length=2000)
    deactivate: bool = True
