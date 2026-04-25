import secrets
import string
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.book import Book
from ..models.borrow import BorrowItem
from ..models.platform import (
    Booking,
    BookingResource,
    ChallengeParticipant,
    DigitalResource,
    DiscussionGroup,
    DiscussionGroupMember,
    DiscussionPost,
    DiscussionPostComment,
    DiscussionPostReaction,
    DiscussionPostSave,
    Event,
    Feedback,
    LibrarianQuestion,
    NewsPost,
    PrintJob,
    ReadingChallenge,
    Recommendation,
    Tutorial,
    UserBadge,
    VolunteerDonation,
)
from ..models.user import User
from ..schemas.platform import (
    BookingCreate,
    BookingOut,
    BookingResourceCreate,
    BookingResourceOut,
    ChallengeParticipantOut,
    DigitalResourceCreate,
    DigitalResourceOut,
    DiscussionGroupCreate,
    DiscussionGroupMemberOut,
    DiscussionGroupOut,
    DiscussionPostCommentCreate,
    DiscussionPostCommentOut,
    DiscussionPostCreate,
    DiscussionPostOut,
    DiscussionPostUpdate,
    EventCreate,
    EventOut,
    FeedbackCreate,
    FeedbackOut,
    LibrarianQuestionCreate,
    LibrarianQuestionOut,
    NewsPostCreate,
    NewsPostOut,
    PlatformOverview,
    PrintJobCreate,
    PrintJobOut,
    ReadingChallengeCreate,
    ReadingChallengeOut,
    RecommendationOut,
    SocialActionOut,
    SocialHubSidebar,
    TutorialCreate,
    TutorialOut,
    UserBadgeOut,
    VolunteerDonationCreate,
    VolunteerDonationOut,
)
from ..utils.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/api/platform", tags=["Digital Library Platform"])


def _pickup_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _post_action_counts(db: Session, post_id: int) -> tuple[int, int]:
    like_count = (
        db.query(DiscussionPostReaction)
        .filter(
            DiscussionPostReaction.post_id == post_id,
            DiscussionPostReaction.reaction_type == "like",
        )
        .count()
    )
    save_count = db.query(DiscussionPostSave).filter(DiscussionPostSave.post_id == post_id).count()
    return like_count, save_count


def _is_admin(user) -> bool:
    return str(getattr(user.role, "value", user.role)) == "admin"


def _membership(group: DiscussionGroup, user_id: int):
    return next((member for member in group.members or [] if member.user_id == user_id), None)


def _is_group_admin(group: DiscussionGroup, user_id: int) -> bool:
    membership = _membership(group, user_id)
    return bool(membership and membership.status == "approved" and membership.role in {"admin", "owner"})


def _approved_member(group: DiscussionGroup, user_id: int) -> bool:
    membership = _membership(group, user_id)
    return bool(membership and membership.status == "approved")


def _serialize_group(group: DiscussionGroup, current_user) -> dict:
    membership = _membership(group, current_user.id)
    return {
        "id": group.id,
        "name": group.name,
        "slug": group.slug,
        "topic": group.topic,
        "description": group.description,
        "owner_id": group.owner_id,
        "is_public": group.is_public,
        "requires_approval": group.requires_approval,
        "rules": group.rules,
        "status": group.status,
        "created_at": group.created_at,
        "member_count": group.member_count,
        "post_count": group.post_count,
        "is_member": bool(membership and membership.status == "approved"),
        "membership_status": membership.status if membership else None,
        "group_role": membership.role if membership else None,
        "is_group_admin": bool(membership and membership.status == "approved" and membership.role in {"admin", "owner"}),
    }


