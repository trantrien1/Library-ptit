from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.book import Book
from ..models.borrow import BorrowItem, BorrowRequest, BorrowStatus
from ..models.user import User, UserRole
from ..schemas.admin_stats import (
    AdminBookStatsResponse,
    AdminOverviewResponse,
    AdminRecentBorrow,
    AdminUserStatsResponse,
    CategoryStat,
    DailyCount,
    LowStockBook,
    RoleStat,
    TopActiveUser,
    TopBorrowedBook,
)
from ..utils.dependencies import get_current_admin

router = APIRouter(prefix="/api/admin/stats", tags=["Admin Stats"])
ALLOWED_PERIOD_DAYS = [7, 30, 90]


@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    period_days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Thống kê tổng quan cho dashboard admin."""
    del current_user

    now = datetime.now(timezone.utc)
    if period_days not in ALLOWED_PERIOD_DAYS:
        period_days = 30
    period_start = now - timedelta(days=period_days)
    today = date.today()

    total_titles = db.query(func.count(Book.id)).scalar() or 0
    total_book_copies = db.query(func.coalesce(func.sum(Book.quantity), 0)).scalar() or 0
    available_book_copies = db.query(func.coalesce(func.sum(Book.available_quantity), 0)).scalar() or 0
    borrowed_book_copies = max(total_book_copies - available_book_copies, 0)

    total_users = db.query(func.count(User.id)).filter(User.role == UserRole.user).scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role == UserRole.admin).scalar() or 0
    new_users_in_period = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.user, User.created_at >= period_start)
        .scalar()
        or 0
    )

    active_users_in_period = (
        db.query(func.count(func.distinct(BorrowRequest.user_id)))
        .join(User, User.id == BorrowRequest.user_id)
        .filter(User.role == UserRole.user, BorrowRequest.created_at >= period_start)
        .scalar()
        or 0
    )

    borrow_requests_in_period = (
        db.query(func.count(BorrowRequest.id)).filter(BorrowRequest.created_at >= period_start).scalar() or 0
    )
    borrow_items_in_period = (
        db.query(func.coalesce(func.sum(BorrowItem.quantity), 0))
        .join(BorrowRequest, BorrowRequest.id == BorrowItem.request_id)
        .filter(BorrowRequest.created_at >= period_start)
        .scalar()
        or 0
    )

    pending_borrows = (
        db.query(func.count(BorrowRequest.id))
        .filter(BorrowRequest.status == BorrowStatus.pending)
        .scalar()
        or 0
    )
    active_borrows = (
        db.query(func.count(BorrowRequest.id))
        .filter(BorrowRequest.status == BorrowStatus.approved)
        .scalar()
        or 0
    )
    overdue_borrows = (
        db.query(func.count(BorrowRequest.id))
        .filter(
            BorrowRequest.status == BorrowStatus.approved,
            BorrowRequest.due_date.isnot(None),
            BorrowRequest.due_date < today,
        )
        .scalar()
        or 0
    )

    recent_rows = (
        db.query(
            BorrowRequest.id,
            BorrowRequest.user_id,
            User.full_name,
            User.username,
            BorrowRequest.status,
            BorrowRequest.created_at,
            BorrowRequest.due_date,
            func.coalesce(func.sum(BorrowItem.quantity), 0).label("total_items"),
        )
        .join(User, User.id == BorrowRequest.user_id)
        .outerjoin(BorrowItem, BorrowItem.request_id == BorrowRequest.id)
        .group_by(
            BorrowRequest.id,
            BorrowRequest.user_id,
            User.full_name,
            User.username,
            BorrowRequest.status,
            BorrowRequest.created_at,
            BorrowRequest.due_date,
        )
        .order_by(BorrowRequest.created_at.desc())
        .limit(5)
        .all()
    )

    recent_borrows = [
        AdminRecentBorrow(
            id=row.id,
            user_id=row.user_id,
            user_name=row.full_name or row.username,
            status=row.status.value if hasattr(row.status, "value") else str(row.status),
            created_at=row.created_at,
            due_date=row.due_date,
            total_items=int(row.total_items or 0),
        )
        for row in recent_rows
    ]

    return AdminOverviewResponse(
        period_days=int(period_days),
        total_titles=int(total_titles),
        total_book_copies=int(total_book_copies),
        available_book_copies=int(available_book_copies),
        borrowed_book_copies=int(borrowed_book_copies),
        total_users=int(total_users),
        total_admins=int(total_admins),
        new_users_in_period=int(new_users_in_period),
        active_users_in_period=int(active_users_in_period),
        borrow_requests_in_period=int(borrow_requests_in_period),
        borrow_items_in_period=int(borrow_items_in_period),
        pending_borrows=int(pending_borrows),
        active_borrows=int(active_borrows),
        overdue_borrows=int(overdue_borrows),
        recent_borrows=recent_borrows,
    )


@router.get("/books", response_model=AdminBookStatsResponse)
async def get_admin_book_stats(
    period_days: int = Query(30, ge=7, le=90),
    low_stock_threshold: int = Query(2, ge=0, le=100),
    top_limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Thống kê theo sách: phân bố danh mục, top mượn nhiều, sách sắp hết."""
    del current_user

    if period_days not in ALLOWED_PERIOD_DAYS:
        period_days = 30
    period_start = datetime.now(timezone.utc) - timedelta(days=period_days)

    category_rows = (
        db.query(
            func.coalesce(Book.category, "Chua phan loai").label("category"),
            func.count(Book.id).label("title_count"),
            func.coalesce(func.sum(Book.quantity), 0).label("copy_count"),
        )
        .group_by(func.coalesce(Book.category, "Chua phan loai"))
        .order_by(func.count(Book.id).desc())
        .all()
    )

    category_distribution = [
        CategoryStat(
            category=row.category,
            title_count=int(row.title_count or 0),
            copy_count=int(row.copy_count or 0),
        )
        for row in category_rows
    ]

    top_rows = (
        db.query(
            Book.id,
            Book.title,
            Book.author,
            Book.category,
            func.coalesce(func.sum(BorrowItem.quantity), 0).label("borrow_count"),
        )
        .join(BorrowItem, BorrowItem.book_id == Book.id)
        .join(BorrowRequest, BorrowRequest.id == BorrowItem.request_id)
        .filter(
            BorrowRequest.status.in_([BorrowStatus.approved, BorrowStatus.returned]),
            BorrowRequest.created_at >= period_start,
        )
        .group_by(Book.id, Book.title, Book.author, Book.category)
        .order_by(func.sum(BorrowItem.quantity).desc(), Book.title.asc())
        .limit(top_limit)
        .all()
    )

    top_borrowed_books = [
        TopBorrowedBook(
            book_id=row.id,
            title=row.title,
            author=row.author,
            category=row.category,
            borrow_count=int(row.borrow_count or 0),
        )
        for row in top_rows
    ]

    low_stock_rows = (
        db.query(Book.id, Book.title, Book.available_quantity, Book.quantity)
        .filter(Book.available_quantity <= low_stock_threshold)
        .order_by(Book.available_quantity.asc(), Book.title.asc())
        .limit(top_limit)
        .all()
    )

    low_stock_books = [
        LowStockBook(
            book_id=row.id,
            title=row.title,
            available_quantity=int(row.available_quantity or 0),
            quantity=int(row.quantity or 0),
        )
        for row in low_stock_rows
    ]

    return AdminBookStatsResponse(
        period_days=int(period_days),
        category_distribution=category_distribution,
        top_borrowed_books=top_borrowed_books,
        low_stock_books=low_stock_books,
    )


