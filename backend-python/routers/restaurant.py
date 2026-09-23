import asyncio
import json
import os
import time
from typing import Annotated, List, Optional, Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, Security
from fastapi.encoders import jsonable_encoder
from starlette.concurrency import run_in_threadpool
from models import Restaurant, User, Favorite
from models.resDetail import RestaurantDetail
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from schemas.restaurant import RestaurantCreate, RestaurantBase, RestaurantUpdate
from sqlalchemy import desc, func, or_  # type: ignore
from routers.deps import get_current_user, get_optional_current_user
from core.public_restaurants import card_columns
from core.restaurant_search import apply_restaurant_filters, normalize_filters, restaurant_cache_key

CACHE_READ_TIMEOUT_SECONDS = float(os.getenv("RESTAURANT_CACHE_READ_TIMEOUT_SECONDS", "0.25"))
CACHE_RETRY_SECONDS = float(os.getenv("RESTAURANT_CACHE_RETRY_SECONDS", "15"))
_cache_retry_at = 0.0
_cache_probe_in_flight = False

CACHE_TTL = int(os.getenv("RESTAURANT_LIST_CACHE_TTL", "300"))
CACHE_KEY_SET = "cache:restaurants:keys"
CACHE_CONTROL = "private, no-store"

async def read_restaurant_cache(cache_key: str):
    """Bypass an unhealthy cache briefly; allow only one recovery probe per worker."""
    global _cache_retry_at, _cache_probe_in_flight
    if time.monotonic() < _cache_retry_at or _cache_probe_in_flight:
        return None
    probe = _cache_retry_at > 0
    if probe:
        _cache_probe_in_flight = True
    try:
        cached = await asyncio.wait_for(redis_client.get(cache_key), timeout=CACHE_READ_TIMEOUT_SECONDS)
        payload = json.loads(cached) if cached else None
        if payload is not None and (not isinstance(payload, list) or any(not isinstance(row, dict) or "id" not in row for row in payload)):
            raise ValueError("Invalid restaurant cache payload")
        if probe:
            _cache_retry_at = 0.0
        return payload
    except Exception as error:
        _cache_retry_at = time.monotonic() + CACHE_RETRY_SECONDS
        print(f"Restaurant cache unavailable ({type(error).__name__}); using database")
        return None
    finally:
        if probe:
            _cache_probe_in_flight = False


async def clear_restaurant_list_cache() -> None:
    """Invalidate every cached restaurant-list variant after public data changes."""
    try:
        cache_keys = await redis_client.smembers(CACHE_KEY_SET)
        if cache_keys:
            await redis_client.delete(*cache_keys)
        await redis_client.delete(CACHE_KEY_SET)
    except Exception as error:
        print(f"Redis Clear Cache Error: {error}")


async def cache_restaurant_list(cache_key: str, payload: str) -> None:
    """Populate public restaurant-card cache after the HTTP response is sent."""
    try:
        await redis_client.set(cache_key, payload, ex=CACHE_TTL)
        await redis_client.sadd(CACHE_KEY_SET, cache_key)
        await redis_client.expire(CACHE_KEY_SET, CACHE_TTL)
    except Exception as error:
        print(f"Redis Error (Set): {error}")

router = APIRouter(prefix="/v1/restaurants", tags=["Restaurant"])


@router.get("/all", response_model=dict)
def get_all_restaurants_for_admin(
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None, max_length=100),
):
    statement = select(Restaurant)
    count_statement = select(func.count(Restaurant.id))

    if search and search.strip():
        keyword = f"%{search.strip()}%"
        filters = or_(
            Restaurant.name.ilike(keyword),
            Restaurant.address.ilike(keyword),
            Restaurant.district.ilike(keyword),
            Restaurant.city.ilike(keyword),
        )
        statement = statement.where(filters)
        count_statement = count_statement.where(filters)

    total = session.exec(count_statement).one()
    active_total = session.exec(
        select(func.count(Restaurant.id)).where(Restaurant.is_active == True)
    ).one()
    restaurants = session.exec(
        statement
        .order_by(desc(Restaurant.created_at), desc(Restaurant.id))
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "items": [jsonable_encoder(restaurant) for restaurant in restaurants],
        "total": total,
        "active_total": active_total,
        "inactive_total": total - active_total if not search else None,
        "limit": limit,
        "offset": offset,
    }

