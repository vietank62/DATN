from fastapi import APIRouter
from database import SessionDep
from models import Restaurant

router = APIRouter()

@router.post("/api/create-restaurant/", tags=["Restaurant"])
def create_restaurant(restaurant: Restaurant, session: SessionDep):
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
def update_restaurant_by_id(restaurant_id: int, updated_restaurant: Restaurant, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if restaurant:
        restaurant.name = updated_restaurant.name
        restaurant.address = updated_restaurant.address
        restaurant.district = updated_restaurant.district
        restaurant.cuisine = updated_restaurant.cuisine
        restaurant.priceRange = updated_restaurant.priceRange
        restaurant.rating = updated_restaurant.rating
        restaurant.reviewCount = updated_restaurant.reviewCount
        restaurant.imageUrl = updated_restaurant.imageUrl
        restaurant.openTime = updated_restaurant.openTime
        restaurant.closeTime = updated_restaurant.closeTime
        restaurant.phone = updated_restaurant.phone
        restaurant.featured = updated_restaurant.featured
        session.commit()
        session.refresh(restaurant)
        return restaurant
    return {"message": "Restaurant not found"}