"""Website chatbot gateway backed by the same read-only tools exposed through MCP."""


from fastapi import APIRouter
from pydantic import BaseModel, Field

from core.public_restaurants import find_public_restaurants
from core.assistant_intent import parse_restaurant_request


router = APIRouter(prefix="/v1/assistant", tags=["Assistant"])


class AssistantMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    city: str | None = Field(default=None, max_length=100)


class AssistantReply(BaseModel):
    message: str
    restaurants: list[dict] = Field(default_factory=list)


@router.post("/chat", response_model=AssistantReply)
def chat_with_assistant(payload: AssistantMessage) -> AssistantReply:
    intent = parse_restaurant_request(payload.message, payload.city)
    if intent.question:
        return AssistantReply(message=intent.question)
    restaurants = find_public_restaurants(**intent.filters, limit=4)
    criteria = "; ".join(intent.labels)
    if restaurants:
        message = f"Mình tìm được {len(restaurants)} nhà hàng theo tiêu chí: {criteria}. Bạn bấm vào nhà hàng để xem chi tiết nhé."
    else:
        message = f"Mình chưa tìm thấy nhà hàng đáp ứng đồng thời: {criteria}. Bạn có thể đổi khu vực hoặc điều chỉnh ngân sách."
    if intent.notes:
        message += " " + " ".join(dict.fromkeys(intent.notes))
    return AssistantReply(message=message, restaurants=restaurants)
