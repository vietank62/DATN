from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Security
from database import SessionDep
from models import Restaurant, MenuItem, User, Review, Booking
from schemas import RestaurantCreate, RestaurantUpdate
from routers.authentication import get_current_user


from sqlalchemy import func

router = APIRouter()

def get_restaurant_with_stats(restaurant: Restaurant, session: SessionDep) -> dict:
    r_dict = restaurant.model_dump()
    result = session.query(
        func.count(Review.reviewId),
        func.avg(Review.rating)
    ).filter(Review.restaurantId == restaurant.restaurantId).first()
    
    review_count, avg_rating = result
    r_dict['reviewCount'] = review_count or 0
    r_dict['rating'] = round(avg_rating, 1) if avg_rating else 0.0
    
    price_result = session.query(
        func.min(MenuItem.price),
        func.max(MenuItem.price)
    ).filter(MenuItem.restaurantId == restaurant.restaurantId).first()

    min_price, max_price = price_result
    if min_price is not None and max_price is not None:
        if min_price == max_price:
            r_dict['priceRange'] = f"{int(min_price):,}đ"
        else:
            r_dict['priceRange'] = f"{int(min_price):,}đ - {int(max_price):,}đ"
    else:
        r_dict['priceRange'] = "Chưa cập nhật"
        
    booked_seats = session.query(func.sum(Booking.requestSeats)).filter(
        Booking.restaurantId == restaurant.restaurantId,
        Booking.status.in_(['pending', 'confirmed'])
    ).scalar() or 0
    r_dict['availableSeats'] = max(0, restaurant.totalSeats - booked_seats)
        
    return r_dict

@router.post("/api/create-restaurant/", tags=["Restaurant"])
def create_restaurant(restaurant_data: RestaurantCreate, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["manager"])]):
    restaurant = Restaurant(**restaurant_data.model_dump())
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)
    return get_restaurant_with_stats(restaurant, session)

@router.get("/api/get-all-restaurant/", tags=["Restaurant"])
def get_all_restaurants(session: SessionDep):
    results = session.query(
        Restaurant,
        func.count(Review.reviewId).label("reviewCount"),
        func.avg(Review.rating).label("avgRating")
    ).outerjoin(Review, Restaurant.restaurantId == Review.restaurantId).filter(Restaurant.status == "active").group_by(Restaurant.restaurantId).all()

    response = []
    
    price_results = session.query(
        MenuItem.restaurantId,
        func.min(MenuItem.price),
        func.max(MenuItem.price)
    ).group_by(MenuItem.restaurantId).all()
    price_map = {row[0]: (row[1], row[2]) for row in price_results}
    
    booked_results = session.query(
        Booking.restaurantId,
        func.sum(Booking.requestSeats)
    ).filter(Booking.status.in_(['pending', 'confirmed'])).group_by(Booking.restaurantId).all()
    booked_map = {row[0]: row[1] or 0 for row in booked_results}
    
    for restaurant, review_count, avg_rating in results:
        r_dict = restaurant.model_dump()
        r_dict['reviewCount'] = review_count or 0
        r_dict['rating'] = round(avg_rating, 1) if avg_rating else 0.0
        
        min_price, max_price = price_map.get(restaurant.restaurantId, (None, None))
        if min_price is not None and max_price is not None:
            if min_price == max_price:
                r_dict['priceRange'] = f"{int(min_price):,}đ"
            else:
                r_dict['priceRange'] = f"{int(min_price):,}đ - {int(max_price):,}đ"
        else:
            r_dict['priceRange'] = "Chưa cập nhật"
            
        booked_seats = booked_map.get(restaurant.restaurantId, 0)
        r_dict['availableSeats'] = max(0, restaurant.totalSeats - booked_seats)
            
        response.append(r_dict)
    return response

@router.get("/api/get-restaurant/{restaurant_id}", tags=["Restaurant"])
def get_restaurant_by_id(restaurant_id: int, session: SessionDep):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    # Join menu items
    menu_items = session.query(MenuItem).filter(MenuItem.restaurantId == restaurant_id).all()
    result = get_restaurant_with_stats(restaurant, session)
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
        return get_restaurant_with_stats(restaurant, session)
    return {"message": "Restaurant not found"}

@router.get("/api/admin/pending-restaurants/", tags=["Admin"])
def get_pending_restaurants(session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    restaurants = session.query(Restaurant).filter(Restaurant.status == "pending").all()
    return [r.model_dump() for r in restaurants]

@router.patch("/api/admin/approve-restaurant/{restaurant_id}", tags=["Admin"])
def approve_restaurant(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant.status = "active"
    session.commit()
    return {"message": "Restaurant approved successfully"}

@router.patch("/api/admin/reject-restaurant/{restaurant_id}", tags=["Admin"])
def reject_restaurant(restaurant_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user, scopes=["admin"])]):
    restaurant = session.query(Restaurant).filter(Restaurant.restaurantId == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant.status = "rejected"
    session.commit()
    return {"message": "Restaurant rejected"}
