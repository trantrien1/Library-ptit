from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models.platform import Event, EventRegistration, Lab, LabBooking, Tutorial
from ..schemas.platform import (
    AdminNoteIn,
    EventCheckinIn,
    EventCreate,
    EventOut,
    EventRegistrationOut,
    EventUpdate,
    LabBookingCreate,
    LabBookingOut,
    LabCreate,
    LabOut,
    LabUpdate,
    TutorialCreate,
    TutorialOut,
    TutorialUpdate,
)
from ..utils.dependencies import get_current_admin, get_current_user

router = APIRouter(prefix="/api", tags=["Events and Labs"])

EVENT_TYPES = {"workshop", "talk", "training", "tutorial", "lab_session"}
EVENT_FORMATS = {"offline", "online", "hybrid"}
EVENT_STATUSES = {"draft", "open", "closed", "ended", "cancelled"}
REGISTRATION_ACTIVE = {"registered", "checked_in"}
LAB_STATUSES = {"available", "in_use", "maintenance", "unavailable"}
BOOKING_STATUSES = {"pending", "approved", "rejected", "cancelled", "completed"}
TUTORIAL_LEVELS = {"beginner", "intermediate", "advanced"}
TUTORIAL_STATUSES = {"draft", "published", "hidden"}


def _is_admin(user) -> bool:
    return str(getattr(user.role, "value", user.role)) == "admin"


def _event_query(db: Session):
    return db.query(Event).options(joinedload(Event.registrations).joinedload(EventRegistration.user))


def _serialize_event(event: Event, current_user) -> dict:
    my_registration = next(
        (
            registration
            for registration in event.registrations or []
            if registration.user_id == current_user.id and registration.status in REGISTRATION_ACTIVE
        ),
        None,
    )
    return {
        "id": event.id,
        "title": event.title,
        "event_type": event.event_type,
        "description": event.description,
        "speaker": event.speaker,
        "format": event.format,
        "location": event.location,
        "online_link": event.online_link,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "capacity": event.capacity,
        "registration_deadline": event.registration_deadline,
        "status": event.status,
        "tags": event.tags,
        "thumbnail": event.thumbnail,
        "materials": event.materials,
        "recorded_url": event.recorded_url,
        "require_checkin": event.require_checkin,
        "created_by": event.created_by,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "registered_count": event.registered_count,
        "registered_by_me": my_registration is not None,
        "my_registration": my_registration,
    }


def _validate_event_payload(payload: dict, *, partial: bool = False):
    title = payload.get("title")
    if not partial and not str(title or "").strip():
        raise HTTPException(status_code=400, detail="Tên sự kiện không được để trống")
    if payload.get("event_type") and payload["event_type"] not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Loại sự kiện không hợp lệ")
    if payload.get("format") and payload["format"] not in EVENT_FORMATS:
        raise HTTPException(status_code=400, detail="Hình thức sự kiện không hợp lệ")
    if payload.get("status") and payload["status"] not in EVENT_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái sự kiện không hợp lệ")
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    if start_time and end_time and start_time >= end_time:
        raise HTTPException(status_code=400, detail="Thời gian bắt đầu phải trước thời gian kết thúc")
    capacity = payload.get("capacity")
    if capacity is not None and capacity <= 0:
        raise HTTPException(status_code=400, detail="Sức chứa phải lớn hơn 0")
    deadline = payload.get("registration_deadline")
    if start_time and deadline and deadline > start_time:
        raise HTTPException(status_code=400, detail="Hạn đăng ký phải trước thời gian bắt đầu")
    event_format = payload.get("format")
    if event_format == "online" and not payload.get("online_link"):
        raise HTTPException(status_code=400, detail="Sự kiện online cần có link tham gia")
    if event_format == "offline" and not payload.get("location"):
        raise HTTPException(status_code=400, detail="Sự kiện offline cần có địa điểm")


