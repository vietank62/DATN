from fastapi import APIRouter
from database import SessionDep
from models import Restaurant
from schemas import RestaurantCreate, RestaurantUpdate


router = APIRouter()

@router.post("/api/create-restaurant/", tags=["Restaurant"])
def create_restaurant(restaurant: RestaurantCreate, session: SessionDep):
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    return restaurant

@router.get("/api/get-all-restaurant/", tags=["Restaurant"])
def get_all_restaurants(session: SessionDep):
    restaurants = session.query(Restaurant).all()
    return restaurants


@router.get("/api/get-restaurant/{restaurant_id}", tags=["Restaurant"])
def get_restaurant_by_id(restaurant_id: int, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    return restaurant   

@router.delete("/api/delete-restaurant/{restaurant_id}", tags=["Restaurant"])
def delete_restaurant_by_id(restaurant_id: int, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if restaurant:
        session.delete(restaurant)
        session.commit()
        return {"message": "Restaurant deleted successfully"}
    return {"message": "Restaurant not found"}

@router.put("/api/update-restaurant/{restaurant_id}", tags=["Restaurant"])
def update_restaurant_by_id(restaurant_id: int, updated_restaurant:RestaurantUpdate, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if restaurant:
        update_data = updated_restaurant.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(restaurant, field, value)
        session.commit()
        session.refresh(restaurant)
        return restaurant
    return {"message": "Restaurant not found"}