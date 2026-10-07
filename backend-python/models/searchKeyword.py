from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel  # type: ignore


class SearchKeyword(SQLModel, table=True):
    __tablename__ = "search_keywords"

    id: Optional[int] = Field(default=None, primary_key=True)
    keyword: str = Field(max_length=100, unique=True, index=True)
    search_count: int = Field(default=0, index=True)
    last_searched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
