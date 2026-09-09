"""Public restaurant queries shared by the REST listing, chatbot and MCP tools."""
from typing import Annotated, Any, Literal
from pydantic import Field, validate_call
from sqlmodel import Session, select
from database import engine
from models.restaurant import Restaurant
from core.restaurant_search import apply_restaurant_filters, normalize_filters


def card_columns():
    """The public list contract: no gallery, menu, detail, or relationship loading."""
    return (
        Restaurant.id,
        Restaurant.name,
        Restaurant.slug,
        Restaurant.image_url,
        Restaurant.address,
        Restaurant.district,
        Restaurant.city,
        Restaurant.price_avg,
        Restaurant.rating,
        Restaurant.review_count,
        Restaurant.like_count,
        Restaurant.category,
        Restaurant.has_exclusive,
    )

def serialize_restaurant(restaurant: Restaurant) -> dict[str, Any]:
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "slug": restaurant.slug,
        "image_url": restaurant.image_url,
        "address": restaurant.address,
        "district": restaurant.district,
        "city": restaurant.city,
        "price_avg": restaurant.price_avg,
        "rating": restaurant.rating,
        "review_count": restaurant.review_count,
        "like_count": restaurant.like_count,
        "category": restaurant.category or [],
        "has_exclusive": restaurant.has_exclusive,
    }


@validate_call
def find_public_restaurants(
    keyword: Annotated[str, Field(max_length=100)] = "",
    city: Annotated[str | None, Field(max_length=100)] = None,
    district: Annotated[str | None, Field(max_length=100)] = None,
    category: Annotated[str | None, Field(max_length=100)] = None,
    limit: int = 8,
    *,
    price: Annotated[int | None, Field(ge=1, le=5)] = None,
    suitable_for: Annotated[str | None, Field(max_length=100)] = None,
    service_type: Annotated[str | None, Field(max_length=100)] = None,
    space_level: Annotated[int | None, Field(ge=1, le=5)] = None,
    rating: Annotated[float | None, Field(ge=0, le=5)] = None,
    has_exclusive: bool | None = None,
    sort_by: Literal["relevance", "like_count", "rating", "created_at"] | None = None,
    offset: Annotated[int, Field(ge=0)] = 0,
    min_price: Annotated[int | None, Field(ge=0)] = None,
    max_price: Annotated[int | None, Field(ge=0)] = None,
    party_size: Annotated[int | None, Field(ge=1, le=1000)] = None,
) -> list[dict[str, Any]]:
    """Use the website's accent-insensitive search, combined filters and ordering."""
    filters = normalize_filters(search=keyword, city=city, district=district,
        category=category, price=price, suitable_for=suitable_for,
        service_type=service_type, space_level=space_level, rating=rating,
        has_exclusive=has_exclusive, sort_by=sort_by)
    statement = apply_restaurant_filters(select(*card_columns()), **filters).offset(offset).limit(max(1, min(limit, 20)))
    if min_price is not None:
        statement = statement.where(Restaurant.price_avg >= min_price)
    if max_price is not None:
        statement = statement.where(Restaurant.price_avg <= max_price)
    if party_size is not None:
        statement = statement.where(Restaurant.capacity >= party_size)
    with Session(engine) as session:
        return [dict(row) for row in session.execute(statement).mappings().all()]
