from datetime import datetime, timezone
from typing import Annotated, Literal
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from database import SessionDep
from models.user import User
from routers.deps import get_current_user
from routers.restaurant_tables import managed_restaurant

router = APIRouter(prefix="/v1/discounts",tags=["Discounts"])
class DiscountPayload(BaseModel):
    code: str = Field(pattern=r"^[A-Za-z0-9_-]{2,40}$")
    title: str = Field(min_length=2,max_length=150)
    kind: Literal["percent","amount"]
    value: int = Field(gt=0)
    minimum: int = Field(default=0,ge=0)
    expires_at: datetime
    is_public: bool = False
    is_active: bool = True
    @model_validator(mode="after")
    def validate_offer(self):
        if self.kind == "percent" and self.value > 100:
            raise ValueError("Phần trăm giảm giá không được vượt quá 100")
        if self.expires_at.tzinfo is None or self.expires_at <= datetime.now(timezone.utc):
            raise ValueError("Hạn dùng phải ở tương lai và có múi giờ")
        self.code = self.code.upper()
        self.title = self.title.strip()
        return self

@router.get("/public")
def public_discounts(session: SessionDep):
    return [dict(r) for r in session.execute(text("SELECT d.*, r.name AS restaurant_name, r.image_url FROM restaurant_discounts d JOIN restaurants r ON r.id=d.restaurant_id WHERE d.is_active AND d.is_public AND d.expires_at > CURRENT_TIMESTAMP AND r.is_active AND r.approval_status='approved' AND NOT r.is_report_suspended ORDER BY d.id DESC")).mappings().all()]

@router.get("/me")
def my_discounts(session: SessionDep,user: Annotated[User,Security(get_current_user,scopes=["manager"])]):
    restaurant=managed_restaurant(session,user,lock=False)
    return [dict(r) for r in session.execute(text("SELECT * FROM restaurant_discounts WHERE restaurant_id=:restaurant_id ORDER BY id DESC"),{"restaurant_id":restaurant.id}).mappings().all()]

@router.post("/me")
def create_discount(data: DiscountPayload,session: SessionDep,user: Annotated[User,Security(get_current_user,scopes=["manager"])]):
    restaurant=managed_restaurant(session,user)
    values=data.model_dump(); values["restaurant_id"]=restaurant.id
    try:
        row=session.execute(text("INSERT INTO restaurant_discounts (restaurant_id,code,title,kind,value,minimum,expires_at,is_public,is_active) VALUES (:restaurant_id,:code,:title,:kind,:value,:minimum,:expires_at,:is_public,:is_active) RETURNING *"),values).mappings().one()
        result=dict(row); session.commit(); return result
    except IntegrityError:
        session.rollback(); raise HTTPException(409,"Mã giảm giá đã tồn tại trong nhà hàng")

class Visibility(BaseModel):
    is_active: bool
    is_public: bool

@router.patch("/me/{discount_id}")
def update_discount(discount_id:int,data:Visibility,session:SessionDep,user:Annotated[User,Security(get_current_user,scopes=["manager"])]):
    restaurant=managed_restaurant(session,user)
    values={**data.model_dump(),"id":discount_id,"restaurant_id":restaurant.id}
    row=session.execute(text("UPDATE restaurant_discounts SET is_active=:is_active,is_public=:is_public WHERE id=:id AND restaurant_id=:restaurant_id RETURNING *"),values).mappings().first()
    if row is None: raise HTTPException(404,"Không tìm thấy mã giảm giá")
    result=dict(row);session.commit();return result
