from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class RenewalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BorrowRenewalCreate(BaseModel):
    requested_days: int = 7
    reason: Optional[str] = None


class BorrowRenewalResponse(BaseModel):
    id: int
    request_id: int
    status: RenewalStatus
    requested_days: int
    reason: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
