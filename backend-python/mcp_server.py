"""MCP tools exposed by TableNow for an AI chatbot or any MCP host.

Only public, read-only data is exposed here. Booking, account, and manager
operations remain behind the existing authenticated FastAPI endpoints.
"""

from typing import Any, Annotated, Literal
from pydantic import Field

from core.public_restaurants import find_public_restaurants, serialize_restaurant
from core.restaurant_search import public_restaurant_conditions
from sqlmodel import select  # type: ignore

from database import engine
from models.menuItem import RestaurantMenuList
from models.resDetail import RestaurantDetail
from models.restaurant import Restaurant
from sqlmodel import Session  # type: ignore

import os
from urllib.parse import urlsplit
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

MCP_AVAILABLE = True


table_now_mcp = MCPServer("TableNow Restaurant Assistant")


@table_now_mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False))
def search_restaurants(
    keyword: Annotated[str, Field(max_length=100)] = "",
    city: Annotated[str | None, Field(max_length=100)] = None,
    district: Annotated[str | None, Field(max_length=100)] = None,
    category: Annotated[str | None, Field(max_length=100)] = None,
    limit: int = 8,
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
    """Search approved, active restaurants using the same filters as the website.

    Price bands: 1 below 100k, 2 below 200k, 3 below 500k, 4 below 1m, 5 from 1m VND.
    Capacity bands: 1 for 1-5, 2 for 6-10, 3 for 11-20, 4 for 21-50, 5 for 51+ people.
    min_price/max_price are inclusive VND per-person average-price bounds.
    party_size filters total capacity, never guarantees available tables.
    Rating is a minimum. Keyword search defaults to relevance; otherwise likes.
    """
    return find_public_restaurants(keyword, city, district, category, limit,
        price=price, suitable_for=suitable_for, service_type=service_type,
        space_level=space_level, rating=rating, has_exclusive=has_exclusive,
        sort_by=sort_by, offset=offset, min_price=min_price, max_price=max_price, party_size=party_size)


@table_now_mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False))
def get_restaurant_profile(restaurant_id: int) -> dict[str, Any]:
    """Get public restaurant information, booking reception hours, and facilities."""
    with Session(engine) as session:
        restaurant = session.exec(select(Restaurant).where(
            Restaurant.id == restaurant_id, *public_restaurant_conditions()
        )).first()
        if not restaurant:
            return {"found": False, "message": "Không tìm thấy nhà hàng đang hoạt động."}

        detail = session.exec(
            select(RestaurantDetail).where(RestaurantDetail.restaurant_id == restaurant_id)
        ).first()
        profile = serialize_restaurant(restaurant)
        profile.update(
            {
                "found": True,
                "booking_opening_time": restaurant.booking_opening_time,
                "booking_closing_time": restaurant.booking_closing_time,
                "description": detail.description if detail else None,
                "price_range": detail.price_range if detail else None,
                "parking_info": detail.parking_info if detail else None,
                "utilities": detail.utilities if detail else [],
                "requires_deposit": detail.requires_deposit if detail else False,
            }
        )
        return profile


@table_now_mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False))
def get_restaurant_menu(restaurant_id: int, limit: int = 20) -> dict[str, Any]:
    """Get available dishes and prices for an active restaurant."""
    safe_limit = max(1, min(limit, 50))

    with Session(engine) as session:
        restaurant = session.exec(select(Restaurant).where(
            Restaurant.id == restaurant_id, *public_restaurant_conditions()
        )).first()
        if not restaurant:
            return {"found": False, "message": "Không tìm thấy nhà hàng đang hoạt động."}

        dishes = session.exec(
            select(RestaurantMenuList)
            .where(RestaurantMenuList.restaurant_id == restaurant_id, RestaurantMenuList.is_available == True)
            .order_by(RestaurantMenuList.id)
            .limit(safe_limit)
        ).all()

        return {
            "found": True,
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant.name,
            "dishes": [
                {
                    "id": dish.id,
                    "name": dish.name,
                    "description": dish.description,
                    "price": dish.price,
                    "category": dish.category,
                    "image_url": dish.image_url,
                    "is_available": dish.is_available,
                }
                for dish in dishes
            ],
        }


@table_now_mcp.prompt()
def table_now_assistant() -> str:
    """Instructions for a polite Vietnamese TableNow restaurant concierge."""
    return (
        "Bạn là trợ lý TableNow. Trả lời bằng tiếng Việt, ngắn gọn và thân thiện. "
        "Hãy dùng tool tìm kiếm trước khi gợi ý nhà hàng hoặc món ăn. "
        "Không tự khẳng định còn bàn; hãy hướng dẫn khách đặt bàn trên TableNow. "
        "Không yêu cầu mật khẩu, mã OTP hoặc dữ liệu thanh toán của khách."
    )


def mcp_transport_security() -> TransportSecuritySettings:
    hosts = {"localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*", "[::1]", "[::1]:*"}
    origins = {"http://localhost", "http://localhost:*", "http://127.0.0.1", "http://127.0.0.1:*"}
    # Render supplies RENDER_EXTERNAL_URL automatically. MCP_PUBLIC_URL supports custom domains.
    for value in (os.getenv("RENDER_EXTERNAL_URL", ""), os.getenv("MCP_PUBLIC_URL", "")):
        if not value:
            continue
        url = urlsplit(value.strip())
        if url.scheme not in {"http", "https"} or not url.netloc or url.username or url.password:
            raise ValueError("MCP public URL must be an HTTP(S) URL without credentials")
        hosts.add(url.netloc)
        origins.add(f"{url.scheme}://{url.netloc}")
    origins.add("https://datn-red.vercel.app")
    frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend:
        origins.add(frontend)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=sorted(hosts), allowed_origins=sorted(origins),
    )


mcp_asgi_app = table_now_mcp.streamable_http_app(
    streamable_http_path="/", stateless_http=True, json_response=True,
    max_request_body_size=65536, transport_security=mcp_transport_security(),
)
