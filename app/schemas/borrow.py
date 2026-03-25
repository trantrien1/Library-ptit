from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from enum import Enum
from .book import BookResponse
from .user import UserResponse

class BorrowStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    returned = "returned"
    need_edit = "need_edit"

# Schema cho item trong phiếu mượn
class BorrowItemCreate(BaseModel):
    book_id: int
    quantity: int = 1

class BorrowItemResponse(BaseModel):
    id: int
    book_id: int
    quantity: int
    book: BookResponse

    class Config:
        from_attributes = True

# Schema cho tạo phiếu mượn
class BorrowRequestCreate(BaseModel):
    note: Optional[str] = None
    due_date: date  # User phải nhập ngày trả
    items: Optional[List[BorrowItemCreate]] = None  # Nếu None, lấy từ wishlist

# Schema cho cập nhật phiếu mượn (khi need_edit)
class BorrowRequestUpdate(BaseModel):
    note: Optional[str] = None
    due_date: Optional[date] = None
    items: List[BorrowItemCreate]

# Schema cho admin duyệt (chỉ cần ghi chú, không sửa ngày trả)
class BorrowApprove(BaseModel):
    admin_note: Optional[str] = None

# Schema cho admin từ chối/yêu cầu chỉnh sửa
class BorrowReject(BaseModel):
    admin_note: str
    require_edit: bool = False  # True = need_edit, False = rejected

# Schema response
class BorrowRequestResponse(BaseModel):
    id: int
    user_id: int
    status: BorrowStatus
    note: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    due_date: Optional[date] = None
    returned_at: Optional[datetime] = None
    items: List[BorrowItemResponse]
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Schema cho danh sách phiếu mượn
class BorrowListResponse(BaseModel):
    items: List[BorrowRequestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