@router.get("/users", response_model=AdminUserStatsResponse)
async def get_admin_user_stats(
    period_days: int = Query(30, ge=7, le=90),
    top_limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Thống kê theo người dùng: vai trò, đăng ký mới, mức độ hoạt động."""
    del current_user

    now = datetime.now(timezone.utc)
    if period_days not in ALLOWED_PERIOD_DAYS:
        period_days = 30
    period_start = now - timedelta(days=period_days - 1)

    role_rows = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    role_distribution = [
        RoleStat(
            role=row[0].value if hasattr(row[0], "value") else str(row[0]),
            count=int(row[1] or 0),
        )
        for row in role_rows
    ]

    registrations_rows = (
        db.query(
            func.date(User.created_at).label("created_date"),
            func.count(User.id).label("count"),
        )
        .filter(User.created_at >= period_start)
        .group_by(func.date(User.created_at))
        .all()
    )
    registration_map = {str(row.created_date): int(row.count or 0) for row in registrations_rows}

    registrations_by_day = []
    for i in range(period_days):
        day = (period_start + timedelta(days=i)).date()
        day_key = day.isoformat()
        registrations_by_day.append(DailyCount(date=day_key, count=registration_map.get(day_key, 0)))

    total_users = db.query(func.count(User.id)).filter(User.role == UserRole.user).scalar() or 0

    users_with_borrows = (
        db.query(func.count(func.distinct(BorrowRequest.user_id)))
        .join(User, User.id == BorrowRequest.user_id)
        .filter(User.role == UserRole.user)
        .scalar()
        or 0
    )
    users_without_borrows = max(int(total_users) - int(users_with_borrows), 0)

    active_users_in_period = (
        db.query(func.count(func.distinct(BorrowRequest.user_id)))
        .join(User, User.id == BorrowRequest.user_id)
        .filter(User.role == UserRole.user, BorrowRequest.created_at >= period_start)
        .scalar()
        or 0
    )
    inactive_users_in_period = max(int(total_users) - int(active_users_in_period), 0)

    top_rows = (
        db.query(
            User.id,
            User.full_name,
            User.username,
            func.count(func.distinct(BorrowRequest.id)).label("request_count"),
            func.coalesce(func.sum(BorrowItem.quantity), 0).label("total_items"),
        )
        .join(BorrowRequest, BorrowRequest.user_id == User.id)
        .outerjoin(BorrowItem, BorrowItem.request_id == BorrowRequest.id)
        .filter(User.role == UserRole.user, BorrowRequest.created_at >= period_start)
        .group_by(User.id, User.full_name, User.username)
        .order_by(func.count(func.distinct(BorrowRequest.id)).desc(), func.sum(BorrowItem.quantity).desc())
        .limit(top_limit)
        .all()
    )

    top_active_users = [
        TopActiveUser(
            user_id=row.id,
            user_name=row.full_name or row.username,
            request_count=int(row.request_count or 0),
            total_items=int(row.total_items or 0),
        )
        for row in top_rows
    ]

    return AdminUserStatsResponse(
        period_days=int(period_days),
        role_distribution=role_distribution,
        registrations_by_day=registrations_by_day,
        users_with_borrows=int(users_with_borrows),
        users_without_borrows=int(users_without_borrows),
        active_users_in_period=int(active_users_in_period),
        inactive_users_in_period=int(inactive_users_in_period),
        top_active_users=top_active_users,
    )