@router.get("/events", response_model=list[EventOut])
def list_events(
    type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    upcoming: bool | None = None,
    registered_by_me: bool | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = _event_query(db)
    if not _is_admin(current_user):
        query = query.filter(Event.status.in_(["open", "closed", "ended"]))
    if type:
        query = query.filter(Event.event_type == type)
    if status_filter:
        query = query.filter(Event.status == status_filter)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Event.title.ilike(term), Event.description.ilike(term), Event.tags.ilike(term)))
    if upcoming is True:
        query = query.filter(Event.start_time >= datetime.utcnow(), Event.status.in_(["open", "closed"]))
    events = query.order_by(Event.start_time.asc()).all()
    if registered_by_me:
        events = [
            event for event in events
            if any(item.user_id == current_user.id and item.status in REGISTRATION_ACTIVE for item in event.registrations or [])
        ]
    return [_serialize_event(event, current_user) for event in events]


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    event = _event_query(db).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    if not _is_admin(current_user) and event.status not in {"open", "closed", "ended"}:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    return _serialize_event(event, current_user)


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(body: EventCreate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    payload = body.model_dump()
    _validate_event_payload(payload)
    event = Event(**payload, created_by=current_user.id)
    db.add(event)
    db.commit()
    event = _event_query(db).filter(Event.id == event.id).first()
    return _serialize_event(event, current_user)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, body: EventUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    payload = body.model_dump(exclude_unset=True)
    merged = {
        "title": event.title,
        "event_type": event.event_type,
        "format": event.format,
        "location": event.location,
        "online_link": event.online_link,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "capacity": event.capacity,
        "registration_deadline": event.registration_deadline,
        "status": event.status,
        **payload,
    }
    _validate_event_payload(merged, partial=True)
    for field, value in payload.items():
        setattr(event, field, value)
    db.commit()
    event = _event_query(db).filter(Event.id == event_id).first()
    return _serialize_event(event, current_user)


@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    event.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.post("/events/{event_id}/register", response_model=EventOut)
def register_event(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    event = _event_query(db).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    now = datetime.utcnow()
    if event.status != "open":
        raise HTTPException(status_code=400, detail="Sự kiện không mở đăng ký")
    if event.registration_deadline and event.registration_deadline < now:
        raise HTTPException(status_code=400, detail="Sự kiện đã hết hạn đăng ký")
    if event.capacity and event.registered_count >= event.capacity:
        raise HTTPException(status_code=400, detail="Sự kiện đã đủ chỗ")
    registration = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event_id, EventRegistration.user_id == current_user.id)
        .first()
    )
    if registration and registration.status in REGISTRATION_ACTIVE:
        raise HTTPException(status_code=400, detail="Bạn đã đăng ký sự kiện này")
    if registration:
        registration.status = "registered"
        registration.registered_at = now
        registration.cancelled_at = None
        registration.checked_in_at = None
    else:
        db.add(EventRegistration(event_id=event_id, user_id=current_user.id, status="registered"))
    db.commit()
    event = _event_query(db).filter(Event.id == event_id).first()
    return _serialize_event(event, current_user)


@router.delete("/events/{event_id}/register", response_model=EventOut)
def cancel_event_registration(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    registration = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event_id, EventRegistration.user_id == current_user.id)
        .first()
    )
    if registration and registration.status in REGISTRATION_ACTIVE:
        registration.status = "cancelled"
        registration.cancelled_at = datetime.utcnow()
        db.commit()
    event = _event_query(db).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Không tìm thấy sự kiện")
    return _serialize_event(event, current_user)


