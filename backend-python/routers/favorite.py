from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from database import SessionDep, redis_client 
from models import Restaurant, User, Favorite
from routers.authentication import get_current_user
from sqlmodel import select # type: ignore
from datetime import datetime
from pydantic import BaseModel # type: ignore

router = APIRouter(prefix="/v1/favorites", tags=["Favorite"]) 

class FavoriteToggle(BaseModel):
    restaurantId: int

async def clear_restaurant_caches():
    try:
        keys = await redis_client.keys("cache:restaurants:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        print(f"Redis Clear Cache Error: {e}")

@router.post("/toggle")
async def toggle_favorite(
    data: FavoriteToggle,
    session: SessionDep, # type: ignore
    current_user: Annotated[User, Depends(get_current_user)],
    background_tasks: BackgroundTasks 
):
    restaurant = session.get(Restaurant, data.restaurantId)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
        
    favorite = session.exec(
        select(Favorite).where(
            Favorite.userId == current_user.userId,
            Favorite.restaurantId == data.restaurantId
        )
    ).first()
    
    if favorite:
        session.delete(favorite)
        restaurant.like_count = max(0, restaurant.like_count - 1)
        action = "removed"
    else:
        new_favorite = Favorite(
            userId=current_user.userId,
            restaurantId=data.restaurantId,
            createdAt=datetime.utcnow(),
        )
        session.add(new_favorite)
        restaurant.like_count += 1
        action = "added"
        
    session.add(restaurant)
    session.commit()
    
    background_tasks.add_task(clear_restaurant_caches)
    
    return {
        "message": f"Successfully {action} favorite", 
        "like_count": restaurant.like_count, 
        "action": action
    }

@router.get("/check/{restaurant_id}")
def check_favorite(
    restaurant_id: int,
    session: SessionDep, # type: ignore
    current_user: Annotated[User, Depends(get_current_user)]
):
    favorite = session.exec(
        select(Favorite).where(
            Favorite.userId == current_user.userId,
            Favorite.restaurantId == restaurant_id
        )
    ).first()
    
    return {"is_favorite": favorite is not None}

@router.get("/user")
def get_user_favorites(
    session: SessionDep, # type: ignore
    current_user: Annotated[User, Depends(get_current_user)]
):
    statement = (
        select(Favorite, Restaurant)
        .join(Restaurant, Favorite.restaurantId == Restaurant.id)
        .where(Favorite.userId == current_user.userId)
    )
    
    results = session.exec(statement).all()
    formatted_results = []
    for favorite_obj, restaurant_obj in results:
        data = favorite_obj.model_dump()
        data["restaurant"] = restaurant_obj.model_dump()
        formatted_results.append(data)
        
    return formatted_results