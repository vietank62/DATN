"""Canonical Vietnamese search and index-backed filters for public restaurant cards."""
import hashlib
import json
import re
import unicodedata

from sqlalchemy import case, false, func, literal_column, text, select
from sqlalchemy.dialects.postgresql import array, TSVECTOR
from models.restaurant import Restaurant
from models.resDetail import RestaurantDetail

PRICE_RANGES = {1: (None, 100_000), 2: (100_000, 200_000), 3: (200_000, 500_000),
                4: (500_000, 1_000_000), 5: (1_000_000, None)}
SPACE_MINIMUMS = {1: 1, 2: 6, 3: 11, 4: 21, 5: 51}
UTILITY_KEYWORDS = {
    1: ("may chieu",), 2: ("am thanh",), 3: ("ghe tre em",),
    4: ("khu hut thuoc",), 5: ("cho dau xe", "bai dau xe", "do o to", "gui o to", "bai do o to"),
    6: ("do xe may", "gui xe may",), 7: ("phong rieng",),
    8: ("phong vip",), 9: ("karaoke",), 10: ("dieu hoa", "may lanh"),
    11: ("trang tri su kien",), 12: ("man led",), 13: ("visa", "master"),
    14: ("hoa don vat", "xuat vat"), 15: ("wifi", "wi fi"),
    16: ("hop dong truc tiep",), 17: ("mc", "dan chuong trinh"),
    18: ("ban ngoai troi", "ngoai troi"), 19: ("bong da k", "k plus"),
    20: ("momo", "zalopay", "zalo pay"), 21: ("cho choi tre em", "khu vui choi tre em"),
}

SUITABILITY_KEYWORDS = {
    "hen-ho": ("hen ho", "lang man", "cap doi", "date"),
    "gia-dinh": ("gia dinh",), "sinh-nhat": ("sinh nhat",),
    "ban-be": ("ban be", "hop mat"),
    "tiec-hoi-nghi": ("tiec", "hoi nghi"),
    "sang-trong": ("sang trong",), "thien-nhien": ("thien nhien",),
    "hien-dai": ("hien dai",), "truyen-thong": ("truyen thong",),
    "co-dien": ("co dien",),
}


def suitability_in_search(value: str) -> tuple[list[str], str]:
    remainder = normalize_text(value)
    selected = []
    for tag, aliases in SUITABILITY_KEYWORDS.items():
        matched = False
        for alias in aliases:
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, remainder):
                remainder = re.sub(pattern, " ", remainder)
                matched = True
        if matched:
            selected.append(tag)
    return selected, re.sub(r"\s+", " ", remainder).strip()


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


def utility_ids_in_search(value: str) -> tuple[list[int], str]:
    """Extract amenities from a free-text search and leave menu/name terms behind."""
    remainder = normalize_text(value)
    selected: list[int] = []
    for utility_id, aliases in UTILITY_KEYWORDS.items():
        for alias in aliases:
            if re.search(r"\b" + re.escape(alias) + r"\b", remainder):
                selected.append(utility_id)
                remainder = re.sub(r"\b" + re.escape(alias) + r"\b", " ", remainder)
                break
    # Remove conversational filler, so “quán có wifi” means the Wifi filter.
    remainder = re.sub(r"\b(dia diem|nha hang|phu hop|danh cho|goi y|quan|co|can|tim|cho|voi|gan|o|de|va)\b", " ", remainder)
    return selected, re.sub(r"\s+", " ", remainder).strip()


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
    result["utility"] = values.get("utility")
    result["requires_deposit"] = values.get("requires_deposit")
    return result


def restaurant_cache_key(filters: dict, limit: int, offset: int) -> str:
    payload = json.dumps({**filters, "limit": limit, "offset": offset}, sort_keys=True,
                         separators=(",", ":"), ensure_ascii=True)
    return "cache:restaurants:v10:" + hashlib.sha256(payload.encode()).hexdigest()


def public_restaurant_conditions():
    return (Restaurant.is_active == True, Restaurant.approval_status == "approved", Restaurant.is_report_suspended == False)


def apply_restaurant_filters(statement, *, search=None, city=None, district=None, price=None,
                             category=None, suitable_for=None, service_type=None, space_level=None,
                             rating=None, has_exclusive=None, utility=None, requires_deposit=None, sort_by=None):
    statement = statement.where(*public_restaurant_conditions())
    for column, value in ((Restaurant.city, city), (Restaurant.district, district)):
        if value:
            statement = statement.where(func.search_normalize_text(column) == normalize_text(value))
    if has_exclusive is not None:
        offer_exists = "EXISTS (SELECT 1 FROM restaurant_discounts d WHERE d.restaurant_id=restaurants.id AND d.is_active AND d.is_public AND d.expires_at>CURRENT_TIMESTAMP)"
        statement = statement.where(text(offer_exists if has_exclusive else "NOT " + offer_exists))
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
        statement = statement.where(Restaurant.capacity >= SPACE_MINIMUMS[space_level])
    if rating is not None:
        statement = statement.where(Restaurant.rating >= rating)
    if utility is not None:
        statement = statement.where(Restaurant.id.in_(select(RestaurantDetail.restaurant_id).where(
            RestaurantDetail.utilities.op("&&")(array([utility]))
        )))
    if requires_deposit is not None:
        statement = statement.where(Restaurant.id.in_(select(RestaurantDetail.restaurant_id).where(
            RestaurantDetail.requires_deposit == requires_deposit
        )))

    relevance = []
    if search is not None:
        suitable_tags, remaining = suitability_in_search(search)
        if suitable_tags:
            statement = statement.where(func.search_normalize_tags(Restaurant.suitable_for).op("@>")(array(suitable_tags)))
        utility_ids, search_without_utilities = utility_ids_in_search(remaining)
        if utility_ids:
            utility_restaurant_ids = select(RestaurantDetail.restaurant_id).where(
                RestaurantDetail.utilities.op("@>")(array(utility_ids))
            )
            statement = statement.where(Restaurant.id.in_(utility_restaurant_ids))
        query_text = search_tsquery(search_without_utilities)
        if not query_text:
            if not utility_ids and not suitable_tags:
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
