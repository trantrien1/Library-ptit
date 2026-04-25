from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── History item (dùng nội bộ khi gọi pipeline) ──────────────────────────────
class HistoryMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


# ── Request gửi tin nhắn ─────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    mode: str = Field("qa", pattern="^(qa|library|summary|quiz|flashcard)$")
    options: dict[str, Any] = Field(default_factory=dict)


# ── Nguồn sách trả về ────────────────────────────────────────────────────────
class BookSource(BaseModel):
    book_id: int | None = None
    title: str = ""
    author: str = ""
    category: str = ""
    available_quantity: int = 0
    relevance_score: float | None = None


# ── Response một lượt chat ───────────────────────────────────────────────────
class ChatResponse(BaseModel):
    answer: str
    rewritten_query: str
    sources: list[BookSource] = []
    result_type: str = "text"
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Session ──────────────────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    title: str = "Cuộc trò chuyện mới"


class SessionUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class MessageOut(BaseModel):
    id: int
    sender_type: str
    content: str
    metadata_: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    title: str
    version: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SessionDetailOut(SessionOut):
    messages: list[MessageOut] = []


# ── Index response ───────────────────────────────────────────────────────────
class IndexResponse(BaseModel):
    message: str
    indexed_count: int