@router.patch("/{id}/toggle-active", response_model=Restaurant)
def toggle_restaurant_active(
    id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
    background_tasks: BackgroundTasks,
):
    restaurant = session.get(Restaurant, id)

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if not restaurant.is_active and (restaurant.is_report_suspended or restaurant.approval_status != "approved"):
        raise HTTPException(409, "Nhà hàng phải được duyệt thông tin và giải trình trước khi hoạt động lại")
    restaurant.is_active = not restaurant.is_active
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)

    background_tasks.add_task(clear_restaurant_list_cache)
    return restaurant

@router.get("/", response_model=List[dict]) 
async def get_restaurants(
    session: SessionDep, # type: ignore
    response: Response,
    background_tasks: BackgroundTasks,
    sort_by: Optional[Literal["relevance", "like_count", "rating", "created_at"]] = Query(None),
    has_exclusive: Optional[bool] = Query(None, description="True/False"),
    limit: int = Query(16, ge=1, le=21),
    offset: int = Query(0, ge=0),
    city: Optional[str] = Query(None, max_length=100, description="Filter by city"),
    district: Optional[str] = Query(None, max_length=100, description="Filter by district"),
    price: Optional[int] = Query(None, ge=1, le=5, description="Price level: 1, 2, 3, 4, 5"),
    category: Optional[str] = Query(None, max_length=100, description="Category slug"),
    suitable_for: Optional[str] = Query(None, max_length=100, description="Suitable for slug"),
    service_type: Optional[str] = Query(None, max_length=100, description="Service type slug"),
    space_level: Optional[int] = Query(None, ge=1, le=5, description="Space level: 1, 2, 3, 4, 5"),
    search: Optional[str] = Query(None, max_length=100, description="Search by restaurant, address, description or menu"),
    rating: Optional[float] = Query(None, ge=0, le=5, description="Minimum rating"),
    current_user: Annotated[User | None, Depends(get_optional_current_user)] = None
):
    filters = normalize_filters(sort_by=sort_by, has_exclusive=has_exclusive, city=city,
        district=district, price=price, category=category, suitable_for=suitable_for,
        service_type=service_type, space_level=space_level, search=search, rating=rating)
    cache_key = restaurant_cache_key(filters, limit, offset)
    request_started_at = time.perf_counter()

    try:
        cached_data = await read_restaurant_cache(cache_key)
        if cached_data is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = "private, no-store" if current_user else CACHE_CONTROL
            response.headers["Vary"] = "Authorization"
            active_ids = set(session.exec(select(Restaurant.id).where(
                Restaurant.id.in_([row["id"] for row in cached_data]),
                Restaurant.is_active == True, Restaurant.approval_status == "approved",
                Restaurant.is_report_suspended == False,
            )).all())
            results = [row for row in cached_data if row["id"] in active_ids]
            response.headers["Server-Timing"] = (
                f"redis;dur={(time.perf_counter() - request_started_at) * 1000:.1f}"
            )
            return await run_in_threadpool(lambda: add_favorite_state(results, current_user, session))
    except Exception as e:
        print(f"Redis Error (Get): {e}")

    statement = apply_restaurant_filters(select(*card_columns()), **filters).offset(offset).limit(limit)
    database_started_at = time.perf_counter()
    results = await run_in_threadpool(lambda: session.execute(statement).mappings().all())
    database_finished_at = time.perf_counter()
    formatted_results = [jsonable_encoder(dict(result)) for result in results]
    
    background_tasks.add_task(
        cache_restaurant_list,
        cache_key,
        json.dumps(formatted_results),
    )
        
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = "private, no-store" if current_user else CACHE_CONTROL
    response.headers["Vary"] = "Authorization"
    response.headers["Server-Timing"] = (
        f"redis;dur={(database_started_at - request_started_at) * 1000:.1f}, "
        f"db;dur={(database_finished_at - database_started_at) * 1000:.1f}, "
        f"serialize;dur={(time.perf_counter() - database_finished_at) * 1000:.1f}"
    )
    return await run_in_threadpool(lambda: add_favorite_state(formatted_results, current_user, session))


