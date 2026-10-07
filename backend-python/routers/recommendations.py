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
from core.restaurant_search import public_restaurant_conditions, UTILITY_KEYWORDS
from core.taste_recommendations import TasteSurvey, recommend_taste
from models.menuItem import RestaurantMenuList
from models.resDetail import RestaurantDetail
import httpx
import logging

router = APIRouter(prefix="/v1/recommendations", tags=["Recommendations"])

class PreferenceInput(BaseModel):
    categories: list[str] = Field(default_factory=list, max_length=8)
    suitable_for: list[str] = Field(default_factory=list, max_length=8)
    service_types: list[str] = Field(default_factory=list, max_length=8)
    price_level: int | None = Field(default=None, ge=1, le=5)
    city: str | None = Field(default=None, max_length=100)

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
    return resolve_matches(session, preference.ai_matches)

def resolve_matches(session, matches):
    ids = [item["id"] for item in matches]
    if not ids:
        return []
    rows = session.exec(select(Restaurant).where(Restaurant.id.in_(ids), *public_restaurant_conditions())).all()
    by_id = {row.id:row for row in rows}
    return [{**serialize_restaurant(by_id[item["id"]]), "match_reasons":item["reasons"]}
            for item in matches if item["id"] in by_id]

@router.post("/me/survey")
def submit_survey(data: TasteSurvey, current_user: Annotated[User, Security(get_current_user, scopes=["customer"])], session: SessionDep):
    restaurants = session.exec(select(Restaurant).where(*public_restaurant_conditions()).order_by(Restaurant.id)).all()
    ids = [restaurant.id for restaurant in restaurants]
    menus = {}
    details = {}
    if ids:
        for menu in session.exec(select(RestaurantMenuList).where(RestaurantMenuList.restaurant_id.in_(ids), RestaurantMenuList.is_available == True).order_by(RestaurantMenuList.id)).all():
            menus.setdefault(menu.restaurant_id, []).append({"name":menu.name,"category":menu.category,"description":menu.description})
        details = {detail.restaurant_id:detail for detail in session.exec(select(RestaurantDetail).where(RestaurantDetail.restaurant_id.in_(ids))).all()}
    candidates = []
    for restaurant in restaurants:
        detail = details.get(restaurant.id)
        candidates.append({"id":restaurant.id,"name":restaurant.name,"city":restaurant.city,
            "district":restaurant.district,"price_avg":restaurant.price_avg,
            "category":restaurant.category,"suitable_for":restaurant.suitable_for,
            "service_types":restaurant.service_types,"rating":restaurant.rating,
            "description":detail.description if detail else None,
            "utilities":[UTILITY_KEYWORDS[value][0] for value in (detail.utilities or []) if value in UTILITY_KEYWORDS] if detail else [],
            "parking":detail.parking_info if detail else None,"menu":menus.get(restaurant.id,[])})
    # Do not hold the database transaction/connection while waiting for the external AI.
    user_id = current_user.userId
    session.rollback()
    try:
        matches = recommend_taste(data.model_dump(), candidates)
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            raise HTTPException(503, "Dịch vụ AI đã chạm giới hạn lượt gọi hoặc hạn mức hiện tại. Vui lòng thử lại sau; khảo sát cũ được giữ nguyên.", headers={"X-Error-Code": "AI_QUOTA_LIMIT"}) from error
        if error.response.status_code in (400, 401, 403, 404):
            logging.getLogger(__name__).warning("Taste AI configuration/access HTTP status: %s", error.response.status_code)
            raise HTTPException(503, "Dịch vụ AI chưa sẵn sàng. Vui lòng kiểm tra khóa API, model và quyền truy cập; khảo sát cũ được giữ nguyên.", headers={"X-Error-Code": "AI_CONFIGURATION_ERROR"}) from error
        logging.getLogger(__name__).warning("Taste AI HTTP status: %s", error.response.status_code)
        raise HTTPException(503, "AI chưa thể tìm nhà hàng lúc này. Vui lòng thử lại; khảo sát cũ được giữ nguyên.") from error
    except (httpx.HTTPError, ValueError, TypeError) as error:
        logging.getLogger(__name__).warning("Taste AI request failed (%s)", type(error).__name__)
        raise HTTPException(503, "AI chưa thể tìm nhà hàng lúc này. Vui lòng thử lại; khảo sát cũ được giữ nguyên.") from error
    preference = session.get(CustomerPreference,user_id) or CustomerPreference(user_id=user_id)
    preference.survey = data.model_dump()
    preference.ai_matches = matches
    preference.updated_at = datetime.now(timezone.utc).isoformat()
    session.add(preference)
    session.commit()
    return {"restaurants":resolve_matches(session,matches)}
