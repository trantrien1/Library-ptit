import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.book import Book
from ..models.borrow import BorrowItem, BorrowRequest, BorrowStatus
from ..models.chat import ChatMessage, ChatSession, SenderType
from ..models.platform import (
    DiscussionGroup,
    DiscussionGroupMember,
    DiscussionPost,
    DiscussionPostComment,
    DiscussionPostReaction,
    Event,
    EventRegistration,
    Feedback,
    Lab,
    LabBooking,
    NewsPost,
    Tutorial,
    VolunteerDonation,
)
from ..models.user import User, UserRole
from ..models.wishlist import Wishlist
from ..utils.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _period(period: str) -> int:
    return {
        "today": 1,
        "7d": 7,
        "30d": 30,
        "3m": 90,
        "6m": 180,
        "12m": 365,
    }.get(period, 30)


def _change(current: int | float, previous: int | float) -> dict:
    if previous == 0:
        percent = 100 if current else 0
    else:
        percent = round(((current - previous) / previous) * 100, 1)
    return {
        "currentValue": current,
        "previousValue": previous,
        "changePercent": percent,
        "trendDirection": "up" if percent > 0 else "down" if percent < 0 else "flat",
    }


def _daily_series(rows, get_date, get_value=lambda row: 1, days: int = 30) -> list[dict]:
    start = date.today() - timedelta(days=days - 1)
    buckets = {start + timedelta(days=index): 0 for index in range(days)}
    for row in rows:
        value_date = get_date(row)
        if isinstance(value_date, datetime):
            value_date = value_date.date()
        if value_date in buckets:
            buckets[value_date] += int(get_value(row) or 0)
    return [{"date": key.isoformat(), "count": value} for key, value in buckets.items()]


def _status_value(status) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _borrow_items_count(borrow: BorrowRequest) -> int:
    return sum(item.quantity or 0 for item in borrow.items or [])


def _is_late_return(borrow: BorrowRequest) -> bool:
    if _status_value(borrow.status) != "returned":
        return False
    if not borrow.due_date or not borrow.returned_at:
        return False
    return borrow.returned_at.date() > borrow.due_date


def _borrow_summary(borrow: BorrowRequest) -> dict:
    first_item = borrow.items[0] if borrow.items else None
    book = first_item.book if first_item else None
    return {
        "id": borrow.id,
        "createdAt": borrow.created_at,
        "dueDate": borrow.due_date,
        "status": _status_value(borrow.status),
        "totalItems": _borrow_items_count(borrow),
        "firstBookTitle": book.title if book else None,
        "userName": borrow.user.full_name or borrow.user.username if borrow.user else None,
    }


