from pydantic import BaseModel, Field
from typing import Optional, Literal


class PartnerGeocodeRequest(BaseModel):
    address: str = Field(min_length=5, max_length=500)
    district: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)


class PartnerApplicationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: str = Field(min_length=5, max_length=500)
    district: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    website_url: Optional[str] = Field(default=None, max_length=500)
    category: list[str] = Field(min_length=1)
    image_url: str = Field(min_length=1, max_length=500)
    image_urls: Optional[list[str]] = None
    business_license_url: Optional[str] = None
    business_license_urls: Optional[list[str]] = None
    tax_code: str = Field(min_length=5, max_length=50)
    legal_documents_url: Optional[str] = None
    legal_documents_urls: Optional[list[str]] = None
    policy_accepted: bool


class PartnerOperationalUpdate(BaseModel):
    service_types: list[Literal["phuc-vu-tai-ban", "tu-phuc-vu", "quay-line", "bang-chuyen", "omakase"]] | None = Field(default=None, max_length=5)
    suitable_for: list[Literal["tiec-hoi-nghi", "gia-dinh", "hien-dai", "truyen-thong", "sang-trong", "co-dien", "thien-nhien", "hen-ho", "sinh-nhat", "ban-be"]] | None = Field(default=None, max_length=10)
    phone_number: str | None = Field(default=None, max_length=20, pattern=r"^[+0-9\s().-]*$")
    zalo_number: str | None = Field(default=None, max_length=20, pattern=r"^[+0-9\s().-]*$")
    booking_lead_minutes: int | None = Field(default=None, ge=1, le=10080)
    booking_confirmation_minutes: int | None = Field(default=None, ge=0, le=10079)
    vat_enabled: bool | None = None
    menu_prices_visible: bool | None = None
    name: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    website_url: Optional[str] = None
    category: Optional[list[str]] = None
    tax_code: Optional[str] = None
    business_license_url: Optional[str] = None
    business_license_urls: Optional[list[str]] = None
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    legal_documents_urls: Optional[list[str]] = None
    price_avg: Optional[int] = Field(default=None, ge=0)
    price_range: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = None
    opening_time: Optional[list[str]] = None
    booking_opening_time: Optional[str] = None
    booking_closing_time: Optional[str] = None
    booking_duration_minutes: Optional[int] = Field(default=None, ge=30, le=480)
    parking_info: Optional[str] = None
    utilities: Optional[list[int]] = None
    regulations: Optional[str] = None
    requires_deposit: Optional[bool] = None
    deposit_amount: Optional[int] = Field(default=None, ge=0)
    deposit_min_guests: Optional[int] = Field(default=None, ge=1)


class PartnerRejectRequest(BaseModel):
    rejection_reason: str = Field(min_length=3, max_length=2000)
    deactivate: bool = True