def _serialize_post(post: DiscussionPost, current_user) -> dict:
    group_admin = bool(post.group and _is_group_admin(post.group, current_user.id))
    is_author = post.user_id == current_user.id
    return {
        "id": post.id,
        "group_id": post.group_id,
        "user_id": post.user_id,
        "book_id": post.book_id,
        "title": post.title,
        "content": post.content,
        "post_type": post.post_type,
        "tags": post.tags,
        "rating": post.rating,
        "status": post.status,
        "created_at": post.created_at,
        "user": post.user,
        "book": post.book,
        "group": _serialize_group(post.group, current_user) if post.group else None,
        "like_count": post.like_count,
        "comment_count": post.comment_count,
        "save_count": post.save_count,
        "liked_by_me": any(
            reaction.user_id == current_user.id and reaction.reaction_type == "like"
            for reaction in post.reactions or []
        ),
        "saved_by_me": any(save.user_id == current_user.id for save in post.saves or []),
        "is_owner": is_author,
        "can_edit": is_author,
        "can_delete": is_author or group_admin or _is_admin(current_user),
    }


@router.get("/overview", response_model=PlatformOverview)
def platform_overview(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.utcnow()
    return PlatformOverview(
        digital_resources=db.query(DigitalResource).count(),
        discussion_groups=db.query(DiscussionGroup).count(),
        discussion_posts=db.query(DiscussionPost).count(),
        active_challenges=db.query(ReadingChallenge)
        .filter(ReadingChallenge.start_date <= now, ReadingChallenge.end_date >= now)
        .count(),
        booking_resources=db.query(BookingResource).count(),
        upcoming_events=db.query(Event).filter(Event.start_time >= now).count(),
        news_posts=db.query(NewsPost).filter(NewsPost.published.is_(True)).count(),
    )


# 1. AI-powered discovery and digital resources
@router.get("/resources", response_model=list[DigitalResourceOut])
def list_digital_resources(
    search: str | None = None,
    resource_type: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(DigitalResource).order_by(DigitalResource.created_at.desc())
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                DigitalResource.title.ilike(term),
                DigitalResource.description.ilike(term),
                DigitalResource.subjects.ilike(term),
            )
        )
    if resource_type:
        query = query.filter(DigitalResource.resource_type == resource_type)
    return query.limit(limit).all()


