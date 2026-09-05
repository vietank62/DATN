from typing import Annotated
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Security
from database import SessionDep, redis_client
from models import Booking, Review, Restaurant, User
from schemas.reviewMenuSchema import ReviewCreate, ReviewOut
from routers.authentication import get_current_user
from datetime import datetime
from sqlmodel import select
from sqlalchemy import asc, desc, func

router = APIRouter()
CACHE_KEY_SET = "cache:restaurants:keys"


async def clear_restaurant_caches() -> None:
    try:
        keys = await redis_client.smembers(CACHE_KEY_SET)
        if keys:
            await redis_client.delete(*keys)
        await redis_client.delete(CACHE_KEY_SET)
    except Exception as error:
        print(f"Redis Clear Cache Error: {error}")


@router.post("/api/create-review/", response_model=ReviewOut, tags=["Review"])
def create_review(
    review_data: ReviewCreate,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Security(get_current_user, scopes=["customer"])]
):
    # Check if restaurant exists
    restaurant = session.exec(select(Restaurant).where(Restaurant.id == review_data.restaurantId)).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Override userId with current_user.userId just to be safe, or validate it
    if current_user.userId != review_data.userId:
        raise HTTPException(status_code=403, detail="Not authorized to review for this user")

    completed_booking = session.exec(
        select(Booking.bookingId).where(
            Booking.userId == current_user.userId,
            Booking.restaurantId == review_data.restaurantId,
            Booking.status == "completed",
        )
    ).first()
    if completed_booking is None:
        raise HTTPException(
            status_code=403,
            detail="Bạn chỉ có thể đánh giá sau khi đã dùng bữa tại nhà hàng.",
        )

    existing_review = session.exec(
        select(Review.reviewId).where(
            Review.userId == current_user.userId,
            Review.restaurantId == review_data.restaurantId,
        )
    ).first()
    if existing_review is not None:
        raise HTTPException(
            status_code=409,
            detail="Bạn đã đánh giá nhà hàng này.",
        )

    # Create the review
    review = Review(
        **review_data.model_dump(),
        createdAt=datetime.now().isoformat()
    )
    session.add(review)
    session.flush()

    # Recalculate and update restaurant rating stats in the same transaction.
    review_stats_res = session.exec(
        select(
            func.count(Review.reviewId),
            func.avg(Review.rating)
        ).where(Review.restaurantId == review_data.restaurantId)
    )
    count_val, avg_val = review_stats_res.first()
    restaurant.review_count = count_val or 0
    restaurant.rating = round(avg_val, 1) if avg_val else 0.0
    session.add(restaurant)
    session.commit()
    session.refresh(review)

    review_dict = review.model_dump()
    review_dict["userName"] = current_user.name
    review_dict["userAvatar"] = current_user.avatar
    background_tasks.add_task(clear_restaurant_caches)

    return review_dict


@router.get("/api/get-restaurant-reviews/{restaurant_id}", response_model=list[ReviewOut], tags=["Review"])
def get_restaurant_reviews(
    restaurant_id: int,
    session: SessionDep,
    sort: str = Query(default="recent", pattern="^(recent|best|worst)$"),
    limit: int = Query(default=5, ge=1, le=20),
):
    statement = (
        select(Review, User)
        .outerjoin(User, User.userId == Review.userId)
        .where(Review.restaurantId == restaurant_id)
    )

    if sort == "best":
        statement = statement.order_by(desc(Review.rating), desc(Review.createdAt))
    elif sort == "worst":
        statement = statement.order_by(asc(Review.rating), desc(Review.createdAt))
    else:
        statement = statement.order_by(desc(Review.createdAt))

    rows = session.exec(statement.limit(limit)).all()
    return [
        {
            **review.model_dump(),
            "userName": user.name if user else "Khách",
            "userAvatar": user.avatar if user else None,
        }
        for review, user in rows
    ]

@router.get("/api/get-user-reviews/{user_id}", response_model=list[ReviewOut], tags=["Review"])
def get_user_reviews(
    user_id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user)],
):
    if current_user.userId != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view these reviews")

    rows = session.exec(
        select(Review, Restaurant)
        .outerjoin(Restaurant, Restaurant.id == Review.restaurantId)
        .where(Review.userId == user_id)
    ).all()
    return [
        {
            **review.model_dump(),
            "userName": current_user.name,
            "userAvatar": current_user.avatar,
            "restaurantName": restaurant.name if restaurant else None,
        }
        for review, restaurant in rows
    ]