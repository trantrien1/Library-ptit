from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .book import BookResponse

# Schema cho thêm sách vào wishlist
class WishlistAdd(BaseModel):
    book_id: int
    quantity: int = 1

# Schema cho cập nhật wishlist
class WishlistUpdate(BaseModel):
    quantity: int

# Schema response item
class WishlistItemResponse(BaseModel):
    id: int
    book_id: int
    quantity: int
    added_at: datetime
    book: BookResponse

    class Config:
        from_attributes = True

# Schema response danh sách
class WishlistResponse(BaseModel):
    items: List[WishlistItemResponse]
    total_items: int

