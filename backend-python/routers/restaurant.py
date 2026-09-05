import json
import os
import re
import time
import unicodedata
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Security
from fastapi.encoders import jsonable_encoder
from models import Restaurant, User, Favorite
from database import SessionDep, redis_client
from sqlmodel import select  # type: ignore
from schemas.restaurant import RestaurantCreate, RestaurantBase, RestaurantUpdate
from sqlalchemy import desc, func, or_  # type: ignore
from sqlalchemy.dialects.postgresql import array
from routers.deps import get_current_user, get_optional_current_user

CACHE_TTL = int(os.getenv("RESTAURANT_LIST_CACHE_TTL", "180"))
CACHE_KEY_SET = "cache:restaurants:keys"
CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=120"

PRICE_RANGES: dict[int, tuple[Optional[int], Optional[int]]] = {
    1: (None, 100_000),
    2: (100_000, 200_000),
    3: (200_000, 500_000),
    4: (500_000, 1_000_000),
    5: (1_000_000, None),
}

SPACE_RANGES: dict[int, tuple[int, Optional[int]]] = {
    1: (1, 5),
    2: (6, 10),
    3: (11, 20),
    4: (21, 50),
    5: (51, None),
}

CATEGORY_ALIASES = {
    "lau": "lau",
    "nuong": "nuong",
    "buffet": "buffet",
    "hai-san": "hai-san",
    "mon-nhat": "mon-nhat",
    "mon-han": "mon-han",
    "mon-au": "mon-au",
    "mon-thai": "mon-thai",
    "mon-viet": "mon-viet",
    "mon-trung": "mon-trung",
    "pizza": "pizza",
    "steak": "steak",
    "dac-san": "dac-san",
    "mon-chay": "mon-chay",
}


def array_contains(column, value: str):
    return column.op("@>")(array([value]))


def normalize_search_value(value: str) -> str:
    """Create the slug format used by category and filter values in PostgreSQL."""
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )
    normalized = normalized.replace("đ", "d")
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


def normalize_category(value: str) -> str:
    normalized = normalize_search_value(value)
    return CATEGORY_ALIASES.get(normalized, normalized)


def unaccent_ilike(column, value: str):
    return func.immutable_unaccent(column).ilike(
        func.immutable_unaccent(f"%{value.strip()}%")
    )


async def clear_restaurant_list_cache() -> None:
    """Invalidate every cached restaurant-list variant after public data changes."""
    try:
        cache_keys = await redis_client.smembers(CACHE_KEY_SET)
        if cache_keys:
            await redis_client.delete(*cache_keys)
        await redis_client.delete(CACHE_KEY_SET)
    except Exception as error:
        print(f"Redis Clear Cache Error: {error}")


def card_columns():
    """The public list contract: no gallery, menu, detail, or relationship loading."""
    return (
        Restaurant.id,
        Restaurant.name,
        Restaurant.slug,
        Restaurant.image_url,
        Restaurant.district,
        Restaurant.city,
        Restaurant.price_avg,
        Restaurant.rating,
        Restaurant.review_count,
        Restaurant.like_count,
        Restaurant.category,
        Restaurant.has_exclusive,
    )

router = APIRouter(prefix="/v1/restaurants", tags=["Restaurant"])


