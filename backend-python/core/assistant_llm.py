"""Optional LLM extraction for the restaurant chatbot.

The model only turns conversational Vietnamese into validated filters. The
existing FastAPI/PostgreSQL query remains the source of truth for results.
"""

import json
import logging
import os
from typing import Any

import httpx

from core.assistant_intent import CITY_ALIASES, FOOD_QUERY_ALIASES, LOCATIONS, OCCASIONS, SERVICES
from core.restaurant_search import normalize_text
from core.llm_provider import structured_output


logger = logging.getLogger(__name__)

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "keyword": {"type": ["string", "null"]},
        "city": {"type": ["string", "null"], "enum": [*CITY_ALIASES, None]},
        "district": {"type": ["string", "null"]},
        "party_size": {"type": ["integer", "null"], "minimum": 1, "maximum": 1000},
        "min_price": {"type": ["integer", "null"], "minimum": 0},
        "max_price": {"type": ["integer", "null"], "minimum": 0},
        "rating": {"type": ["number", "null"], "minimum": 0, "maximum": 5},
        "suitable_for": {"type": ["string", "null"], "enum": [*OCCASIONS.values(), None]},
        "service_type": {"type": ["string", "null"], "enum": [*SERVICES.values(), None]},
        "has_exclusive": {"type": ["boolean", "null"]},
    },
    "required": ["keyword", "city", "district", "party_size", "min_price", "max_price", "rating", "suitable_for", "service_type", "has_exclusive"],
}

_INSTRUCTIONS = """You extract restaurant-search filters from Vietnamese customer messages.
Return only the requested JSON schema. Do not answer the customer, invent a restaurant,
claim a table is available, infer a location that was not said, or include personal data.
Prices are VND per person. Use only the permitted city and service/occasion values.
For an unknown or absent value, return null. The latest message overrides earlier context."""


def _response_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for output in payload.get("output", []):
        for content in output.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    return ""


def _valid_district(value: object) -> tuple[str, str] | None:
    if not isinstance(value, str):
        return None
    wanted = normalize_text(value)
    for city, districts in LOCATIONS.items():
        for district in districts:
            if normalize_text(district) == wanted:
                return city, district
    return None


def sanitize_llm_filters(value: object) -> dict[str, Any]:
    """Accept only values that the local search API can safely use."""
    if not isinstance(value, dict):
        return {}
    result: dict[str, Any] = {}
    keyword = value.get("keyword")
    if isinstance(keyword, str) and 0 < len(keyword.strip()) <= 100:
        normalized_keyword = normalize_text(keyword)
        result["keyword"] = FOOD_QUERY_ALIASES.get(normalized_keyword, keyword.strip())
    district = _valid_district(value.get("district"))
    city = value.get("city")
    if district:
        result["city"], result["district"] = district
    elif city in CITY_ALIASES:
        result["city"] = city
    for key, minimum, maximum in (("party_size", 1, 1000), ("min_price", 0, 10_000_000), ("max_price", 0, 10_000_000)):
        candidate = value.get(key)
        if isinstance(candidate, int) and minimum <= candidate <= maximum:
            result[key] = candidate
    rating = value.get("rating")
    if isinstance(rating, (int, float)) and not isinstance(rating, bool) and 0 <= rating <= 5:
        result["rating"] = float(rating)
    for key, allowed in (("suitable_for", set(OCCASIONS.values())), ("service_type", set(SERVICES.values()))):
        if value.get(key) in allowed:
            result[key] = value[key]
    if isinstance(value.get("has_exclusive"), bool):
        result["has_exclusive"] = value["has_exclusive"]
    if result.get("min_price", 0) > result.get("max_price", 10_000_000):
        result.pop("min_price", None)
        result.pop("max_price", None)
    return result


def extract_llm_filters(message: str, history: list[str]) -> dict[str, Any] | None:
    """Call the configured provider; failures deliberately use rule parsing."""
    context = "\n".join(f"- {item}" for item in history[-5:] if item.strip())
    try:
        text = structured_output(
            _INSTRUCTIONS,
            f"Earlier customer context (may be empty):\n{context}\n\nLatest customer message:\n{message}",
            _SCHEMA, "restaurant_filters", timeout=8.0,
        )
        return sanitize_llm_filters(json.loads(text))
    except (RuntimeError, httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning("Assistant LLM extraction failed; using rule-based parser (%s)", type(exc).__name__)
        return None
