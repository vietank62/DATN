from typing import Annotated
from fastapi import APIRouter, HTTPException, Security
from database import SessionDep
from models import Review, Restaurant, User
from schemas import ReviewCreate, ReviewOut
from routers.authentication import get_current_user
from datetime import datetime
from sqlmodel import select
from sqlalchemy import func

router = APIRouter()

@router.post("/api/create-review/", response_model=ReviewOut, tags=["Review"])
async def create_review(
    review_data: ReviewCreate, 
    session: SessionDep, 
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])]
):
    # Check if restaurant exists
    rest_res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == review_data.restaurantId))
    restaurant = rest_res.scalars().first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Override userId with current_user.userId just to be safe, or validate it
    if current_user.userId != review_data.userId:
        raise HTTPException(status_code=403, detail="Not authorized to review for this user")

    # Create the review
    review = Review(
        **review_data.model_dump(),
        createdAt=datetime.now().isoformat()
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)

    # Recalculate and update restaurant rating stats (denormalization)
    review_stats_res = await session.execute(
        select(
            func.count(Review.reviewId),
            func.avg(Review.rating)
        ).where(Review.restaurantId == review_data.restaurantId)
    )
    count_val, avg_val = review_stats_res.first()
    restaurant.reviewCount = count_val or 0
    restaurant.rating = round(avg_val, 1) if avg_val else 0.0
    session.add(restaurant)
    await session.commit()

    # We need to return ReviewOut, which includes userName and userAvatar.
    review_dict = review.model_dump()
    review_dict["userName"] = current_user.name
    review_dict["userAvatar"] = current_user.avatar
    return review_dict

@router.get("/api/get-restaurant-reviews/{restaurant_id}", response_model=list[ReviewOut], tags=["Review"])
async def get_restaurant_reviews(restaurant_id: int, session: SessionDep):
    reviews_res = await session.execute(select(Review).where(Review.restaurantId == restaurant_id))
    reviews = reviews_res.scalars().all()
    result = []
    for r in reviews:
        user_res = await session.execute(select(User).where(User.userId == r.userId))
        user = user_res.scalars().first()
        r_dict = r.model_dump()
        r_dict["userName"] = user.name if user else "Khách"
        r_dict["userAvatar"] = user.avatar if user else None
        result.append(r_dict)
    return result

@router.get("/api/get-user-reviews/{user_id}", response_model=list[ReviewOut], tags=["Review"])
async def get_user_reviews(user_id: int, session: SessionDep, current_user: Annotated[User, Security(get_current_user)]):
    if current_user.userId != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view these reviews")
    
    reviews_res = await session.execute(select(Review).where(Review.userId == user_id))
    reviews = reviews_res.scalars().all()
    result = []
    for r in reviews:
        r_dict = r.model_dump()
        r_dict["userName"] = current_user.name
        r_dict["userAvatar"] = current_user.avatar
        
        rest_res = await session.execute(select(Restaurant).where(Restaurant.restaurantId == r.restaurantId))
        restaurant = rest_res.scalars().first()
        if restaurant:
            r_dict["restaurantName"] = restaurant.name
            
        result.append(r_dict)
    return result
