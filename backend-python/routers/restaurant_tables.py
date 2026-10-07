from typing import Annotated
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import select
from database import SessionDep
from models.restaurant import Restaurant
from models.restaurantTable import RestaurantTable
from models.user import User
from routers.deps import get_current_user

router = APIRouter(prefix="/v1/restaurant-tables", tags=["Restaurant tables"])

class TablePayload(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    seats: int = Field(ge=1, le=100)

def managed_restaurant(session: SessionDep, user: User, *, lock: bool = True) -> Restaurant:
    statement = select(Restaurant).where(Restaurant.manager_id == user.userId)
    if lock:
        statement = statement.with_for_update()
    restaurant = session.exec(statement).first()
    if not restaurant:
        raise HTTPException(
            status_code=409,
            detail="Tài khoản chưa liên kết với nhà hàng. Vui lòng hoàn tất hồ sơ đăng ký nhà hàng để sử dụng chức năng này.",
            headers={"X-Error-Code": "RESTAURANT_NOT_LINKED"},
        )
    return restaurant

def refresh_capacity(session: SessionDep, restaurant: Restaurant) -> None:
    restaurant.capacity = int(session.exec(select(func.coalesce(func.sum(RestaurantTable.seats), 0)).where(RestaurantTable.restaurant_id == restaurant.id, RestaurantTable.is_active == True)).one() or 0)
    session.add(restaurant)

@router.get("/me")
def list_tables(current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = managed_restaurant(session, current_user, lock=False)
    return session.exec(select(RestaurantTable).where(RestaurantTable.restaurant_id == restaurant.id).order_by(func.lower(RestaurantTable.name))).all()

@router.post("/me", response_model=RestaurantTable)
def create_table(data: TablePayload, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = managed_restaurant(session, current_user); name = data.name.strip()
    if session.exec(select(RestaurantTable.id).where(RestaurantTable.restaurant_id == restaurant.id, func.lower(RestaurantTable.name) == name.lower())).first(): raise HTTPException(409, "Tên bàn đã tồn tại")
    table = RestaurantTable(restaurant_id=restaurant.id, name=name, seats=data.seats); session.add(table); session.flush(); refresh_capacity(session, restaurant); session.commit(); session.refresh(table); return table

@router.put("/me/{table_id}", response_model=RestaurantTable)
def update_table(table_id: int, data: TablePayload, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = managed_restaurant(session, current_user); table = session.get(RestaurantTable, table_id)
    if not table or table.restaurant_id != restaurant.id: raise HTTPException(404, "Không tìm thấy bàn")
    table.name, table.seats = data.name.strip(), data.seats; session.add(table); refresh_capacity(session, restaurant); session.commit(); session.refresh(table); return table

@router.delete("/me/{table_id}")
def delete_table(table_id: int, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])], session: SessionDep):
    restaurant = managed_restaurant(session, current_user); table = session.get(RestaurantTable, table_id)
    if not table or table.restaurant_id != restaurant.id: raise HTTPException(404, "Không tìm thấy bàn")
    session.delete(table); session.flush(); refresh_capacity(session, restaurant); session.commit(); return {"ok": True}
