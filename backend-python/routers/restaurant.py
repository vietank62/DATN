import json
import os
from typing import Annotated, List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.encoders import jsonable_encoder
from models import Restaurant, User, Favorite
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from schemas.restaurant import RestaurantCreate, RestaurantBase, RestaurantUpdate
from sqlalchemy import desc, or_  # type: ignore
from routers.deps import get_optional_current_user

CACHE_TTL = int(os.getenv("CACHE_TTL", "60"))

router = APIRouter(prefix="/v1/restaurants", tags=["Restaurant"])

@router.get("/", response_model=List[dict]) 
async def get_restaurants(
    session: SessionDep, # type: ignore
    sort_by: Optional[str] = Query(None, description="like_count, rating, created_at"),
    has_exclusive: Optional[bool] = Query(None, description="True/False"),
    limit: int = Query(8, ge=1, le=50),
    offset: int = Query(0, ge=0),
    city: Optional[str] = Query(None, description="Filter by city"),
    district: Optional[str] = Query(None, description="Filter by district"),
    price: Optional[int] = Query(None, description="Price level: 1, 2, 3, 4, 5"),
    category: Optional[str] = Query(None, description="Category slug"),
    suitable_for: Optional[str] = Query(None, description="Suitable for slug"),
    service_type: Optional[str] = Query(None, description="Service type slug"),
    space_level: Optional[int] = Query(None, description="Space level: 1, 2, 3, 4, 5"),
    search: Optional[str] = Query(None, description="Search text by name"),
    rating: Optional[float] = Query(None, description="Filter by rating"), 
    current_user: Annotated[User | None, Depends(get_optional_current_user)] = None
):
    user_id_str = current_user.userId if current_user else "anonymous"
    cache_key = f"cache:restaurants:{sort_by}:{has_exclusive}:{limit}:{offset}:{city}:{district}:{price}:{category}:{suitable_for}:{service_type}:{space_level}:{search}:{rating}:{user_id_str}"

    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        print(f"Redis Error (Get): {e}")

    statement = select(Restaurant)

    if city is not None:
        statement = statement.where(Restaurant.city == city)

    if has_exclusive is not None:
        statement = statement.where(Restaurant.has_exclusive == has_exclusive)

    if district is not None:
        statement = statement.where(Restaurant.district == district)

    if search is not None and search.strip() != "":
        clean_search = search.strip()
        search_term = f"%{clean_search}%"
        
        statement = statement.where(
            or_(
                Restaurant.name.ilike(search_term),
                Restaurant.category.any(clean_search),
                Restaurant.suitable_for.any(clean_search),
                Restaurant.service_types.any(clean_search),
                Restaurant.city.ilike(search_term),
                Restaurant.district.ilike(search_term),
            )
        )

    if price is not None:
        price_int = int(price)
        statement = statement.where(Restaurant.price_avg == price_int)

    if category is not None:
        statement = statement.where(Restaurant.category.any(category.strip()))

    if suitable_for is not None:
        statement = statement.where(Restaurant.suitable_for.any(suitable_for.strip()))

    if service_type is not None:
        statement = statement.where(Restaurant.service_types.any(service_type.strip()))

    if space_level is not None:
        if space_level == 1:    
            statement = statement.where(Restaurant.capacity >= 5)
        elif space_level == 2: 
            statement = statement.where(Restaurant.capacity >= 10)
        elif space_level == 3:  
            statement = statement.where(Restaurant.capacity >= 20)
        elif space_level == 4:  
            statement = statement.where(Restaurant.capacity >= 50)
        elif space_level == 5:  
            statement = statement.where(Restaurant.capacity > 50)
            
    if rating is not None:
        try:
            rating_float = float(str(rating).strip())
            statement = statement.where(Restaurant.rating >= rating_float)
        except ValueError:
            pass
                
    if sort_by == "like_count":
        statement = statement.order_by(desc(Restaurant.like_count))
    elif sort_by == "rating":
        statement = statement.order_by(desc(Restaurant.rating))
    elif sort_by == "created_at":
        statement = statement.order_by(desc(Restaurant.created_at))
    else:
        statement = statement.order_by(desc(Restaurant.like_count))

    statement = statement.offset(offset).limit(limit)
    
    results = session.exec(statement).all()
    
    formatted_results = []
    for res in results:
        res_dict = jsonable_encoder(res)
        if current_user:
            is_fav = session.exec(
                select(Favorite).where(
                    Favorite.userId == current_user.userId,
                    Favorite.restaurantId == res.id
                )
            ).first() is not None
        else:
            is_fav = False
            
        res_dict["is_favorite"] = is_fav
        formatted_results.append(res_dict)
    
    try:
        serialized_data = json.dumps(formatted_results)
        await redis_client.set(cache_key, serialized_data, ex=CACHE_TTL)
    except Exception as e:
        print(f"Redis Error (Set): {e}")
        
    return formatted_results

@router.get("/{id}", response_model=RestaurantBase)
async def get_restaurant(id: int, session: SessionDep):  # type: ignore
    restaurant = session.get(Restaurant, id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@router.post("/", response_model=Restaurant)
async def create_restaurant(restaurant: RestaurantCreate, session: SessionDep):  # type: ignore
    db_restaurant = Restaurant(**restaurant.model_dump())
    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    return db_restaurant

@router.put("/{id}", response_model=Restaurant)
async def update_restaurant(id: int, restaurant: RestaurantUpdate, session: SessionDep): # type: ignore
    db_restaurant = session.get(Restaurant, id)
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    update_dict = restaurant.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_restaurant, key, value)
    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    return db_restaurant

@router.delete("/{id}", response_model=dict)
async def delete_restaurant(id: int, session: SessionDep): # type: ignore
    db_restaurant = session.get(Restaurant, id)
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    session.delete(db_restaurant)
    session.commit()
    return {"message": "Restaurant deleted successfully"}