@router.post("/resources", response_model=DigitalResourceOut, status_code=status.HTTP_201_CREATED)
def create_digital_resource(
    body: DigitalResourceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    resource = DigitalResource(**body.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.get("/discover/new-titles")
def discover_new_titles(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(Book).order_by(Book.created_at.desc()).limit(limit).all()


@router.get("/recommendations", response_model=list[RecommendationOut])
def personalized_recommendations(
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    saved = (
        db.query(Recommendation)
        .options(joinedload(Recommendation.book))
        .filter(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.score.desc(), Recommendation.created_at.desc())
        .limit(limit)
        .all()
    )
    if saved:
        return saved

    borrow_counts = (
        db.query(
            BorrowItem.book_id.label("book_id"),
            func.coalesce(func.sum(BorrowItem.quantity), 0).label("borrow_count"),
        )
        .group_by(BorrowItem.book_id)
        .subquery()
    )
    popular_books = (
        db.query(Book, func.coalesce(borrow_counts.c.borrow_count, 0).label("borrow_count"))
        .outerjoin(borrow_counts, borrow_counts.c.book_id == Book.id)
        .order_by(func.coalesce(borrow_counts.c.borrow_count, 0).desc(), Book.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": book.id,
            "reason": "Gợi ý dựa trên tài liệu mới và lượt mượn phổ biến trong thư viện.",
            "score": float(borrow_count or 0),
            "book": book,
        }
        for book, borrow_count in popular_books
    ]


# 2. Social hub
@router.get("/groups", response_model=list[DiscussionGroupOut])
def list_groups(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    groups = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.status == "active")
        .order_by(DiscussionGroup.created_at.desc())
        .all()
    )
    return [_serialize_group(group, current_user) for group in groups]


@router.get("/groups/{group_id}", response_model=DiscussionGroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    return _serialize_group(group, current_user)


@router.post("/groups", response_model=DiscussionGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    body: DiscussionGroupCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if db.query(DiscussionGroup).filter(DiscussionGroup.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug nhóm đã tồn tại")
    group = DiscussionGroup(**body.model_dump(), owner_id=current_user.id)
    db.add(group)
    db.flush()
    db.add(
        DiscussionGroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role="admin",
            status="approved",
        )
    )
    db.commit()
    db.refresh(group)
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group.id)
        .first()
    )
    return _serialize_group(group, current_user)


@router.post("/groups/{group_id}/join", response_model=DiscussionGroupOut)
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")

    existing = (
        db.query(DiscussionGroupMember)
        .filter(
            DiscussionGroupMember.group_id == group_id,
            DiscussionGroupMember.user_id == current_user.id,
        )
        .first()
    )
    target_status = "pending" if group.requires_approval else "approved"
    if existing:
        if existing.status == "rejected":
            existing.status = target_status
            existing.role = "member"
    else:
        db.add(
            DiscussionGroupMember(
                group_id=group_id,
                user_id=current_user.id,
                role="member",
                status=target_status,
            )
        )
    db.commit()

    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id)
        .first()
    )

    return _serialize_group(group, current_user)


@router.delete("/groups/{group_id}/leave", response_model=DiscussionGroupOut)
def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")

    membership = (
        db.query(DiscussionGroupMember)
        .filter(
            DiscussionGroupMember.group_id == group_id,
            DiscussionGroupMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        return _serialize_group(group, current_user)

    if membership.status == "approved" and membership.role in {"admin", "owner"}:
        admin_count = sum(
            1
            for member in group.members or []
            if member.status == "approved" and member.role in {"admin", "owner"}
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Bạn là quản trị viên duy nhất. Hãy chuyển quyền quản trị hoặc xóa nhóm trước khi rời nhóm.",
            )

    db.delete(membership)
    db.commit()
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id)
        .first()
    )
    return _serialize_group(group, current_user)


@router.get("/groups/{group_id}/members", response_model=list[DiscussionGroupMemberOut])
def list_group_members(
    group_id: int,
    status_filter: str = Query("approved", pattern="^(approved|pending|rejected|all)$"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    if status_filter in {"pending", "rejected"} and not _is_group_admin(group, current_user.id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem yêu cầu tham gia")

    query = (
        db.query(DiscussionGroupMember)
        .options(joinedload(DiscussionGroupMember.user))
        .filter(DiscussionGroupMember.group_id == group_id)
    )
    if status_filter != "all":
        query = query.filter(DiscussionGroupMember.status == status_filter)
    return query.order_by(DiscussionGroupMember.joined_at.desc()).all()


@router.patch("/groups/{group_id}/members/{user_id}/approve", response_model=DiscussionGroupMemberOut)
def approve_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    if not _is_group_admin(group, current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên nhóm được duyệt thành viên")

    membership = (
        db.query(DiscussionGroupMember)
        .options(joinedload(DiscussionGroupMember.user))
        .filter(
            DiscussionGroupMember.group_id == group_id,
            DiscussionGroupMember.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu tham gia")
    membership.status = "approved"
    if membership.role not in {"admin", "owner"}:
        membership.role = "member"
    db.commit()
    db.refresh(membership)
    return membership


@router.patch("/groups/{group_id}/members/{user_id}/reject", response_model=DiscussionGroupMemberOut)
def reject_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    if not _is_group_admin(group, current_user.id):
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên nhóm được từ chối thành viên")

    membership = (
        db.query(DiscussionGroupMember)
        .options(joinedload(DiscussionGroupMember.user))
        .filter(
            DiscussionGroupMember.group_id == group_id,
            DiscussionGroupMember.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu tham gia")
    membership.status = "rejected"
    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    if not _is_group_admin(group, current_user.id) and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên nhóm được xóa nhóm")

    group.status = "deleted"
    (
        db.query(DiscussionPost)
        .filter(DiscussionPost.group_id == group_id, DiscussionPost.status == "active")
        .update({"status": "deleted"}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True}


@router.get("/feed", response_model=list[DiscussionPostOut])
def activity_feed(
    group_id: int | None = None,
    sort: str = Query("latest", pattern="^(latest|popular|comments)$"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        db.query(DiscussionPost)
        .join(DiscussionGroup, DiscussionGroup.id == DiscussionPost.group_id)
        .options(
            joinedload(DiscussionPost.user),
            joinedload(DiscussionPost.book),
            joinedload(DiscussionPost.group).joinedload(DiscussionGroup.members),
            joinedload(DiscussionPost.comments),
            joinedload(DiscussionPost.reactions),
            joinedload(DiscussionPost.saves),
        )
        .filter(DiscussionPost.status == "active", DiscussionGroup.status == "active")
    )
    if group_id:
        query = query.filter(DiscussionPost.group_id == group_id)
    posts = query.all()
    if sort == "popular":
        posts = sorted(posts, key=lambda post: post.like_count, reverse=True)
    elif sort == "comments":
        posts = sorted(posts, key=lambda post: post.comment_count, reverse=True)
    else:
        posts = sorted(posts, key=lambda post: post.created_at, reverse=True)
    return [_serialize_post(post, current_user) for post in posts[offset : offset + limit]]


@router.post("/posts", response_model=DiscussionPostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    body: DiscussionPostCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.id == body.group_id, DiscussionGroup.status == "active")
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    membership = _membership(group, current_user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Bạn cần tham gia nhóm trước khi đăng bài.")
    if membership.status == "pending":
        raise HTTPException(status_code=403, detail="Yêu cầu tham gia nhóm của bạn đang chờ duyệt.")
    if membership.status != "approved":
        raise HTTPException(status_code=403, detail="Bạn cần tham gia nhóm trước khi đăng bài.")

    post = DiscussionPost(**body.model_dump(), user_id=current_user.id)
    db.add(post)
    db.commit()
    post = (
        db.query(DiscussionPost)
        .options(
            joinedload(DiscussionPost.user),
            joinedload(DiscussionPost.book),
            joinedload(DiscussionPost.group).joinedload(DiscussionGroup.members),
            joinedload(DiscussionPost.comments),
            joinedload(DiscussionPost.reactions),
            joinedload(DiscussionPost.saves),
        )
        .filter(DiscussionPost.id == post.id)
        .first()
    )
    return _serialize_post(post, current_user)


@router.patch("/posts/{post_id}", response_model=DiscussionPostOut)
@router.put("/posts/{post_id}", response_model=DiscussionPostOut)
def update_post(
    post_id: int,
    body: DiscussionPostUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    post = db.query(DiscussionPost).filter(DiscussionPost.id == post_id, DiscussionPost.status == "active").first()
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa bài viết này")
    payload = body.model_dump(exclude_unset=True)
    if "group_id" in payload:
        group = (
            db.query(DiscussionGroup)
            .options(joinedload(DiscussionGroup.members))
            .filter(DiscussionGroup.id == payload["group_id"], DiscussionGroup.status == "active")
            .first()
        )
        if not group:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
        membership = _membership(group, current_user.id)
        if not membership or membership.status != "approved":
            raise HTTPException(status_code=403, detail="Bạn cần tham gia nhóm trước khi đăng bài.")
    if False:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm thảo luận")
    for field, value in payload.items():
        setattr(post, field, value)
    db.commit()
    post = (
        db.query(DiscussionPost)
        .options(
            joinedload(DiscussionPost.user),
            joinedload(DiscussionPost.book),
            joinedload(DiscussionPost.group).joinedload(DiscussionGroup.members),
            joinedload(DiscussionPost.comments),
            joinedload(DiscussionPost.reactions),
            joinedload(DiscussionPost.saves),
        )
        .filter(DiscussionPost.id == post_id)
        .first()
    )
    return _serialize_post(post, current_user)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    post = (
        db.query(DiscussionPost)
        .options(joinedload(DiscussionPost.group).joinedload(DiscussionGroup.members))
        .filter(DiscussionPost.id == post_id, DiscussionPost.status == "active")
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")
    can_delete = post.user_id == current_user.id or _is_admin(current_user) or (
        post.group is not None and _is_group_admin(post.group, current_user.id)
    )
    if not can_delete:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài viết này")
    post.status = "deleted"
    db.commit()
    return {"ok": True}


@router.get("/posts/{post_id}/comments", response_model=list[DiscussionPostCommentOut])
def list_post_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(DiscussionPost).filter(DiscussionPost.id == post_id, DiscussionPost.status == "active").first():
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")
    return (
        db.query(DiscussionPostComment)
        .options(joinedload(DiscussionPostComment.user))
        .filter(DiscussionPostComment.post_id == post_id, DiscussionPostComment.status == "active")
        .order_by(DiscussionPostComment.created_at.asc())
        .all()
    )


@router.post("/posts/{post_id}/comments", response_model=DiscussionPostCommentOut, status_code=status.HTTP_201_CREATED)
def comment_post(
    post_id: int,
    body: DiscussionPostCommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(DiscussionPost).filter(DiscussionPost.id == post_id, DiscussionPost.status == "active").first():
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")
    comment = DiscussionPostComment(post_id=post_id, user_id=current_user.id, content=body.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return (
        db.query(DiscussionPostComment)
        .options(joinedload(DiscussionPostComment.user))
        .filter(DiscussionPostComment.id == comment.id)
        .first()
    )


@router.post("/posts/{post_id}/like", response_model=SocialActionOut)
def toggle_post_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(DiscussionPost).filter(DiscussionPost.id == post_id, DiscussionPost.status == "active").first():
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    existing = (
        db.query(DiscussionPostReaction)
        .filter(
            DiscussionPostReaction.post_id == post_id,
            DiscussionPostReaction.user_id == current_user.id,
            DiscussionPostReaction.reaction_type == "like",
        )
        .first()
    )
    active = existing is None
    if existing:
        db.delete(existing)
    else:
        db.add(DiscussionPostReaction(post_id=post_id, user_id=current_user.id, reaction_type="like"))
    db.commit()
    like_count, save_count = _post_action_counts(db, post_id)
    return SocialActionOut(active=active, like_count=like_count, save_count=save_count)


@router.post("/posts/{post_id}/save", response_model=SocialActionOut)
def toggle_post_save(
    post_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not db.query(DiscussionPost).filter(DiscussionPost.id == post_id, DiscussionPost.status == "active").first():
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    existing = (
        db.query(DiscussionPostSave)
        .filter(
            DiscussionPostSave.post_id == post_id,
            DiscussionPostSave.user_id == current_user.id,
        )
        .first()
    )
    active = existing is None
    if existing:
        db.delete(existing)
    else:
        db.add(DiscussionPostSave(post_id=post_id, user_id=current_user.id))
    db.commit()
    like_count, save_count = _post_action_counts(db, post_id)
    return SocialActionOut(active=active, like_count=like_count, save_count=save_count)


@router.get("/social/sidebar", response_model=SocialHubSidebar)
def social_sidebar(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    groups = (
        db.query(DiscussionGroup)
        .options(joinedload(DiscussionGroup.members))
        .filter(DiscussionGroup.status == "active")
        .all()
    )
    featured_groups = sorted(groups, key=lambda group: group.member_count, reverse=True)[:3]

    leaderboard = []
    users = db.query(User).filter(User.role == "user").all()
    for user in users:
        post_count = (
            db.query(DiscussionPost)
            .filter(DiscussionPost.user_id == user.id, DiscussionPost.status == "active")
            .count()
        )
        comment_count = (
            db.query(DiscussionPostComment)
            .filter(DiscussionPostComment.user_id == user.id, DiscussionPostComment.status == "active")
            .count()
        )
        like_count = (
            db.query(DiscussionPostReaction)
            .filter(
                DiscussionPostReaction.user_id == user.id,
                DiscussionPostReaction.reaction_type == "like",
            )
            .count()
        )
        community_points = like_count * 5 + comment_count * 10
        leaderboard.append(
            {
                "user_id": user.id,
                "full_name": user.full_name,
                "username": user.username,
                "community_points": community_points,
                "post_count": post_count,
                "comment_count": comment_count,
                "like_count": like_count,
                "badge_count": 0,
            }
        )

    return SocialHubSidebar(
        featured_groups=[_serialize_group(group, current_user) for group in featured_groups],
        active_challenges=[],
        leaderboard=sorted(leaderboard, key=lambda item: item["community_points"], reverse=True)[:5],
        my_badges=[],
    )


@router.get("/challenges", response_model=list[ReadingChallengeOut])
def list_challenges(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(ReadingChallenge)
        .options(joinedload(ReadingChallenge.participants))
        .order_by(ReadingChallenge.start_date.desc())
        .all()
    )


@router.post("/challenges", response_model=ReadingChallengeOut, status_code=status.HTTP_201_CREATED)
def create_challenge(
    body: ReadingChallengeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    challenge = ReadingChallenge(**body.model_dump())
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


@router.post("/challenges/{challenge_id}/join", response_model=ChallengeParticipantOut)
def join_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    challenge = db.query(ReadingChallenge).filter(ReadingChallenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Không tìm thấy thử thách")
    participant = (
        db.query(ChallengeParticipant)
        .filter(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == current_user.id,
        )
        .first()
    )
    if participant:
        return participant
    participant = ChallengeParticipant(challenge_id=challenge_id, user_id=current_user.id)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.get("/badges/me", response_model=list[UserBadgeOut])
def my_badges(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(UserBadge).filter(UserBadge.user_id == current_user.id).order_by(UserBadge.awarded_at.desc()).all()


# 3. Reader services
@router.get("/booking-resources", response_model=list[BookingResourceOut])
def list_booking_resources(
    resource_type: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(BookingResource).order_by(BookingResource.resource_type, BookingResource.name)
    if resource_type:
        query = query.filter(BookingResource.resource_type == resource_type)
    return query.all()


@router.post("/booking-resources", response_model=BookingResourceOut, status_code=status.HTTP_201_CREATED)
def create_booking_resource(
    body: BookingResourceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    resource = BookingResource(**body.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(Booking)
        .options(joinedload(Booking.resource))
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.start_time.desc())
        .all()
    )


@router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    resource = db.query(BookingResource).filter(BookingResource.id == body.resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài nguyên đặt chỗ")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
    booking = Booking(**body.model_dump(), user_id=current_user.id)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/print-jobs", response_model=list[PrintJobOut])
def my_print_jobs(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(PrintJob).filter(PrintJob.user_id == current_user.id).order_by(PrintJob.created_at.desc()).all()


@router.post("/print-jobs", response_model=PrintJobOut, status_code=status.HTTP_201_CREATED)
def create_print_job(
    body: PrintJobCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    job = PrintJob(**body.model_dump(), user_id=current_user.id, pickup_code=_pickup_code())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/librarian-questions", response_model=list[LibrarianQuestionOut])
def my_librarian_questions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(LibrarianQuestion)
        .filter(LibrarianQuestion.user_id == current_user.id)
        .order_by(LibrarianQuestion.created_at.desc())
        .all()
    )


@router.post("/librarian-questions", response_model=LibrarianQuestionOut, status_code=status.HTTP_201_CREATED)
def ask_librarian(
    body: LibrarianQuestionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    question = LibrarianQuestion(**body.model_dump(), user_id=current_user.id)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


# 4. Events, training, innovation lab
@router.get("/events", response_model=list[EventOut])
def list_events(
    include_recorded: bool = True,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Event)
    if not include_recorded:
        query = query.filter(Event.recorded_url.is_(None))
    return query.order_by(Event.start_time.desc()).all()


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    event = Event(**body.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/tutorials", response_model=list[TutorialOut])
def list_tutorials(
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Tutorial).order_by(Tutorial.created_at.desc())
    if category:
        query = query.filter(Tutorial.category == category)
    return query.all()


@router.post("/tutorials", response_model=TutorialOut, status_code=status.HTTP_201_CREATED)
def create_tutorial(
    body: TutorialCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    tutorial = Tutorial(**body.model_dump())
    db.add(tutorial)
    db.commit()
    db.refresh(tutorial)
    return tutorial


# 5. Library information and official channels
@router.get("/news", response_model=list[NewsPostOut])
def list_news(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(NewsPost)
        .filter(NewsPost.published.is_(True))
        .order_by(NewsPost.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/news", response_model=NewsPostOut, status_code=status.HTTP_201_CREATED)
def create_news(
    body: NewsPostCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    post = NewsPost(**body.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    feedback = Feedback(**body.model_dump(), user_id=current_user.id)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.post("/volunteer-donations", response_model=VolunteerDonationOut, status_code=status.HTTP_201_CREATED)
def submit_volunteer_or_donation(
    body: VolunteerDonationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = VolunteerDonation(**body.model_dump(), user_id=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
