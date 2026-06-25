import json
from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from models.resModel import Restaurant
from schemas.resSchema import RestaurantCreate, RestaurantBase
from typing import List, Optional
from sqlalchemy import desc  # type: ignore
import os

CACHE_TTL = int(os.getenv("CACHE_TTL"))

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


    




