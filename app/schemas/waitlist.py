from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class WaitlistStatus(str, Enum):
    waiting = "waiting"
    fulfilled = "fulfilled"
    cancelled = "cancelled"


class WaitlistCreate(BaseModel):
    book_id: int
    quantity: int = 1


class WaitlistResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    quantity: int
    status: WaitlistStatus
    created_at: datetime
    notified_at: Optional[datetime] = None
    book_title: Optional[str] = None
    book_author: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
