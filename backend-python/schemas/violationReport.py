from pydantic import BaseModel, Field


class ViolationReportCreate(BaseModel):
    booking_id: int
    reason: str = Field(min_length=10, max_length=3000)
    evidence_urls: list[str] = Field(default_factory=list, max_length=10)


class ViolationAppealCreate(BaseModel):
    reason: str = Field(min_length=10, max_length=3000)
    evidence_urls: list[str] = Field(default_factory=list, max_length=10)


class ViolationReviewCreate(BaseModel):
    approved: bool
    admin_note: str = Field(min_length=3, max_length=3000)
