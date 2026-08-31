"""MCP tools exposed by TableNow for an AI chatbot or any MCP host.

Only public, read-only data is exposed here. Booking, account, and manager
operations remain behind the existing authenticated FastAPI endpoints.
"""

from typing import Any

from sqlalchemy.dialects.postgresql import array
from sqlmodel import select  # type: ignore

from database import engine
from models.menuItem import RestaurantMenuList
from models.resDetail import RestaurantDetail
from models.restaurant import Restaurant
from sqlmodel import Session  # type: ignore

try:
    from mcp.server import MCPServer

    MCP_AVAILABLE = True
except ModuleNotFoundError:
    MCP_AVAILABLE = False

    class MCPServer:  # type: ignore[no-redef]
        """Keeps public chatbot search available when MCP is not installed."""

        def __init__(self, name: str):
            self.name = name

        def tool(self):
            return lambda function: function

        def prompt(self):
            return lambda function: function

        def streamable_http_app(self, **_kwargs):
            return None


table_now_mcp = MCPServer("TableNow Restaurant Assistant")


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


def find_public_restaurants(
    keyword: str = "",
    city: str | None = None,
    district: str | None = None,
    category: str | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Shared data function used by both the MCP server and website assistant."""
    safe_limit = max(1, min(limit, 20))

    with Session(engine) as session:
        statement = select(Restaurant).where(Restaurant.is_active == True)

        if city:
            statement = statement.where(Restaurant.city == city.strip())
        if district:
            statement = statement.where(Restaurant.district == district.strip())
        if category:
            statement = statement.where(
                Restaurant.category.op("@>")(array([category.strip()]))
            )
        if keyword.strip():
            search_pattern = f"%{keyword.strip()}%"
            statement = statement.where(
                Restaurant.name.ilike(search_pattern)
                | Restaurant.address.ilike(search_pattern)
            )

        restaurants = session.exec(
            statement.order_by(Restaurant.rating.desc(), Restaurant.like_count.desc()).limit(safe_limit)
        ).all()

        return [serialize_restaurant(restaurant) for restaurant in restaurants]


@table_now_mcp.tool()
def search_restaurants(
    keyword: str = "",
    city: str | None = None,
    district: str | None = None,
    category: str | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Find active TableNow restaurants by keyword and optional location/category."""
    return find_public_restaurants(keyword, city, district, category, limit)


@table_now_mcp.tool()
def get_restaurant_profile(restaurant_id: int) -> dict[str, Any]:
    """Get public restaurant information, booking reception hours, and facilities."""
    with Session(engine) as session:
        restaurant = session.get(Restaurant, restaurant_id)
        if not restaurant or not restaurant.is_active:
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


@table_now_mcp.tool()
def get_restaurant_menu(restaurant_id: int, limit: int = 20) -> dict[str, Any]:
    """Get available dishes and prices for an active restaurant."""
    safe_limit = max(1, min(limit, 50))

    with Session(engine) as session:
        restaurant = session.get(Restaurant, restaurant_id)
        if not restaurant or not restaurant.is_active:
            return {"found": False, "message": "Không tìm thấy nhà hàng đang hoạt động."}

        dishes = session.exec(
            select(RestaurantMenuList)
            .where(RestaurantMenuList.restaurant_id == restaurant_id)
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


mcp_asgi_app = table_now_mcp.streamable_http_app(streamable_http_path="/")
