from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    restaurant_id: int


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
