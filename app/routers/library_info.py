import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.platform import Feedback, LibrarySetting, NewsPost, VolunteerDonation, VolunteerProgram
from ..schemas.platform import (
    DonationStatusUpdate,
    FeedbackCreate,
    FeedbackOut,
    FeedbackStatusUpdate,
    LibraryInfoOut,
    LibraryInfoUpdate,
    NewsPostCreate,
    NewsPostOut,
    NewsPostUpdate,
    VolunteerDonationCreate,
    VolunteerDonationOut,
    VolunteerProgramCreate,
    VolunteerProgramOut,
    VolunteerProgramUpdate,
)
from ..utils.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/api", tags=["Library Information"])

NEWS_TYPES = {"announcement", "event", "lab", "tutorial", "volunteer", "system"}
TARGET_TYPES = {"none", "event", "lab", "tutorial", "volunteer"}
NEWS_STATUSES = {"published", "hidden"}
FEEDBACK_STATUSES = {"new", "in_progress", "replied", "closed"}
DONATION_STATUSES = {"new", "contacted", "received", "rejected", "submitted"}


def _is_admin(user) -> bool:
    return str(getattr(user.role, "value", user.role)) == "admin"


def _validate_news(payload: dict, *, partial: bool = False):
    if not partial and not str(payload.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="Tiêu đề tin tức không được để trống")
    if not partial and not str(payload.get("content") or "").strip():
        raise HTTPException(status_code=400, detail="Nội dung tin tức không được để trống")
    if payload.get("news_type") and payload["news_type"] not in NEWS_TYPES:
        raise HTTPException(status_code=400, detail="Loại tin tức không hợp lệ")
    if payload.get("related_target_type") and payload["related_target_type"] not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Loại liên kết không hợp lệ")
    if payload.get("status") and payload["status"] not in NEWS_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái tin tức không hợp lệ")


def _news_cta(post: NewsPost) -> tuple[str | None, str | None]:
    if post.cta_label and post.cta_url:
        return post.cta_label, post.cta_url
    if post.related_target_type == "event":
        target = f"&eventId={post.related_target_id}" if post.related_target_id else ""
        return "Đăng ký sự kiện", f"/user/events?tab=upcoming{target}"
    if post.related_target_type == "lab":
        target = f"&labId={post.related_target_id}" if post.related_target_id else ""
        return "Đặt lịch Lab", f"/user/events?tab=labs{target}"
    if post.related_target_type == "tutorial":
        target = f"&tutorialId={post.related_target_id}" if post.related_target_id else ""
        return "Xem hướng dẫn", f"/user/events?tab=tutorials{target}"
    if post.related_target_type == "volunteer":
        return "Đăng ký tham gia", post.cta_url or "/user/library-info?section=volunteer"
    return post.cta_label, post.cta_url


def _serialize_news(post: NewsPost) -> dict:
    cta_label, cta_url = _news_cta(post)
    return {
        "id": post.id,
        "title": post.title,
        "category": post.category,
        "news_type": post.news_type or post.category or "announcement",
        "summary": post.summary,
        "content": post.content,
        "published": post.published,
        "status": post.status or ("published" if post.published else "hidden"),
        "related_target_type": post.related_target_type or "none",
        "related_target_id": post.related_target_id,
        "cta_label": cta_label,
        "cta_url": cta_url,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
    }


def _default_library_info() -> dict:
    now = datetime.now()
    open_now = now.weekday() < 5 and 7 <= now.hour < 21 or now.weekday() >= 5 and 8 <= now.hour < 17
    return {
        "today_status": "Đang mở cửa" if open_now else "Đã đóng cửa",
        "locations": [
            {
                "name": "Thư viện trung tâm",
                "location": "Tòa nhà thư viện PTIT",
                "description": "Khu mượn trả, đọc tại chỗ, tra cứu tài liệu và hỗ trợ bạn đọc.",
            },
            {
                "name": "Khu tự học, Lab, phòng nhóm",
                "location": "Tầng 1-4, Library PTIT",
                "description": "Không gian tự học, phòng học nhóm, Innovation Lab và khu thiết bị nghiên cứu.",
            },
        ],
        "opening_hours": [
            {"label": "Thứ 2 - Thứ 6", "hours": "07:30 - 21:00"},
            {"label": "Thứ 7 - Chủ nhật", "hours": "08:00 - 17:00"},
            {"label": "Ngày lễ", "hours": "Theo thông báo của thư viện"},
        ],
        "rules": [
            "Giữ trật tự trong khu đọc và khu tự học.",
            "Xuất trình thẻ thư viện hoặc mã sinh viên khi được yêu cầu.",
            "Đặt lịch trước khi sử dụng lab, phòng nhóm hoặc thiết bị đặc thù.",
            "Không tự ý di chuyển, tháo lắp thiết bị của thư viện.",
        ],
    }


def _load_library_info(db: Session) -> dict:
    data = _default_library_info()
    settings = {item.setting_key: item.setting_value for item in db.query(LibrarySetting).all()}
    for key in ("locations", "opening_hours", "rules"):
        if key in settings:
            try:
                data[key] = json.loads(settings[key])
            except json.JSONDecodeError:
                pass
    return data


