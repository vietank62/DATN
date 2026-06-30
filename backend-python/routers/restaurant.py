import json
from typing import Annotated, List, Optional
from fastapi import APIRouter, HTTPException, Query, Security
from fastapi.encoders import jsonable_encoder
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from models.resModel import Restaurant
from models.user import User
from schemas.resSchema import RestaurantCreate, RestaurantBase
from sqlalchemy import desc  # type: ignore
from routers.deps import get_current_user
import os

CACHE_TTL = int(os.getenv("CACHE_TTL", "60"))

router = APIRouter(prefix="/v1/restaurants", tags=["Restaurant"])

@router.get("/", response_model=List[RestaurantBase])
async def get_restaurants(
    session: SessionDep, # type: ignore
    sort_by: Optional[str] = Query(None, description="like_count, rating, created_at"),
    has_exclusive: Optional[bool] = Query(None, description="True/False"),
    limit: int = Query(8, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    cache_key = f"cache:restaurants:{sort_by}:{has_exclusive}:{limit}:{offset}"

    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        print(f"Redis Error (Get): {e}")

    statement = select(Restaurant)

    if has_exclusive is not None:
        statement = statement.where(Restaurant.has_exclusive == has_exclusive)

    if sort_by == "like_count":
        statement = statement.order_by(desc(Restaurant.like_count))
    elif sort_by == "rating":
        statement = statement.order_by(desc(Restaurant.rating))
    elif sort_by == "created_at":
        statement = statement.order_by(desc(Restaurant.created_at))
    else:
        statement = statement.order_by(desc(Restaurant.id))

    statement = statement.offset(offset).limit(limit)
    results = session.exec(statement).all()

    try:
        # jsonable_encoder giúp biến các thực thể DB/Datetime thành dict/list thuần túy
        serialized_data = json.dumps(jsonable_encoder(results))

        await redis_client.set(cache_key, serialized_data, ex=CACHE_TTL)
    except Exception as e:
        print(f"Redis Error (Set): {e}")
    return results

@router.post("/", response_model=Restaurant)
async def create_restaurant(restaurant: RestaurantCreate, session: SessionDep):  # type: ignore
    db_restaurant = Restaurant(**restaurant.dict())
    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    return db_restaurant
@router.get("/all", response_model=List[RestaurantBase])
def get_all_restaurants_admin(
    session: SessionDep,  # type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]
):
    """Admin: lấy toàn bộ danh sách nhà hàng (không limit/cache)."""
    results = session.exec(select(Restaurant).order_by(desc(Restaurant.id))).all()
    return results


@router.patch("/{restaurant_id}/toggle-active")
def toggle_restaurant_active(
    restaurant_id: int,
    session: SessionDep,  # type: ignore
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]
):
    """Admin: bật/tắt trạng thái hoạt động của nhà hàng."""
    restaurant = session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    restaurant.is_active = not restaurant.is_active
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    return {"id": restaurant.id, "name": restaurant.name, "is_active": restaurant.is_active}




