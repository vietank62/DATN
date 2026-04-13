from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Security
from database import SessionDep
from models import Restaurant, MenuItem, User
from schemas import RestaurantCreate, RestaurantUpdate
from routers.authentication import get_current_user


router = APIRouter()

@router.post("/api/create-restaurant/", tags=["Restaurant"])
def create_restaurant(restaurant_data: RestaurantCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = Restaurant(**restaurant_data.model_dump())
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    return restaurant

@router.get("/api/get-all-restaurant/", tags=["Restaurant"])
def get_all_restaurants(
    session: SessionDep,
    cuisine: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    priceRange: Optional[str] = Query(None),
    minRating: Optional[float] = Query(None),
    featured: Optional[bool] = Query(None),
):
    from sqlalchemy import or_, cast, String
    import json
    
    query = session.query(Restaurant)
    
    # Handle cuisine filter - check both old 'cuisine' and new 'cuisines' fields
    if cuisine and cuisine != "all":
        # Match either the old single cuisine field or cuisines array containing the value
        query = query.filter(
            or_(
                Restaurant.cuisine == cuisine,
                # For JSON array, we use a simple LIKE check as fallback
                cast(Restaurant.cuisines, String).like(f'%{cuisine}%')
            )
        )
    
    if district and district != "Tất cả":
        query = query.filter(Restaurant.district == district)
    if priceRange and priceRange != "all":
        query = query.filter(Restaurant.priceRange == priceRange)    if minRating is not None and minRating > 0:
        query = query.filter(Restaurant.rating >= minRating)
    if featured is not None:
        query = query.filter(Restaurant.featured == featured)
    return query.all()


@router.get("/api/search-restaurants/", tags=["Restaurant"])
def search_restaurants(
    session: SessionDep,
    q: str = Query("", description="Search query for restaurant name, address, or cuisine"),
):
    """Search restaurants by name, address, district, or cuisine"""
    from sqlalchemy import or_, cast, String, ilike
    
    if not q or len(q.strip()) == 0:
        return []
    
    search_term = f"%{q}%"
    query = session.query(Restaurant).filter(
        or_(
            Restaurant.name.ilike(search_term),
            Restaurant.address.ilike(search_term),
            Restaurant.district.ilike(search_term),
            Restaurant.cuisine.ilike(search_term),
            cast(Restaurant.cuisines, String).ilike(search_term),
            Restaurant.description.ilike(search_term),
        )
    )
    
    return query.all()


@router.get("/api/get-restaurant/{restaurant_id}", tags=["Restaurant"])
def get_restaurant_by_id(restaurant_id: int, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    # Join menu items
    menu_items = session.query(MenuItem).filter(MenuItem.restaurantId == restaurant_id).all()
    result = restaurant.model_dump()
    result["menu"] = [item.model_dump() for item in menu_items]
    return result

@router.delete("/api/delete-restaurant/{restaurant_id}", tags=["Restaurant"])
def delete_restaurant_by_id(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if restaurant:
        session.delete(restaurant)
        session.commit()
        return {"message": "Restaurant deleted successfully"}
    return {"message": "Restaurant not found"}

@router.put("/api/update-restaurant/{restaurant_id}", tags=["Restaurant"])
def update_restaurant_by_id(restaurant_id: int, updated_restaurant: RestaurantUpdate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if restaurant:
        update_data = updated_restaurant.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(restaurant, field, value)
        session.commit()
        session.refresh(restaurant)
        return restaurant
    return {"message": "Restaurant not found"}