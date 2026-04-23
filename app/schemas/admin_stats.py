from datetime import date, datetime
from typing import List
from pydantic import BaseModel


class AdminRecentBorrow(BaseModel):
    id: int
    user_id: int
    user_name: str
    status: str
    created_at: datetime
    due_date: date | None = None
    total_items: int


class AdminOverviewResponse(BaseModel):
    period_days: int
    total_titles: int
    total_book_copies: int
    available_book_copies: int
    borrowed_book_copies: int
    total_users: int
    total_admins: int
    new_users_in_period: int
    active_users_in_period: int
    borrow_requests_in_period: int
    borrow_items_in_period: int
    pending_borrows: int
    active_borrows: int
    overdue_borrows: int
    recent_borrows: List[AdminRecentBorrow]


class CategoryStat(BaseModel):
    category: str
    title_count: int
    copy_count: int


class TopBorrowedBook(BaseModel):
    book_id: int
    title: str
    author: str | None = None
    category: str | None = None
    borrow_count: int


class LowStockBook(BaseModel):
    book_id: int
    title: str
    available_quantity: int
    quantity: int


class AdminBookStatsResponse(BaseModel):
    period_days: int
    category_distribution: List[CategoryStat]
    top_borrowed_books: List[TopBorrowedBook]
    low_stock_books: List[LowStockBook]


class RoleStat(BaseModel):
    role: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class TopActiveUser(BaseModel):
    user_id: int
    user_name: str
    request_count: int
    total_items: int


class AdminUserStatsResponse(BaseModel):
    period_days: int
    role_distribution: List[RoleStat]
    registrations_by_day: List[DailyCount]
    users_with_borrows: int
    users_without_borrows: int
    active_users_in_period: int
    inactive_users_in_period: int
    top_active_users: List[TopActiveUser]