def add_favorite_state(
    restaurants: List[dict], current_user: User | None, session: SessionDep
) -> List[dict]:
    if not restaurants:
        return restaurants

    favorite_ids: set[int] = set()
    if current_user:
        restaurant_ids = [restaurant["id"] for restaurant in restaurants]
        favorite_ids = set(session.exec(
            select(Favorite.restaurantId).where(
                Favorite.userId == current_user.userId,
                Favorite.restaurantId.in_(restaurant_ids),
            )
        ).all())

    return [
        {**restaurant, "is_favorite": restaurant["id"] in favorite_ids}
        for restaurant in restaurants
    ]

@router.get("/nearby", response_model=List[dict])
async def get_nearby_restaurants(
    session: SessionDep,
    response: Response,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5, ge=0.5, le=50),
    limit: int = Query(30, ge=1, le=50),
    current_user: Annotated[User | None, Depends(get_optional_current_user)] = None,
):
    """Return active restaurants in a radius, ordered from the customer's position."""
    latitude_radians = func.radians(latitude)
    distance_km = 6371.0088 * func.acos(
        func.least(
            1.0,
            func.greatest(
                -1.0,
                func.sin(latitude_radians) * func.sin(func.radians(Restaurant.latitude))
                + func.cos(latitude_radians)
                * func.cos(func.radians(Restaurant.latitude))
                * func.cos(func.radians(Restaurant.longitude) - func.radians(longitude)),
            ),
        ),
    )
    statement = (
        select(*card_columns(), distance_km.label("distance_km"))
        .where(
            Restaurant.is_active == True,
            Restaurant.approval_status == "approved",
            Restaurant.is_report_suspended == False,
            Restaurant.latitude.isnot(None),
            Restaurant.longitude.isnot(None),
            distance_km <= radius_km,
        )
        .order_by(distance_km.asc(), desc(Restaurant.rating), Restaurant.id.asc())
        .limit(limit)
    )
    rows = await run_in_threadpool(lambda: session.execute(statement).mappings().all())
    results = [jsonable_encoder(dict(row)) for row in rows]
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return await run_in_threadpool(lambda: add_favorite_state(results, current_user, session))


@router.get("/{id}/overview", response_model=dict)
def get_restaurant_overview(id: int, session: SessionDep):  # type: ignore
    """Load the public base record and detail record in one database round trip."""
    row = session.exec(
        select(Restaurant, RestaurantDetail)
        .outerjoin(
            RestaurantDetail,
            RestaurantDetail.restaurant_id == Restaurant.id,
        )
        .where(Restaurant.id == id)
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    restaurant, detail = row
    if not detail:
        raise HTTPException(status_code=404, detail="Restaurant detail not found")

    return {
        "restaurant": restaurant,
        "detail": detail,
    }


@router.get("/{id}", response_model=RestaurantBase)
async def get_restaurant(id: int, session: SessionDep):  # type: ignore
    restaurant = await run_in_threadpool(lambda: session.get(Restaurant, id))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant

@router.post("/", response_model=Restaurant)
def create_restaurant(
    restaurant: RestaurantCreate,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):  # type: ignore
    db_restaurant = Restaurant(**restaurant.model_dump())
    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    background_tasks.add_task(clear_restaurant_list_cache)
    return db_restaurant

@router.put("/{id}", response_model=Restaurant)
def update_restaurant(
    id: int,
    restaurant: RestaurantUpdate,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):  # type: ignore
    db_restaurant = session.get(Restaurant, id)
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    update_dict = restaurant.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_restaurant, key, value)

    session.add(db_restaurant)
    session.commit()
    session.refresh(db_restaurant)
    background_tasks.add_task(clear_restaurant_list_cache)
    return db_restaurant

@router.delete("/{id}", response_model=dict)
def delete_restaurant(
    id: int,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):  # type: ignore
    db_restaurant = session.get(Restaurant, id)
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    session.delete(db_restaurant)
    session.commit()
    background_tasks.add_task(clear_restaurant_list_cache)
    return {"message": "Restaurant deleted successfully"}