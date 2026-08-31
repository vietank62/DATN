"""Website chatbot gateway backed by the same read-only tools exposed through MCP."""

import re

from fastapi import APIRouter
from pydantic import BaseModel, Field

from mcp_server import find_public_restaurants


router = APIRouter(prefix="/v1/assistant", tags=["Assistant"])


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    city: str | None = Field(default=None, max_length=100)


class AssistantReply(BaseModel):
    message: str
    restaurants: list[dict] = []


SEARCH_INTENT_WORDS = ("tìm", "gợi ý", "nhà hàng", "quán", "ăn", "buffet", "lẩu", "nướng")


def extract_search_keyword(message: str) -> str:
    cleaned = re.sub(
        r"\b(tìm|gợi ý|nhà hàng|quán|ăn|cho tôi|giúp tôi|ở|tại|với|món)\b",
        " ",
        message.lower(),
    )
    return re.sub(r"\s+", " ", cleaned).strip()


@router.post("/chat", response_model=AssistantReply)
def chat_with_assistant(payload: AssistantMessage) -> AssistantReply:
    """A safe initial chat experience until an LLM host is connected to MCP."""
    message = payload.message.strip()
    normalized_message = message.lower()

    if any(word in normalized_message for word in SEARCH_INTENT_WORDS):
        keyword = extract_search_keyword(message)
        restaurants = find_public_restaurants(
            keyword=keyword,
            city=payload.city,
            limit=4,
        )

        if restaurants:
            location_text = f" tại {payload.city}" if payload.city else ""
            return AssistantReply(
                message=(
                    f"Mình tìm được {len(restaurants)} nhà hàng phù hợp{location_text}. "
                    "Bạn có thể bấm vào từng nhà hàng để xem chi tiết và đặt bàn."
                ),
                restaurants=restaurants,
            )

        return AssistantReply(
            message=(
                "Mình chưa tìm thấy nhà hàng phù hợp. Bạn hãy thử đổi từ khóa, "
                "danh mục hoặc thành phố nhé."
            )
        )

    return AssistantReply(
        message=(
            "Mình có thể giúp bạn tìm nhà hàng, gợi ý lẩu/nướng/buffet, "
            "hoặc tìm theo khu vực. Bạn muốn dùng bữa ở đâu?"
        )
    )