@router.get("/events/{event_id}/registrations", response_model=list[EventRegistrationOut])
def event_registrations(event_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    return (
        db.query(EventRegistration)
        .options(joinedload(EventRegistration.user))
        .filter(EventRegistration.event_id == event_id, EventRegistration.status.in_(["registered", "checked_in", "absent"]))
        .order_by(EventRegistration.registered_at.desc())
        .all()
    )


@router.post("/events/{event_id}/checkin", response_model=EventRegistrationOut)
def checkin_event(event_id: int, body: EventCheckinIn, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    query = db.query(EventRegistration).options(joinedload(EventRegistration.user)).filter(EventRegistration.event_id == event_id)
    if body.registration_id:
        query = query.filter(EventRegistration.id == body.registration_id)
    elif body.user_id:
        query = query.filter(EventRegistration.user_id == body.user_id)
    else:
        raise HTTPException(status_code=400, detail="Cần user_id hoặc registration_id")
    registration = query.first()
    if not registration:
        raise HTTPException(status_code=404, detail="Không tìm thấy đăng ký")
    if registration.status != "registered":
        raise HTTPException(status_code=400, detail="Chỉ check-in đăng ký đang hợp lệ")
    registration.status = "checked_in"
    registration.checked_in_at = datetime.utcnow()
    db.commit()
    db.refresh(registration)
    return registration


def _validate_lab_payload(payload: dict, *, partial: bool = False):
    if not partial and not str(payload.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Tên lab không được để trống")
    if payload.get("status") and payload["status"] not in LAB_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái lab không hợp lệ")
    capacity = payload.get("capacity")
    if capacity is not None and capacity <= 0:
        raise HTTPException(status_code=400, detail="Sức chứa lab phải lớn hơn 0")


@router.get("/labs", response_model=list[LabOut])
def list_labs(
    status_filter: str | None = Query(None, alias="status"),
    is_bookable: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Lab)
    if status_filter:
        query = query.filter(Lab.status == status_filter)
    if is_bookable is not None:
        query = query.filter(Lab.is_bookable.is_(is_bookable))
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Lab.name.ilike(term), Lab.description.ilike(term), Lab.equipment.ilike(term)))
    return query.order_by(Lab.name.asc()).all()


@router.get("/labs/{lab_id}", response_model=LabOut)
def get_lab(lab_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy lab")
    return lab


@router.post("/labs", response_model=LabOut, status_code=status.HTTP_201_CREATED)
def create_lab(body: LabCreate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    payload = body.model_dump()
    _validate_lab_payload(payload)
    lab = Lab(**payload)
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return lab


@router.patch("/labs/{lab_id}", response_model=LabOut)
def update_lab(lab_id: int, body: LabUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy lab")
    payload = body.model_dump(exclude_unset=True)
    _validate_lab_payload(payload, partial=True)
    for field, value in payload.items():
        setattr(lab, field, value)
    db.commit()
    db.refresh(lab)
    return lab


@router.delete("/labs/{lab_id}")
def delete_lab(lab_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy lab")
    db.delete(lab)
    db.commit()
    return {"ok": True}


def _validate_lab_booking(db: Session, lab: Lab, body: LabBookingCreate):
    if lab.status in {"maintenance", "unavailable"}:
        raise HTTPException(status_code=400, detail="Lab đang bảo trì hoặc không khả dụng")
    if not lab.is_bookable:
        raise HTTPException(status_code=400, detail="Lab này chưa mở đặt lịch")
    if body.start_time >= body.end_time:
        raise HTTPException(status_code=400, detail="Thời gian bắt đầu phải trước thời gian kết thúc")
    if body.participant_count <= 0:
        raise HTTPException(status_code=400, detail="Số người tham gia phải lớn hơn 0")
    if body.participant_count > lab.capacity:
        raise HTTPException(status_code=400, detail="Số người vượt quá sức chứa lab")
    overlap = (
        db.query(LabBooking)
        .filter(
            LabBooking.lab_id == lab.id,
            LabBooking.status == "approved",
            LabBooking.start_time < body.end_time,
            LabBooking.end_time > body.start_time,
        )
        .first()
    )
    if overlap:
        raise HTTPException(status_code=400, detail="Khung giờ này đã có lịch được duyệt")


@router.post("/labs/{lab_id}/bookings", response_model=LabBookingOut, status_code=status.HTTP_201_CREATED)
def create_lab_booking(lab_id: int, body: LabBookingCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Không tìm thấy lab")
    _validate_lab_booking(db, lab, body)
    booking = LabBooking(**body.model_dump(), lab_id=lab_id, user_id=current_user.id, status="pending")
    db.add(booking)
    db.commit()
    return (
        db.query(LabBooking)
        .options(joinedload(LabBooking.lab), joinedload(LabBooking.user))
        .filter(LabBooking.id == booking.id)
        .first()
    )


@router.get("/lab-bookings", response_model=list[LabBookingOut])
def list_lab_bookings(
    status_filter: str | None = Query(None, alias="status"),
    lab_id: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(LabBooking).options(joinedload(LabBooking.lab), joinedload(LabBooking.user))
    if not _is_admin(current_user):
        query = query.filter(LabBooking.user_id == current_user.id)
    if status_filter:
        query = query.filter(LabBooking.status == status_filter)
    if lab_id:
        query = query.filter(LabBooking.lab_id == lab_id)
    return query.order_by(LabBooking.created_at.desc()).all()


@router.patch("/lab-bookings/{booking_id}/approve", response_model=LabBookingOut)
def approve_lab_booking(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    booking = db.query(LabBooking).options(joinedload(LabBooking.lab), joinedload(LabBooking.user)).filter(LabBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch đặt")
    _validate_lab_booking(db, booking.lab, LabBookingCreate(start_time=booking.start_time, end_time=booking.end_time, purpose=booking.purpose, participant_count=booking.participant_count))
    booking.status = "approved"
    db.commit()
    db.refresh(booking)
    return booking


@router.patch("/lab-bookings/{booking_id}/reject", response_model=LabBookingOut)
def reject_lab_booking(booking_id: int, body: AdminNoteIn, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    booking = db.query(LabBooking).options(joinedload(LabBooking.lab), joinedload(LabBooking.user)).filter(LabBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch đặt")
    booking.status = "rejected"
    booking.admin_note = body.admin_note
    db.commit()
    db.refresh(booking)
    return booking


@router.patch("/lab-bookings/{booking_id}/cancel", response_model=LabBookingOut)
def cancel_lab_booking(booking_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    booking = db.query(LabBooking).options(joinedload(LabBooking.lab), joinedload(LabBooking.user)).filter(LabBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch đặt")
    if not _is_admin(current_user) and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền hủy lịch đặt này")
    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking


def _validate_tutorial_payload(payload: dict, *, partial: bool = False):
    if not partial and not str(payload.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="Tên tutorial không được để trống")
    if payload.get("level") and payload["level"] not in TUTORIAL_LEVELS:
        raise HTTPException(status_code=400, detail="Mức độ tutorial không hợp lệ")
    if payload.get("status") and payload["status"] not in TUTORIAL_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái tutorial không hợp lệ")
    if payload.get("status") == "published" and not (payload.get("video_url") or payload.get("content_url")):
        raise HTTPException(status_code=400, detail="Tutorial đã xuất bản cần có video_url")
    duration = payload.get("duration_minutes")
    if duration is not None and duration < 0:
        raise HTTPException(status_code=400, detail="Thời lượng không hợp lệ")


@router.get("/tutorials", response_model=list[TutorialOut])
def list_tutorials(
    topic: str | None = None,
    level: str | None = None,
    search: str | None = None,
    is_featured: bool | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Tutorial)
    if not _is_admin(current_user):
        query = query.filter(Tutorial.status == "published")
    if topic:
        query = query.filter(or_(Tutorial.topic == topic, Tutorial.category == topic))
    if level:
        query = query.filter(Tutorial.level == level)
    if is_featured is not None:
        query = query.filter(Tutorial.is_featured.is_(is_featured))
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Tutorial.title.ilike(term), Tutorial.description.ilike(term), Tutorial.topic.ilike(term)))
    return query.order_by(Tutorial.is_featured.desc(), Tutorial.created_at.desc()).all()


@router.get("/tutorials/{tutorial_id}", response_model=TutorialOut)
def get_tutorial(tutorial_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tutorial = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tutorial:
        raise HTTPException(status_code=404, detail="Không tìm thấy tutorial")
    if not _is_admin(current_user) and tutorial.status != "published":
        raise HTTPException(status_code=404, detail="Không tìm thấy tutorial")
    return tutorial


@router.post("/tutorials", response_model=TutorialOut, status_code=status.HTTP_201_CREATED)
def create_tutorial(body: TutorialCreate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    payload = body.model_dump()
    _validate_tutorial_payload(payload)
    tutorial = Tutorial(**payload, created_by=current_user.id)
    if not tutorial.video_url and tutorial.content_url:
        tutorial.video_url = tutorial.content_url
    if not tutorial.topic and tutorial.category:
        tutorial.topic = tutorial.category
    db.add(tutorial)
    db.commit()
    db.refresh(tutorial)
    return tutorial


@router.patch("/tutorials/{tutorial_id}", response_model=TutorialOut)
def update_tutorial(tutorial_id: int, body: TutorialUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    tutorial = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tutorial:
        raise HTTPException(status_code=404, detail="Không tìm thấy tutorial")
    payload = body.model_dump(exclude_unset=True)
    merged = {
        "title": tutorial.title,
        "video_url": tutorial.video_url,
        "content_url": tutorial.content_url,
        "status": tutorial.status,
        "level": tutorial.level,
        "duration_minutes": tutorial.duration_minutes,
        **payload,
    }
    _validate_tutorial_payload(merged, partial=True)
    for field, value in payload.items():
        setattr(tutorial, field, value)
    if "content_url" in payload and not payload.get("video_url"):
        tutorial.video_url = tutorial.content_url
    db.commit()
    db.refresh(tutorial)
    return tutorial


@router.delete("/tutorials/{tutorial_id}")
def delete_tutorial(tutorial_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    tutorial = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tutorial:
        raise HTTPException(status_code=404, detail="Không tìm thấy tutorial")
    db.delete(tutorial)
    db.commit()
    return {"ok": True}


@router.post("/tutorials/{tutorial_id}/view", response_model=TutorialOut)
def increase_tutorial_view(tutorial_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tutorial = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tutorial or (not _is_admin(current_user) and tutorial.status != "published"):
        raise HTTPException(status_code=404, detail="Không tìm thấy tutorial")
    tutorial.view_count = (tutorial.view_count or 0) + 1
    db.commit()
    db.refresh(tutorial)
    return tutorial
