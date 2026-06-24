from fastapi import APIRouter, HTTPException
from database import SessionDep
from sqlmodel import select  # type: ignore
from models.resModel import Restaurant
from schemas.resSchema import RestaurantCreate  

router = APIRouter(prefix="/v1/restaurants", tags=["Restaurant"])

@router.get("/", response_model=list[Restaurant])
def get_all_restaurants(session: SessionDep):  # type: ignore
    """Lấy danh sách tất cả nhà hàng."""
    restaurants = session.exec(select(Restaurant)).all()
    return restaurants

@router.post("/", response_model=Restaurant)
def create_restaurant(restaurant: RestaurantCreate, session: SessionDep):  # type: ignore
    db_restaurant = Restaurant(**restaurant.dict())
    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    return db_restaurant


    