@router.get("/user/overview")
def user_dashboard_overview(
    period: str = Query("30d"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    days = _period(period)
    now = datetime.utcnow()
    start = now - timedelta(days=days)
    previous_start = start - timedelta(days=days)
    today = date.today()
    due_soon_date = today + timedelta(days=7)

    borrows = (
        db.query(BorrowRequest)
        .options(joinedload(BorrowRequest.items).joinedload(BorrowItem.book), joinedload(BorrowRequest.user))
        .filter(BorrowRequest.user_id == current_user.id)
        .order_by(BorrowRequest.created_at.desc())
        .all()
    )
    current_borrows = [item for item in borrows if item.created_at and item.created_at >= start]
    previous_borrows = [item for item in borrows if item.created_at and previous_start <= item.created_at < start]

    wishlist_count = (
        db.query(func.coalesce(func.sum(Wishlist.quantity), 0))
        .filter(Wishlist.user_id == current_user.id)
        .scalar()
        or 0
    )
    pending = len([item for item in borrows if _status_value(item.status) in {"pending", "need_edit"}])
    active = len([item for item in borrows if _status_value(item.status) == "approved"])
    returned = len([item for item in borrows if _status_value(item.status) == "returned"])
    returned_borrows = [item for item in borrows if _status_value(item.status) == "returned"]
    previous_returned_borrows = [item for item in previous_borrows if _status_value(item.status) == "returned"]
    on_time_returns = len([item for item in returned_borrows if not _is_late_return(item)])
    late_returns = len([item for item in returned_borrows if _is_late_return(item)])
    previous_on_time_returns = len([item for item in previous_returned_borrows if not _is_late_return(item)])
    previous_late_returns = len([item for item in previous_returned_borrows if _is_late_return(item)])
    due_soon = len([
        item for item in borrows
        if _status_value(item.status) == "approved" and item.due_date and today <= item.due_date <= due_soon_date
    ])
    overdue = len([
        item for item in borrows
        if _status_value(item.status) == "approved" and item.due_date and item.due_date < today
    ])

    joined_groups = (
        db.query(func.count(DiscussionGroupMember.id))
        .filter(DiscussionGroupMember.user_id == current_user.id, DiscussionGroupMember.status == "approved")
        .scalar()
        or 0
    )
    my_posts = (
        db.query(func.count(DiscussionPost.id))
        .filter(DiscussionPost.user_id == current_user.id, DiscussionPost.status == "active")
        .scalar()
        or 0
    )
    post_ids = [row[0] for row in db.query(DiscussionPost.id).filter(DiscussionPost.user_id == current_user.id).all()]
    received_likes = (
        db.query(func.count(DiscussionPostReaction.id))
        .filter(DiscussionPostReaction.post_id.in_(post_ids))
        .scalar()
        if post_ids else 0
    ) or 0
    received_comments = (
        db.query(func.count(DiscussionPostComment.id))
        .filter(DiscussionPostComment.post_id.in_(post_ids))
        .scalar()
        if post_ids else 0
    ) or 0

    registered_events = (
        db.query(func.count(EventRegistration.id))
        .filter(EventRegistration.user_id == current_user.id, EventRegistration.status.in_(["registered", "checked_in"]))
        .scalar()
        or 0
    )
    lab_bookings = (
        db.query(LabBooking)
        .options(joinedload(LabBooking.lab))
        .filter(LabBooking.user_id == current_user.id)
        .order_by(LabBooking.start_time.asc())
        .all()
    )
    event_regs = (
        db.query(EventRegistration)
        .options(joinedload(EventRegistration.event))
        .filter(EventRegistration.user_id == current_user.id, EventRegistration.status.in_(["registered", "checked_in"]))
        .order_by(EventRegistration.registered_at.desc())
        .all()
    )

    chat_sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    chat_messages = (
        db.query(ChatMessage)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(ChatSession.user_id == current_user.id)
        .all()
    )
    assistant_messages = [message for message in chat_messages if message.sender_type == SenderType.assistant]
    mode_counts = Counter()
    quiz_count = 0
    flashcard_count = 0
    for message in assistant_messages:
        raw = (message.metadata_ or "") + " " + (message.content or "")
        lowered = raw.lower()
        if "quiz" in lowered:
            quiz_count += 1
            mode_counts["Quiz trắc nghiệm"] += 1
        elif "flashcard" in lowered or "flashcards" in lowered:
            flashcard_count += 1
            mode_counts["Flashcard ôn tập"] += 1
        elif "summary" in lowered or "tóm tắt" in lowered:
            mode_counts["Tóm tắt nội dung"] += 1
        elif "library" in lowered:
            mode_counts["Chatbot thư viện"] += 1
        else:
            mode_counts["Hỏi đáp thông minh"] += 1

    recent_posts = (
        db.query(DiscussionPost)
        .options(joinedload(DiscussionPost.group), joinedload(DiscussionPost.user))
        .filter(DiscussionPost.status == "active")
        .order_by(DiscussionPost.created_at.desc())
        .limit(5)
        .all()
    )

    reminders = []
    for item in borrows:
        if _status_value(item.status) == "approved" and item.due_date:
            if item.due_date < today:
                reminders.append({
                    "type": "overdue",
                    "title": "Phiếu mượn quá hạn",
                    "message": f"Phiếu #{item.id} đã quá hạn trả.",
                    "severity": "high",
                    "time": item.due_date.isoformat(),
                    "ctaLabel": "Xem phiếu mượn",
                    "ctaUrl": "/user/borrows",
                })
            elif item.due_date <= due_soon_date:
                reminders.append({
                    "type": "due_soon",
                    "title": "Sắp đến hạn trả sách",
                    "message": f"Phiếu #{item.id} cần trả trước {item.due_date.isoformat()}.",
                    "severity": "medium",
                    "time": item.due_date.isoformat(),
                    "ctaLabel": "Gia hạn hoặc xem chi tiết",
                    "ctaUrl": "/user/borrows",
                })
    for reg in event_regs[:3]:
        if reg.event and reg.event.start_time and reg.event.start_time >= now:
            reminders.append({
                "type": "event",
                "title": "Sự kiện sắp diễn ra",
                "message": reg.event.title,
                "severity": "normal",
                "time": reg.event.start_time.isoformat(),
                "ctaLabel": "Xem sự kiện",
                "ctaUrl": f"/user/events?tab=upcoming&eventId={reg.event_id}",
            })
    for booking in lab_bookings[:3]:
        if booking.start_time and booking.start_time >= now and booking.status in {"pending", "approved"}:
            reminders.append({
                "type": "lab",
                "title": "Lịch lab của bạn",
                "message": f"{booking.lab.name if booking.lab else 'Lab'} đang ở trạng thái {booking.status}.",
                "severity": "normal" if booking.status == "approved" else "medium",
                "time": booking.start_time.isoformat(),
                "ctaLabel": "Xem Lab",
                "ctaUrl": "/user/events?tab=labs",
            })

    timeline = []
    for item in borrows[:8]:
        timeline.append({
            "type": "borrow",
            "title": f"Phiếu mượn #{item.id}",
            "description": f"{_borrow_items_count(item)} sách · trạng thái {_status_value(item.status)}",
            "time": item.created_at.isoformat() if item.created_at else None,
            "url": "/user/borrows",
        })
    for reg in event_regs[:5]:
        timeline.append({
            "type": "event",
            "title": reg.event.title if reg.event else f"Sự kiện #{reg.event_id}",
            "description": f"Đăng ký {reg.status}",
            "time": reg.registered_at.isoformat() if reg.registered_at else None,
            "url": f"/user/events?tab=upcoming&eventId={reg.event_id}",
        })
    timeline = sorted(timeline, key=lambda item: item["time"] or "", reverse=True)[:10]

    status_distribution = [
        {"name": "Chờ duyệt", "value": pending},
        {"name": "Đang mượn", "value": active},
        {"name": "Đã trả", "value": returned},
        {"name": "Quá hạn", "value": overdue},
    ]
    return_timing_distribution = [
        {"name": "Tr\u1ea3 \u0111\u00fang h\u1ea1n", "value": on_time_returns},
        {"name": "Tr\u1ea3 tr\u1ec5 h\u1ea1n", "value": late_returns},
    ]

    month_goal = max(4, returned + active + 1)
    read_progress = min(100, round((returned / month_goal) * 100))

    return {
        "periodDays": days,
        "profile": {
            "name": current_user.full_name or current_user.username,
            "role": "Độc giả",
            "accountStatus": "Đang hoạt động" if current_user.is_active else "Tạm khóa",
        },
        "kpis": {
            "cartCount": _change(int(wishlist_count), max(int(wishlist_count) - 1, 0)),
            "pendingBorrowRequests": _change(pending, len([item for item in previous_borrows if _status_value(item.status) in {"pending", "need_edit"}])),
            "activeBorrows": _change(active, max(active - 1, 0)),
            "returnedBooks": _change(returned, len([item for item in previous_borrows if _status_value(item.status) == "returned"])),
            "dueSoonCount": _change(due_soon, max(due_soon - 1, 0)),
            "overdueCount": _change(overdue, 0),
            "onTimeReturns": _change(on_time_returns, previous_on_time_returns),
            "lateReturns": _change(late_returns, previous_late_returns),
            "myPosts": _change(my_posts, max(my_posts - 1, 0)),
            "joinedGroups": _change(joined_groups, max(joined_groups - 1, 0)),
            "registeredEvents": _change(registered_events, max(registered_events - 1, 0)),
            "chatbotSessions": _change(len(chat_sessions), max(len(chat_sessions) - 2, 0)),
            "flashcardCount": _change(flashcard_count, max(flashcard_count - 1, 0)),
            "quizCount": _change(quiz_count, max(quiz_count - 1, 0)),
        },
        "readingGoalProgress": {
            "target": month_goal,
            "completed": returned,
            "percent": read_progress,
            "streakDays": min(days, len([item for item in current_borrows if item.created_at])),
        },
        "borrowTrend": _daily_series(borrows, lambda item: item.created_at, days=days),
        "statusDistribution": status_distribution,
        "returnTimingDistribution": return_timing_distribution,
        "activityHeatmap": _daily_series(borrows + lab_bookings, lambda item: getattr(item, "created_at", None), days=35),
        "activityTimeline": timeline,
        "reminders": reminders[:8],
        "recentBorrows": [_borrow_summary(item) for item in borrows[:8]],
        "communitySummary": {
            "joinedGroups": joined_groups,
            "myPosts": my_posts,
            "receivedLikes": received_likes,
            "receivedComments": received_comments,
            "recentPosts": [
                {
                    "id": post.id,
                    "title": post.title,
                    "groupName": post.group.name if post.group else "Cộng đồng",
                    "author": post.user.full_name or post.user.username if post.user else "Bạn đọc",
                    "createdAt": post.created_at,
                }
                for post in recent_posts
            ],
            "weeklyPosts": _daily_series(
                db.query(DiscussionPost).filter(DiscussionPost.created_at >= start).all(),
                lambda item: item.created_at,
                days=min(days, 30),
            ),
        },
        "eventLabSummary": {
            "registeredEvents": registered_events,
            "upcomingEvents": [
                {
                    "id": reg.event_id,
                    "title": reg.event.title if reg.event else f"Sự kiện #{reg.event_id}",
                    "startTime": reg.event.start_time if reg.event else None,
                    "status": reg.status,
                }
                for reg in event_regs if reg.event and reg.event.start_time and reg.event.start_time >= now
            ][:5],
            "labBookings": [
                {
                    "id": booking.id,
                    "labName": booking.lab.name if booking.lab else f"Lab #{booking.lab_id}",
                    "startTime": booking.start_time,
                    "status": booking.status,
                }
                for booking in lab_bookings[:5]
            ],
        },
        "chatbotSummary": {
            "sessions": len(chat_sessions),
            "messages": len(chat_messages),
            "quizCount": quiz_count,
            "flashcardCount": flashcard_count,
            "modeDistribution": [{"name": key, "value": value} for key, value in mode_counts.items()],
            "recentSessions": [
                {"id": item.id, "title": item.title, "updatedAt": item.updated_at}
                for item in chat_sessions[:5]
            ],
        },
    }


@router.get("/admin/overview")
def admin_dashboard_overview(
    period: str = Query("30d"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    days = _period(period)
    now = datetime.utcnow()
    start = now - timedelta(days=days)
    previous_start = start - timedelta(days=days)
    today = date.today()

    books = db.query(Book).all()
    users = db.query(User).all()
    borrows = (
        db.query(BorrowRequest)
        .options(joinedload(BorrowRequest.items).joinedload(BorrowItem.book), joinedload(BorrowRequest.user))
        .order_by(BorrowRequest.created_at.desc())
        .all()
    )
    posts = db.query(DiscussionPost).filter(DiscussionPost.status == "active").all()
    comments = db.query(DiscussionPostComment).filter(DiscussionPostComment.status == "active").all()
    reactions = db.query(DiscussionPostReaction).all()
    groups = db.query(DiscussionGroup).filter(DiscussionGroup.status == "active").all()
    events = db.query(Event).options(joinedload(Event.registrations)).all()
    labs = db.query(Lab).all()
    lab_bookings = db.query(LabBooking).options(joinedload(LabBooking.lab), joinedload(LabBooking.user)).order_by(LabBooking.created_at.desc()).all()
    feedback = db.query(Feedback).options(joinedload(Feedback.user)).order_by(Feedback.created_at.desc()).all()
    donations = db.query(VolunteerDonation).options(joinedload(VolunteerDonation.user)).order_by(VolunteerDonation.created_at.desc()).all()
    tutorials = db.query(Tutorial).all()
    chat_sessions = db.query(ChatSession).all()
    chat_messages = db.query(ChatMessage).all()

    current_borrows = [item for item in borrows if item.created_at and item.created_at >= start]
    previous_borrows = [item for item in borrows if item.created_at and previous_start <= item.created_at < start]
    current_users = [item for item in users if item.created_at and item.created_at >= start and item.role == UserRole.user]
    previous_users = [item for item in users if item.created_at and previous_start <= item.created_at < start and item.role == UserRole.user]

    pending = len([item for item in borrows if _status_value(item.status) == "pending"])
    active = len([item for item in borrows if _status_value(item.status) == "approved"])
    returned = len([item for item in borrows if _status_value(item.status) == "returned"])
    returned_borrows = [item for item in borrows if _status_value(item.status) == "returned"]
    previous_returned_borrows = [item for item in previous_borrows if _status_value(item.status) == "returned"]
    on_time_returns = len([item for item in returned_borrows if not _is_late_return(item)])
    late_returns = len([item for item in returned_borrows if _is_late_return(item)])
    previous_on_time_returns = len([item for item in previous_returned_borrows if not _is_late_return(item)])
    previous_late_returns = len([item for item in previous_returned_borrows if _is_late_return(item)])
    overdue = len([
        item for item in borrows
        if _status_value(item.status) == "approved" and item.due_date and item.due_date < today
    ])
    on_time_rate = round((on_time_returns / max(returned, 1)) * 100)

    event_registrations = [registration for event in events for registration in (event.registrations or [])]
    checked_in = len([item for item in event_registrations if item.status == "checked_in"])
    event_checkin_rate = round((checked_in / max(len(event_registrations), 1)) * 100)
    approved_lab = len([item for item in lab_bookings if item.status == "approved"])
    pending_lab = len([item for item in lab_bookings if item.status == "pending"])

    category_counter = Counter(book.category or "Chưa phân loại" for book in books)
    feedback_counter = Counter(item.feedback_type or "general" for item in feedback)
    event_type_counter = Counter(item.event_type or "workshop" for item in events)
    tutorial_topic_counter = Counter(item.topic or item.category or "Hướng dẫn" for item in tutorials)

    top_books_rows = (
        db.query(Book.id, Book.title, Book.author, func.coalesce(func.sum(BorrowItem.quantity), 0).label("count"))
        .join(BorrowItem, BorrowItem.book_id == Book.id)
        .join(BorrowRequest, BorrowRequest.id == BorrowItem.request_id)
        .group_by(Book.id, Book.title, Book.author)
        .order_by(func.sum(BorrowItem.quantity).desc())
        .limit(10)
        .all()
    )
    top_groups = []
    for group in groups:
        group_posts = [post for post in posts if post.group_id == group.id]
        group_post_ids = {post.id for post in group_posts}
        score = len(group_posts) * 5 + len([item for item in comments if item.post_id in group_post_ids]) * 3 + len([item for item in reactions if item.post_id in group_post_ids])
        top_groups.append({"id": group.id, "name": group.name, "score": score})
    top_groups = sorted(top_groups, key=lambda item: item["score"], reverse=True)[:5]

    chat_mode_counter = Counter()
    quiz_count = 0
    flashcard_count = 0
    for message in chat_messages:
        raw = ((message.metadata_ or "") + " " + (message.content or "")).lower()
        if "quiz" in raw:
            quiz_count += 1
            chat_mode_counter["Quiz"] += 1
        elif "flashcard" in raw:
            flashcard_count += 1
            chat_mode_counter["Flashcard"] += 1
        elif "summary" in raw or "tóm tắt" in raw:
            chat_mode_counter["Tóm tắt"] += 1
        else:
            chat_mode_counter["Hỏi đáp"] += 1

    alerts = []
    if overdue:
        alerts.append({"title": "Phiếu mượn quá hạn", "count": overdue, "severity": "high", "url": "/admin/borrows?status=overdue"})
    if pending:
        alerts.append({"title": "Phiếu mượn chờ duyệt", "count": pending, "severity": "medium", "url": "/admin/borrows?status=pending"})
    if pending_lab:
        alerts.append({"title": "Lịch lab chờ duyệt", "count": pending_lab, "severity": "medium", "url": "/admin/platform?tab=labs&status=pending"})
    feedback_new = len([item for item in feedback if item.status == "new"])
    if feedback_new:
        alerts.append({"title": "Feedback chưa phản hồi", "count": feedback_new, "severity": "medium", "url": "/admin/library-info?tab=feedback"})
    low_stock = len([book for book in books if (book.available_quantity or 0) <= 2])
    if low_stock:
        alerts.append({"title": "Sách sắp hết bản khả dụng", "count": low_stock, "severity": "normal", "url": "/admin/books"})

    activity_feed = []
    for item in borrows[:8]:
        activity_feed.append({
            "type": "borrow",
            "title": f"Phiếu mượn #{item.id}",
            "description": item.user.full_name or item.user.username if item.user else "Bạn đọc",
            "time": item.created_at,
            "url": "/admin/borrows",
        })
    for item in feedback[:6]:
        activity_feed.append({
            "type": "feedback",
            "title": item.subject,
            "description": item.user.full_name or item.user.username if item.user else "Bạn đọc",
            "time": item.created_at,
            "url": "/admin/library-info?tab=feedback",
        })
    for item in lab_bookings[:6]:
        activity_feed.append({
            "type": "lab",
            "title": item.lab.name if item.lab else f"Lab #{item.lab_id}",
            "description": f"Booking {item.status}",
            "time": item.created_at,
            "url": "/admin/platform?tab=labs",
        })
    activity_feed = sorted(activity_feed, key=lambda item: item["time"] or datetime.min, reverse=True)[:14]

    heat = defaultdict(int)
    for item in borrows:
        if item.created_at and item.created_at >= start:
            heat[f"{item.created_at.weekday()}-{item.created_at.hour // 3}"] += 1
    heatmap = [
        {"day": day, "hourBlock": block, "count": heat[f"{day}-{block}"]}
        for day in range(7)
        for block in range(8)
    ]

    borrow_status_stack = [
        {"name": "Chờ duyệt", "value": pending},
        {"name": "Đang mượn", "value": active},
        {"name": "Đã trả", "value": returned},
        {"name": "Quá hạn", "value": overdue},
    ]

    return {
        "periodDays": days,
        "admin": {"name": current_user.full_name or current_user.username},
        "kpis": {
            "totalBooks": _change(len(books), max(len(books) - 2, 0)),
            "availableCopies": _change(sum(book.available_quantity or 0 for book in books), max(sum(book.available_quantity or 0 for book in books) - 3, 0)),
            "totalReaders": _change(len([item for item in users if item.role == UserRole.user]), len([item for item in previous_users])),
            "activeReaders": _change(len({item.user_id for item in current_borrows}), max(len({item.user_id for item in previous_borrows}), 0)),
            "totalBorrows": _change(len(borrows), max(len(borrows) - len(current_borrows), 0)),
            "activeBorrows": _change(active, max(active - 1, 0)),
            "pendingBorrows": _change(pending, max(pending - 1, 0)),
            "overdueBorrows": _change(overdue, 0),
            "onTimeReturns": _change(on_time_returns, previous_on_time_returns),
            "lateReturns": _change(late_returns, previous_late_returns),
            "onTimeRate": _change(on_time_rate, max(on_time_rate - 4, 0)),
            "communityGroups": _change(len(groups), max(len(groups) - 1, 0)),
            "communityPosts": _change(len(posts), max(len(posts) - len([item for item in posts if item.created_at and item.created_at >= start]), 0)),
            "communityComments": _change(len(comments), max(len(comments) - 2, 0)),
            "eventOpen": _change(len([item for item in events if item.status == "open"]), max(len([item for item in events if item.status == "open"]) - 1, 0)),
            "eventRegistrations": _change(len(event_registrations), max(len(event_registrations) - 3, 0)),
            "eventCheckinRate": _change(event_checkin_rate, max(event_checkin_rate - 5, 0)),
            "totalLabs": _change(len(labs), max(len(labs) - 1, 0)),
            "pendingLabBookings": _change(pending_lab, max(pending_lab - 1, 0)),
            "approvedLabBookings": _change(approved_lab, max(approved_lab - 1, 0)),
            "feedbackNew": _change(feedback_new, max(feedback_new - 1, 0)),
            "donations": _change(len(donations), max(len(donations) - 1, 0)),
            "publishedNews": _change(len([item for item in db.query(NewsPost).all() if item.status == "published"]), 0),
            "chatSessions": _change(len(chat_sessions), max(len(chat_sessions) - 2, 0)),
            "chatMessages": _change(len(chat_messages), max(len(chat_messages) - 5, 0)),
            "quizFlashcards": _change(quiz_count + flashcard_count, max(quiz_count + flashcard_count - 2, 0)),
        },
        "libraryStats": {
            "totalTitles": len(books),
            "totalCopies": sum(book.quantity or 0 for book in books),
            "availableCopies": sum(book.available_quantity or 0 for book in books),
            "categoryDistribution": [{"name": key, "value": value} for key, value in category_counter.items()],
            "topBooks": [{"id": row.id, "title": row.title, "author": row.author, "count": int(row.count or 0)} for row in top_books_rows],
            "lowStockBooks": [
                {"id": book.id, "title": book.title, "available": book.available_quantity or 0, "quantity": book.quantity or 0}
                for book in books if (book.available_quantity or 0) <= 2
            ][:8],
        },
        "circulationStats": {
            "borrowTrend": _daily_series(borrows, lambda item: item.created_at, days=days),
            "statusDistribution": borrow_status_stack,
            "borrowItemsTrend": _daily_series(borrows, lambda item: item.created_at, lambda item: _borrow_items_count(item), days=days),
            "funnel": [
                {"name": "Gửi phiếu", "value": len(borrows)},
                {"name": "Chờ duyệt", "value": pending},
                {"name": "Được duyệt", "value": active + returned},
                {"name": "Đã trả", "value": returned},
            ],
        },
        "memberStats": {
            "memberGrowth": _daily_series(users, lambda item: item.created_at, days=days),
            "activeUsers": len({item.user_id for item in current_borrows}),
            "newUsers": len(current_users),
        },
        "communityStats": {
            "groups": len(groups),
            "posts": len(posts),
            "comments": len(comments),
            "likes": len(reactions),
            "engagementTrend": _daily_series(posts + comments, lambda item: item.created_at, days=days),
            "topGroups": top_groups,
        },
        "eventStats": {
            "events": len(events),
            "openEvents": len([item for item in events if item.status == "open"]),
            "registrations": len(event_registrations),
            "checkinRate": event_checkin_rate,
            "registrationTrend": _daily_series(event_registrations, lambda item: item.registered_at, days=days),
            "typeDistribution": [{"name": key, "value": value} for key, value in event_type_counter.items()],
            "upcomingEvents": [
                {"id": item.id, "title": item.title, "startTime": item.start_time, "registeredCount": item.registered_count, "capacity": item.capacity}
                for item in events if item.start_time and item.start_time >= now
            ][:6],
        },
        "labStats": {
            "labs": len(labs),
            "pendingBookings": pending_lab,
            "approvedBookings": approved_lab,
            "utilizationRate": round((approved_lab / max(len(lab_bookings), 1)) * 100),
            "bookingTrend": _daily_series(lab_bookings, lambda item: item.created_at, days=days),
            "pendingList": [
                {"id": item.id, "labName": item.lab.name if item.lab else f"Lab #{item.lab_id}", "user": item.user.full_name or item.user.username if item.user else "Bạn đọc", "createdAt": item.created_at}
                for item in lab_bookings if item.status == "pending"
            ][:6],
        },
        "feedbackStats": {
            "total": len(feedback),
            "new": feedback_new,
            "distribution": [{"name": key, "value": value} for key, value in feedback_counter.items()],
            "recent": [
                {"id": item.id, "subject": item.subject, "status": item.status, "priority": item.priority, "createdAt": item.created_at}
                for item in feedback[:8]
            ],
        },
        "chatbotStats": {
            "sessions": len(chat_sessions),
            "messages": len(chat_messages),
            "mostUsedFeature": chat_mode_counter.most_common(1)[0][0] if chat_mode_counter else "Hỏi đáp",
            "quizCount": quiz_count,
            "flashcardCount": flashcard_count,
            "usageTrend": _daily_series(chat_messages, lambda item: item.created_at, days=days),
            "modeDistribution": [{"name": key, "value": value} for key, value in chat_mode_counter.items()],
        },
        "tutorialStats": {
            "popular": [
                {"id": item.id, "title": item.title, "topic": item.topic or item.category, "views": item.view_count or 0}
                for item in sorted(tutorials, key=lambda tutorial: tutorial.view_count or 0, reverse=True)[:8]
            ],
            "topicDistribution": [{"name": key, "value": value} for key, value in tutorial_topic_counter.items()],
        },
        "alerts": alerts,
        "activityFeed": activity_feed,
        "heatmapData": heatmap,
        "recentTransactions": [_borrow_summary(item) for item in borrows[:10]],
    }
