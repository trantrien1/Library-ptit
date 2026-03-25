from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Base schema
class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: int = 0
    cover_image: Optional[str] = None

# Schema cho tạo sách
class BookCreate(BookBase):
    pass

# Schema cho cập nhật sách
class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    cover_image: Optional[str] = None

# Schema response
class BookResponse(BookBase):
    id: int
    available_quantity: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Schema cho danh sách sách với pagination
class BookListResponse(BaseModel):
    items: List[BookResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