@router.get("/library-info", response_model=LibraryInfoOut)
def get_library_info(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return _load_library_info(db)


@router.patch("/library-info", response_model=LibraryInfoOut)
def update_library_info(
    body: LibraryInfoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    for key, value in body.model_dump(exclude_unset=True).items():
        setting = db.query(LibrarySetting).filter(LibrarySetting.setting_key == key).first()
        if setting:
            setting.setting_value = json.dumps(value, ensure_ascii=False)
        else:
            db.add(LibrarySetting(setting_key=key, setting_value=json.dumps(value, ensure_ascii=False)))
    db.commit()
    return _load_library_info(db)


@router.get("/news", response_model=list[NewsPostOut])
def list_news(
    type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(NewsPost)
    if not _is_admin(current_user):
        query = query.filter(NewsPost.status == "published", NewsPost.published.is_(True))
    elif status_filter:
        query = query.filter(NewsPost.status == status_filter)
    if type:
        query = query.filter(or_(NewsPost.news_type == type, NewsPost.category == type))
    if search:
        term = f"%{search}%"
        query = query.filter(or_(NewsPost.title.ilike(term), NewsPost.summary.ilike(term), NewsPost.content.ilike(term)))
    return [_serialize_news(post) for post in query.order_by(NewsPost.created_at.desc()).limit(limit).all()]


@router.get("/news/{news_id}", response_model=NewsPostOut)
def get_news(news_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    post = db.query(NewsPost).filter(NewsPost.id == news_id).first()
    if not post or (not _is_admin(current_user) and (post.status != "published" or not post.published)):
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tức")
    return _serialize_news(post)


@router.post("/news", response_model=NewsPostOut, status_code=status.HTTP_201_CREATED)
def create_news(body: NewsPostCreate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    payload = body.model_dump()
    _validate_news(payload)
    payload["published"] = payload.get("status", "published") == "published" and payload.get("published", True)
    post = NewsPost(**payload)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize_news(post)


@router.patch("/news/{news_id}", response_model=NewsPostOut)
def update_news(news_id: int, body: NewsPostUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    post = db.query(NewsPost).filter(NewsPost.id == news_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tức")
    payload = body.model_dump(exclude_unset=True)
    _validate_news(payload, partial=True)
    for field, value in payload.items():
        setattr(post, field, value)
    if "status" in payload:
        post.published = payload["status"] == "published"
    db.commit()
    db.refresh(post)
    return _serialize_news(post)


@router.delete("/news/{news_id}")
def delete_news(news_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    post = db.query(NewsPost).filter(NewsPost.id == news_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tức")
    post.status = "hidden"
    post.published = False
    db.commit()
    return {"ok": True}


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(body: FeedbackCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not body.subject.strip() or not body.message.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập chủ đề và nội dung góp ý")
    feedback = Feedback(**body.model_dump(), user_id=current_user.id, status="new")
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/my-feedback", response_model=list[FeedbackOut])
def my_feedback(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (
        db.query(Feedback)
        .options(joinedload(Feedback.user))
        .filter(Feedback.user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )


@router.get("/feedback", response_model=list[FeedbackOut])
def list_feedback(
    feedback_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    query = db.query(Feedback).options(joinedload(Feedback.user))
    if feedback_type:
        query = query.filter(Feedback.feedback_type == feedback_type)
    if status_filter:
        query = query.filter(Feedback.status == status_filter)
    if priority:
        query = query.filter(Feedback.priority == priority)
    return query.order_by(Feedback.created_at.desc()).all()


@router.patch("/feedback/{feedback_id}/status", response_model=FeedbackOut)
def update_feedback_status(
    feedback_id: int,
    body: FeedbackStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    if body.status not in FEEDBACK_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái góp ý không hợp lệ")
    feedback = db.query(Feedback).options(joinedload(Feedback.user)).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Không tìm thấy góp ý")
    feedback.status = body.status
    db.commit()
    db.refresh(feedback)
    return feedback


@router.post("/donations", response_model=VolunteerDonationOut, status_code=status.HTTP_201_CREATED)
def submit_donation(
    body: VolunteerDonationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = VolunteerDonation(**body.model_dump(), user_id=current_user.id, status="new")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/donations", response_model=list[VolunteerDonationOut])
def list_donations(db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    return (
        db.query(VolunteerDonation)
        .options(joinedload(VolunteerDonation.user))
        .order_by(VolunteerDonation.created_at.desc())
        .all()
    )


@router.patch("/donations/{donation_id}/status", response_model=VolunteerDonationOut)
def update_donation_status(
    donation_id: int,
    body: DonationStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    if body.status not in DONATION_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái đóng góp không hợp lệ")
    item = db.query(VolunteerDonation).options(joinedload(VolunteerDonation.user)).filter(VolunteerDonation.id == donation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy đăng ký đóng góp")
    item.status = body.status
    db.commit()
    db.refresh(item)
    return item


@router.get("/volunteer-programs", response_model=list[VolunteerProgramOut])
def list_volunteer_programs(
    include_hidden: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(VolunteerProgram)
    if not include_hidden or not _is_admin(current_user):
        query = query.filter(VolunteerProgram.status == "open")
    return query.order_by(VolunteerProgram.created_at.desc()).all()


@router.post("/volunteer-programs", response_model=VolunteerProgramOut, status_code=status.HTTP_201_CREATED)
def create_volunteer_program(
    body: VolunteerProgramCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Tên chương trình không được để trống")
    program = VolunteerProgram(**body.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@router.patch("/volunteer-programs/{program_id}", response_model=VolunteerProgramOut)
def update_volunteer_program(
    program_id: int,
    body: VolunteerProgramUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    program = db.query(VolunteerProgram).filter(VolunteerProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Không tìm thấy chương trình tình nguyện")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(program, field, value)
    db.commit()
    db.refresh(program)
    return program
