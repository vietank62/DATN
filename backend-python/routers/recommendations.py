from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, Field
from sqlmodel import select  # type: ignore
from database import SessionDep
from models import Restaurant, User
from models.customerPreference import CustomerPreference
from routers.deps import get_current_user
from core.public_restaurants import serialize_restaurant

router = APIRouter(prefix="/v1/recommendations", tags=["Recommendations"])

class PreferenceInput(BaseModel):
    categories: list[str] = Field(default_factory=list, max_length=8)
    suitable_for: list[str] = Field(default_factory=list, max_length=8)
    service_types: list[str] = Field(default_factory=list, max_length=8)
    price_level: int | None = Field(default=None, ge=1, le=5)
    city: str | None = Field(default=None, max_length=100)

def score_overlap(preferred: list[str], values: list[str] | None, weight: int) -> int:
    return weight if set(preferred).intersection(values or []) else 0

@router.get("/me")
def get_preference(current_user: Annotated[User, Security(get_current_user, scopes=["customer"])], session: SessionDep):
    return session.get(CustomerPreference, current_user.userId)

@router.put("/me")
def save_preference(data: PreferenceInput, current_user: Annotated[User, Security(get_current_user, scopes=["customer"])], session: SessionDep):
    preference = session.get(CustomerPreference, current_user.userId) or CustomerPreference(user_id=current_user.userId)
    for key, value in data.model_dump().items(): setattr(preference, key, value)
    preference.updated_at = datetime.now(timezone.utc).isoformat()
    session.add(preference); session.commit(); session.refresh(preference)
    return preference

@router.get("/me/restaurants")
def recommended_restaurants(current_user: Annotated[User, Security(get_current_user, scopes=["customer"])], session: SessionDep):
    preference = session.get(CustomerPreference, current_user.userId)
    if not preference: raise HTTPException(404, "Bạn chưa hoàn tất khảo sát khẩu vị")
    ranked = []
    for restaurant in session.exec(select(Restaurant).where(Restaurant.is_active == True, Restaurant.is_report_suspended == False, Restaurant.approval_status == "approved")).all():
        score = score_overlap(preference.categories, restaurant.category, 5) + score_overlap(preference.suitable_for, restaurant.suitable_for, 3) + score_overlap(preference.service_types, restaurant.service_types, 2)
        if preference.price_level and restaurant.price_avg: score += max(0, 3 - int(abs(restaurant.price_avg - preference.price_level * 200_000) / 200_000))
        if preference.city and restaurant.city == preference.city: score += 2
        score += min(2, int(restaurant.rating or 0) // 2)
        if score:
            reasons = (["phù hợp món ăn bạn thích"] if set(preference.categories).intersection(restaurant.category or []) else []) + (["mức giá phù hợp"] if preference.price_level and restaurant.price_avg and abs(restaurant.price_avg - preference.price_level * 200_000) <= 200_000 else []) + (["gần khu vực bạn chọn"] if preference.city and restaurant.city == preference.city else [])
            ranked.append((score, restaurant, reasons[:2]))
    return [{**serialize_restaurant(row), "match_reasons": reasons} for _, row, reasons in sorted(ranked, key=lambda item: (-item[0], -(item[1].rating or 0), -item[1].like_count))[:8]]
