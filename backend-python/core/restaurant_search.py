"""Canonical Vietnamese search and index-backed filters for public restaurant cards."""
import hashlib
import json
import re
import unicodedata

from sqlalchemy import case, false, func, literal_column
from sqlalchemy.dialects.postgresql import array, TSVECTOR
from models.restaurant import Restaurant

PRICE_RANGES = {1: (None, 100_000), 2: (100_000, 200_000), 3: (200_000, 500_000),
                4: (500_000, 1_000_000), 5: (1_000_000, None)}
SPACE_RANGES = {1: (1, 5), 2: (6, 10), 3: (11, 20), 4: (21, 50), 5: (51, None)}


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFD", value.strip().lower()).replace("đ", "d")
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def normalize_tag(value: str) -> str:
    return normalize_text(value).replace(" ", "-")


def search_tsquery(value: str, prefix: bool = True) -> str:
    # Only alphanumeric tokens enter tsquery syntax, never raw user operators.
    tokens = normalize_text(value).split()
    return " & ".join(token + (":*" if prefix and index == len(tokens) - 1 and len(token) >= 4 else "")
                      for index, token in enumerate(tokens))


def normalize_filters(**values) -> dict:
    result = dict(values)
    for key in ("city", "district"):
        result[key] = normalize_text(values.get(key) or "") or None
    for key in ("category", "suitable_for", "service_type"):
        result[key] = normalize_tag(values.get(key) or "") or None
    raw_search = (values.get("search") or "").strip()
    # A symbol-only search must not become the unfiltered listing or share its cache.
    result["search"] = normalize_text(raw_search) if raw_search else None
    result["sort_by"] = values.get("sort_by") or ("relevance" if raw_search else "like_count")
    return result


def restaurant_cache_key(filters: dict, limit: int, offset: int) -> str:
    payload = json.dumps({**filters, "limit": limit, "offset": offset}, sort_keys=True,
                         separators=(",", ":"), ensure_ascii=True)
    return "cache:restaurants:v7:" + hashlib.sha256(payload.encode()).hexdigest()


def public_restaurant_conditions():
    return (Restaurant.is_active == True, Restaurant.approval_status == "approved")


def apply_restaurant_filters(statement, *, search=None, city=None, district=None, price=None,
                             category=None, suitable_for=None, service_type=None, space_level=None,
                             rating=None, has_exclusive=None, sort_by=None):
    statement = statement.where(*public_restaurant_conditions())
    for column, value in ((Restaurant.city, city), (Restaurant.district, district)):
        if value:
            statement = statement.where(func.search_normalize_text(column) == normalize_text(value))
    if has_exclusive is not None:
        statement = statement.where(Restaurant.has_exclusive == has_exclusive)
    for column, value in ((Restaurant.category, category), (Restaurant.suitable_for, suitable_for),
                          (Restaurant.service_types, service_type)):
        if value:
            statement = statement.where(func.search_normalize_tags(column).op("@>")(array([normalize_tag(value)])))
    if price is not None:
        lower, upper = PRICE_RANGES[price]
        if lower is not None:
            statement = statement.where(Restaurant.price_avg >= lower)
        if upper is not None:
            statement = statement.where(Restaurant.price_avg < upper)
    if space_level is not None:
        lower, upper = SPACE_RANGES[space_level]
        statement = statement.where(Restaurant.capacity >= lower)
        if upper is not None:
            statement = statement.where(Restaurant.capacity <= upper)
    if rating is not None:
        statement = statement.where(Restaurant.rating >= rating)

    relevance = []
    if search is not None:
        query_text = search_tsquery(search)
        if not query_text:
            statement = statement.where(false())
        else:
            # Search-only DB column maintained by triggers, intentionally absent from public models.
            document = literal_column("restaurants.search_document", type_=TSVECTOR)
            query = func.to_tsquery(literal_column("'simple'"), query_text)
            exact_query = func.to_tsquery(literal_column("'simple'"), search_tsquery(search, prefix=False))
            statement = statement.where(document.op("@@")(query))
            relevance = [
                case((func.search_normalize_text(Restaurant.name) == normalize_text(search), 1), else_=0).desc(),
                case((document.op("@@")(exact_query), 1), else_=0).desc(),
                func.ts_rank_cd(document, query, 32).desc(),
            ]
    selected_sort = sort_by or ("relevance" if search is not None else "like_count")
    if selected_sort == "relevance":
        statement = statement.order_by(*relevance, Restaurant.like_count.desc())
    elif selected_sort == "rating":
        statement = statement.order_by(Restaurant.rating.desc())
    elif selected_sort == "created_at":
        statement = statement.order_by(Restaurant.created_at.desc())
    else:
        statement = statement.order_by(Restaurant.like_count.desc())
    return statement.order_by(Restaurant.id.desc())
