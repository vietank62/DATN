import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from models.resDetail import RestaurantDetail
from schemas.resDetail import RestaurantDetailCreate
import os

CACHE_TTL = int(os.getenv("RESTAURANT_DETAIL_CACHE_TTL", "900"))

router = APIRouter(prefix="/v1/details", tags=["RestaurantDetails"])

@router.get("/{restaurant_id}") 
async def get_restaurant_detail(restaurant_id: int, session: SessionDep):  # type: ignore
    cache_key = f"cache:details:{restaurant_id}"
    
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        print(f"Redis Error (Get Detail): {e}")

    statement = select(RestaurantDetail).where(RestaurantDetail.restaurant_id == restaurant_id)
    detail = session.exec(statement).first()

    if not detail:
        raise HTTPException(status_code=404, detail="Restaurant detail not found")

    try:
        serialized_data = json.dumps(jsonable_encoder(detail))
        await redis_client.set(cache_key, serialized_data, ex=CACHE_TTL)
    except Exception as e:
        print(f"Redis Error (Set Detail): {e}")
    return detail

@router.post("/", response_model=RestaurantDetail)
async def create_restaurant_detail(detail: RestaurantDetailCreate, session: SessionDep):  # type: ignore
    db_detail = RestaurantDetail(**detail.model_dump())
    session.add(db_detail)
    session.commit()
    session.refresh(db_detail)
    return db_detail