@router.get("/all", response_model=dict)
async def get_all_restaurants_for_admin(
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
async def toggle_restaurant_active(
    id: int,
    session: SessionDep,
    current_user: Annotated[User, Security(get_current_user, scopes=["admin"])],
):
    restaurant = session.get(Restaurant, id)

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    restaurant.is_active = not restaurant.is_active
    session.add(restaurant)
    session.commit()
    session.refresh(restaurant)

    await clear_restaurant_list_cache()

    return restaurant

@router.get("/", response_model=List[dict]) 
async def get_restaurants(
    session: SessionDep, # type: ignore
    response: Response,
    sort_by: Optional[str] = Query(None, description="like_count, rating, created_at"),
    has_exclusive: Optional[bool] = Query(None, description="True/False"),
    limit: int = Query(16, ge=1, le=20),
    offset: int = Query(0, ge=0),
    city: Optional[str] = Query(None, description="Filter by city"),
    district: Optional[str] = Query(None, description="Filter by district"),
    price: Optional[int] = Query(None, ge=1, le=5, description="Price level: 1, 2, 3, 4, 5"),
    category: Optional[str] = Query(None, description="Category slug"),
    suitable_for: Optional[str] = Query(None, description="Suitable for slug"),
    service_type: Optional[str] = Query(None, description="Service type slug"),
    space_level: Optional[int] = Query(None, ge=1, le=5, description="Space level: 1, 2, 3, 4, 5"),
    search: Optional[str] = Query(None, description="Search by restaurant, address, description or menu"),
    rating: Optional[float] = Query(None, description="Filter by rating"), 
    current_user: Annotated[User | None, Depends(get_optional_current_user)] = None
):
    normalized_category = normalize_category(category) if category else None
    normalized_suitable_for = normalize_search_value(suitable_for) if suitable_for else None
    normalized_service_type = normalize_search_value(service_type) if service_type else None
    normalized_search = search.strip() if search else None
    cache_key = f"cache:restaurants:v5:{sort_by}:{has_exclusive}:{limit}:{offset}:{city}:{district}:{price}:{normalized_category}:{normalized_suitable_for}:{normalized_service_type}:{space_level}:{normalized_search}:{rating}"
    request_started_at = time.perf_counter()

    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = CACHE_CONTROL
            results = json.loads(cached_data)
            response.headers["Server-Timing"] = (
                f"redis;dur={(time.perf_counter() - request_started_at) * 1000:.1f}"
            )
            return add_favorite_state(results, current_user, session)
    except Exception as e:
        print(f"Redis Error (Get): {e}")

    statement = select(*card_columns()).where(Restaurant.is_active == True)

    if city is not None:
        statement = statement.where(Restaurant.city == city)

    if has_exclusive is not None:
        statement = statement.where(Restaurant.has_exclusive == has_exclusive)

    if district is not None:
        statement = statement.where(Restaurant.district == district)

    if normalized_search:
        search_slug = normalize_search_value(normalized_search)
        search_vector = func.to_tsvector(
            "simple",
            func.immutable_unaccent(
                func.coalesce(Restaurant.name, "")
                + " "
                + func.coalesce(Restaurant.address, "")
                + " "
                + func.coalesce(Restaurant.district, "")
                + " "
                + func.coalesce(Restaurant.city, "")
            ),
        )
        search_query = func.websearch_to_tsquery(
            "simple",
            func.immutable_unaccent(normalized_search),
        )

        statement = statement.where(
            or_(
                search_vector.op("@@")(search_query),
                array_contains(Restaurant.category, search_slug),
                array_contains(Restaurant.suitable_for, search_slug),
                array_contains(Restaurant.service_types, search_slug),
            )
        )

    if price is not None:
        lower_bound, upper_bound = PRICE_RANGES[price]
        if lower_bound is not None:
            statement = statement.where(Restaurant.price_avg >= lower_bound)
        if upper_bound is not None:
            statement = statement.where(Restaurant.price_avg < upper_bound)

    if normalized_category:
        statement = statement.where(
            array_contains(Restaurant.category, normalized_category)
        )

    if normalized_suitable_for:
        statement = statement.where(
            array_contains(Restaurant.suitable_for, normalized_suitable_for)
        )

    if normalized_service_type:
        statement = statement.where(
            array_contains(Restaurant.service_types, normalized_service_type)
        )

    if space_level is not None:
        lower_bound, upper_bound = SPACE_RANGES[space_level]
        statement = statement.where(Restaurant.capacity >= lower_bound)
        if upper_bound is not None:
            statement = statement.where(Restaurant.capacity <= upper_bound)
            
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
    
    results = session.execute(statement).mappings().all()
    database_finished_at = time.perf_counter()
    formatted_results = [jsonable_encoder(dict(result)) for result in results]
    
    try:
        serialized_data = json.dumps(formatted_results)
        await redis_client.set(cache_key, serialized_data, ex=CACHE_TTL)
        await redis_client.sadd(CACHE_KEY_SET, cache_key)
        await redis_client.expire(CACHE_KEY_SET, CACHE_TTL)
    except Exception as e:
        print(f"Redis Error (Set): {e}")
        
    response.headers["X-Cache"] = "MISS"
    response.headers["Cache-Control"] = CACHE_CONTROL
    response.headers["Server-Timing"] = (
        f"db;dur={(database_finished_at - request_started_at) * 1000:.1f}, "
        f"serialize;dur={(time.perf_counter() - database_finished_at) * 1000:.1f}"
    )
    return add_favorite_state(formatted_results, current_user, session)


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
    await clear_restaurant_list_cache()
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
    await clear_restaurant_list_cache()
    return db_restaurant

@router.delete("/{id}", response_model=dict)
async def delete_restaurant(id: int, session: SessionDep): # type: ignore
    db_restaurant = session.get(Restaurant, id)
    if not db_restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    session.delete(db_restaurant)
    session.commit()
    await clear_restaurant_list_cache()
    return {"message": "Restaurant deleted successfully"}
