from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    username: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class BookReviewSummary(BaseModel):
    book_id: int
    average_rating: float
    total_reviews: int
