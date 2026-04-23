from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, date, timedelta, timezone
from math import ceil
from ..database import get_db
from ..models.user import User
from ..models.book import Book
from ..models.wishlist import Wishlist
from ..models.borrow import BorrowRequest, BorrowItem, BorrowStatus
from ..models.renewal import BorrowRenewal, RenewalStatus
from ..models.waitlist import Waitlist, WaitlistStatus
from ..schemas.borrow import (
    BorrowRequestCreate, BorrowRequestUpdate, BorrowRequestResponse,
    BorrowApprove, BorrowReject, BorrowListResponse,
    BorrowReminderResponse, BorrowReminderItem, BorrowReminderType
)
from ..schemas.renewal import BorrowRenewalCreate, BorrowRenewalResponse
from ..schemas.waitlist import WaitlistCreate, WaitlistResponse
from ..config import settings
from ..utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/borrows", tags=["Borrows"])

@router.get("", response_model=BorrowListResponse)
async def get_borrow_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách phiếu mượn (Admin: tất cả, User: của mình)"""
    query = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    )

    # Nếu không phải admin, chỉ lấy phiếu của mình
    if current_user.role.value != "admin":
        query = query.filter(BorrowRequest.user_id == current_user.id)
    else:
        # Admin có thể tìm kiếm theo thông tin độc giả
        if search:
            query = query.join(User).filter(
                or_(
                    User.username.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    User.full_name.ilike(f"%{search}%")
                )
            )

    # Lọc theo status
    if status_filter:
        query = query.filter(BorrowRequest.status == status_filter)

    # Đếm tổng
    total = query.count()
    total_pages = ceil(total / page_size)

    # Pagination và sắp xếp theo ngày tạo mới nhất
    requests = query.order_by(BorrowRequest.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return BorrowListResponse(
        items=requests,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/reminders", response_model=BorrowReminderResponse)
async def get_due_date_reminders(
    days_ahead: int = Query(3, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trả về danh sách nhắc hạn cho phiếu đang mượn của người dùng hiện tại."""
    if current_user.role.value == "admin":
        return BorrowReminderResponse(
            generated_at=datetime.now(timezone.utc),
            overdue_count=0,
            due_soon_count=0,
            items=[]
        )

    today = date.today()
    to_date = today + timedelta(days=days_ahead)

    due_requests = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book)
    ).filter(
        BorrowRequest.user_id == current_user.id,
        BorrowRequest.status == BorrowStatus.approved,
        BorrowRequest.due_date.isnot(None),
        BorrowRequest.due_date <= to_date
    ).order_by(BorrowRequest.due_date.asc()).limit(limit).all()

    reminders = []
    overdue_count = 0
    due_soon_count = 0

    for borrow_request in due_requests:
        days_left = (borrow_request.due_date - today).days
        total_books = sum(item.quantity for item in borrow_request.items)
        first_title = (
            borrow_request.items[0].book.title
            if borrow_request.items and borrow_request.items[0].book
            else None
        )

        if days_left < 0:
            overdue_count += 1
            message = f"Phiếu #{borrow_request.id} đã quá hạn {abs(days_left)} ngày"
            reminder_type = BorrowReminderType.overdue
        elif days_left == 0:
            due_soon_count += 1
            message = f"Phiếu #{borrow_request.id} đến hạn trả hôm nay"
            reminder_type = BorrowReminderType.due_soon
        else:
            due_soon_count += 1
            message = f"Phiếu #{borrow_request.id} còn {days_left} ngày đến hạn trả"
            reminder_type = BorrowReminderType.due_soon

        reminders.append(BorrowReminderItem(
            request_id=borrow_request.id,
            due_date=borrow_request.due_date,
            days_left=days_left,
            reminder_type=reminder_type,
            total_books=total_books,
            first_book_title=first_title,
            message=message
        ))

    return BorrowReminderResponse(
        generated_at=datetime.now(timezone.utc),
        overdue_count=overdue_count,
        due_soon_count=due_soon_count,
        items=reminders
    )

# ===== STATIC PATH ROUTES (must be before /{request_id}) =====

@router.get("/renewals", response_model=list[BorrowRenewalResponse])
async def get_pending_renewals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin lấy danh sách renewal requests chờ duyệt."""
    renewals = (
        db.query(BorrowRenewal)
        .filter(BorrowRenewal.status == RenewalStatus.pending)
        .order_by(BorrowRenewal.created_at.asc())
        .all()
    )
    return renewals


@router.get("/waitlist", response_model=list[WaitlistResponse])
async def get_my_waitlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User xem danh sách hàng chờ của mình."""
    items = (
        db.query(Waitlist)
        .join(Book, Book.id == Waitlist.book_id)
        .filter(Waitlist.user_id == current_user.id)
        .order_by(Waitlist.created_at.asc())
        .all()
    )
    return [
        WaitlistResponse(
            id=w.id,
            user_id=w.user_id,
            book_id=w.book_id,
            quantity=w.quantity,
            status=w.status,
            created_at=w.created_at,
            notified_at=w.notified_at,
            book_title=w.book.title,
            book_author=w.book.author,
            username=current_user.username,
            full_name=current_user.full_name,
        )
        for w in items
    ]


@router.get("/admin/waitlist", response_model=list[WaitlistResponse])
async def get_all_waitlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin xem toàn bộ hàng chờ."""
    items = (
        db.query(Waitlist)
        .join(Book, Book.id == Waitlist.book_id)
        .join(User, User.id == Waitlist.user_id)
        .filter(Waitlist.status == WaitlistStatus.waiting)
        .order_by(Waitlist.created_at.asc())
        .all()
    )
    return [
        WaitlistResponse(
            id=w.id,
            user_id=w.user_id,
            book_id=w.book_id,
            quantity=w.quantity,
            status=w.status,
            created_at=w.created_at,
            notified_at=w.notified_at,
            book_title=w.book.title,
            book_author=w.book.author,
            username=w.user.username,
            full_name=w.user.full_name,
        )
        for w in items
    ]


@router.get("/{request_id}", response_model=BorrowRequestResponse)
async def get_borrow_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết phiếu mượn"""
    request = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    # User chỉ được xem phiếu của mình
    if current_user.role.value != "admin" and request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem phiếu mượn này"
        )

    return request

@router.post("", response_model=BorrowRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_borrow_request(
    data: BorrowRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo phiếu mượn từ wishlist hoặc danh sách items"""
    items_to_borrow = []

    if data.items:
        # Lấy từ danh sách items được cung cấp
        for item in data.items:
            book = db.query(Book).filter(Book.id == item.book_id).first()
            if not book:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy sách với ID {item.book_id}"
                )
            items_to_borrow.append({
                "book_id": item.book_id,
                "quantity": item.quantity
            })
    else:
        # Lấy từ wishlist
        wishlist_items = db.query(Wishlist).filter(
            Wishlist.user_id == current_user.id
        ).all()

        if not wishlist_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wishlist trống. Vui lòng thêm sách vào wishlist trước khi tạo phiếu mượn."
            )

        for wi in wishlist_items:
            items_to_borrow.append({
                "book_id": wi.book_id,
                "quantity": wi.quantity
            })

    # Tạo phiếu mượn
    borrow_request = BorrowRequest(
        user_id=current_user.id,
        status=BorrowStatus.pending,
        note=data.note,
        due_date=data.due_date  # Ngày trả do user nhập
    )
    db.add(borrow_request)
    db.flush()  # Để lấy ID

    # Tạo các items
    for item in items_to_borrow:
        borrow_item = BorrowItem(
            request_id=borrow_request.id,
            book_id=item["book_id"],
            quantity=item["quantity"]
        )
        db.add(borrow_item)

    # Xóa wishlist sau khi tạo phiếu
    if not data.items:
        db.query(Wishlist).filter(Wishlist.user_id == current_user.id).delete()

    db.commit()

    # Load relationships
    result = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == borrow_request.id).first()

    return result

@router.put("/{request_id}", response_model=BorrowRequestResponse)
async def update_borrow_request(
    request_id: int,
    data: BorrowRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật phiếu mượn (chỉ khi status = need_edit)"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    if request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa phiếu mượn này"
        )

    if request.status != BorrowStatus.need_edit and request.status != BorrowStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể chỉnh sửa phiếu mượn đang chờ duyệt hoặc cần chỉnh sửa"
        )

    # Cập nhật note và due_date
    if data.note is not None:
        request.note = data.note
    if data.due_date is not None:
        request.due_date = data.due_date

    # Xóa items cũ và tạo items mới
    db.query(BorrowItem).filter(BorrowItem.request_id == request_id).delete()

    for item in data.items:
        book = db.query(Book).filter(Book.id == item.book_id).first()
        if not book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy sách với ID {item.book_id}"
            )
        borrow_item = BorrowItem(
            request_id=request_id,
            book_id=item.book_id,
            quantity=item.quantity
        )
        db.add(borrow_item)

    # Chuyển status về pending
    request.status = BorrowStatus.pending

    db.commit()

    # Load relationships
    result = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == request_id).first()

    return result

@router.put("/{request_id}/approve", response_model=BorrowRequestResponse)
async def approve_borrow_request(
    request_id: int,
    data: BorrowApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Duyệt phiếu mượn (Admin only)"""
    request = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items)
    ).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    if request.status != BorrowStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể duyệt phiếu mượn đang chờ duyệt"
        )

    # Kiểm tra và cập nhật số lượng sách
    for item in request.items:
        book = db.query(Book).filter(Book.id == item.book_id).first()
        if book.available_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sách '{book.title}' chỉ còn {book.available_quantity} cuốn, không đủ {item.quantity} cuốn yêu cầu"
            )

    # Giảm số lượng available
    for item in request.items:
        book = db.query(Book).filter(Book.id == item.book_id).first()
        book.available_quantity -= item.quantity

    # Cập nhật trạng thái phiếu (giữ nguyên due_date do user nhập)
    request.status = BorrowStatus.approved
    request.approved_at = datetime.utcnow()
    request.admin_note = data.admin_note

    db.commit()

    # Load relationships
    result = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == request_id).first()

    return result

@router.put("/{request_id}/reject", response_model=BorrowRequestResponse)
async def reject_borrow_request(
    request_id: int,
    data: BorrowReject,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Từ chối hoặc yêu cầu chỉnh sửa phiếu mượn (Admin only)"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    if request.status != BorrowStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể xử lý phiếu mượn đang chờ duyệt"
        )

    if data.require_edit:
        request.status = BorrowStatus.need_edit
    else:
        request.status = BorrowStatus.rejected

    request.admin_note = data.admin_note

    db.commit()

    # Load relationships
    result = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == request_id).first()

    return result

@router.put("/{request_id}/return", response_model=BorrowRequestResponse)
async def return_books(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Xác nhận trả sách (Admin only)"""
    request = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items)
    ).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    if request.status != BorrowStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể trả sách với phiếu mượn đã được duyệt"
        )

    # Tăng số lượng available
    for item in request.items:
        book = db.query(Book).filter(Book.id == item.book_id).first()
        book.available_quantity += item.quantity

    # Cập nhật trạng thái
    request.status = BorrowStatus.returned
    request.returned_at = datetime.utcnow()

    # Auto-fulfill waitlist: tìm người chờ lâu nhất cho từng sách vừa trả
    for item in request.items:
        book = db.query(Book).filter(Book.id == item.book_id).first()
        while book.available_quantity > 0:
            next_waiting = (
                db.query(Waitlist)
                .filter(
                    Waitlist.book_id == item.book_id,
                    Waitlist.status == WaitlistStatus.waiting,
                )
                .order_by(Waitlist.created_at.asc())
                .first()
            )
            if not next_waiting:
                break

            fulfill_qty = min(next_waiting.quantity, book.available_quantity)

            # Đánh dấu waitlist fulfilled
            next_waiting.status = WaitlistStatus.fulfilled
            next_waiting.notified_at = datetime.utcnow()

            # Giảm available
            book.available_quantity -= fulfill_qty

            # Tự động tạo borrow request cho user
            auto_request = BorrowRequest(
                user_id=next_waiting.user_id,
                status=BorrowStatus.approved,
                due_date=date.today() + timedelta(days=14),
                admin_note=f"Tự động tạo từ hàng chờ (waitlist #{next_waiting.id})",
            )
            db.add(auto_request)
            db.flush()

            auto_item = BorrowItem(
                request_id=auto_request.id,
                book_id=item.book_id,
                quantity=fulfill_qty,
            )
            db.add(auto_item)

            auto_request.approved_at = datetime.utcnow()

    db.commit()

    # Load relationships
    result = db.query(BorrowRequest).options(
        joinedload(BorrowRequest.items).joinedload(BorrowItem.book),
        joinedload(BorrowRequest.user)
    ).filter(BorrowRequest.id == request_id).first()

    return result

@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_borrow_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa/Hủy phiếu mượn (chỉ khi pending hoặc need_edit)"""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phiếu mượn"
        )

    # User chỉ được xóa phiếu của mình
    if current_user.role.value != "admin" and request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa phiếu mượn này"
        )

    if request.status not in [BorrowStatus.pending, BorrowStatus.need_edit, BorrowStatus.rejected]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể xóa phiếu mượn đang chờ duyệt, cần chỉnh sửa hoặc bị từ chối"
        )

    db.delete(request)
    db.commit()

    return None


# ===== RENEWAL ENDPOINTS =====

@router.post("/{request_id}/renew", response_model=BorrowRenewalResponse, status_code=status.HTTP_201_CREATED)
async def request_renewal(
    request_id: int,
    data: BorrowRenewalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User yêu cầu gia hạn mượn sách."""
    request = db.query(BorrowRequest).filter(BorrowRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiếu mượn")

    if request.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền gia hạn phiếu này")

    if request.status != BorrowStatus.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chỉ có thể gia hạn phiếu đang mượn")

    if request.renewal_count >= settings.MAX_RENEWAL_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Đã gia hạn tối đa {settings.MAX_RENEWAL_COUNT} lần"
        )

    if not request.due_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phiếu mượn không có ngày đến hạn")

    # Nếu đã có yêu cầu gia hạn chờ duyệt → ghi đè
    existing = (
        db.query(BorrowRenewal)
        .filter(
            BorrowRenewal.request_id == request_id,
            BorrowRenewal.status == RenewalStatus.pending,
        )
        .first()
    )

    if existing:
        existing.requested_days = data.requested_days or settings.DEFAULT_RENEWAL_DAYS
        existing.reason = data.reason
        db.commit()
        db.refresh(existing)
        return existing

    renewal = BorrowRenewal(
        request_id=request_id,
        requested_days=data.requested_days or settings.DEFAULT_RENEWAL_DAYS,
        reason=data.reason,
    )
    db.add(renewal)
    db.commit()
    db.refresh(renewal)
    return renewal


@router.post("/renewals/{renewal_id}/approve", response_model=BorrowRenewalResponse)
async def approve_renewal(
    renewal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin duyệt gia hạn → kéo dài due_date."""
    renewal = db.query(BorrowRenewal).filter(BorrowRenewal.id == renewal_id).first()
    if not renewal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu gia hạn")

    if renewal.status != RenewalStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yêu cầu gia hạn không ở trạng thái chờ duyệt")

    request = db.query(BorrowRequest).filter(BorrowRequest.id == renewal.request_id).first()
    if not request or request.status != BorrowStatus.approved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phiếu mượn không hợp lệ để gia hạn")

    if request.due_date:
        request.due_date = request.due_date + timedelta(days=renewal.requested_days)
    request.renewal_count += 1

    renewal.status = RenewalStatus.approved
    renewal.admin_note = "Đã duyệt"
    renewal.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(renewal)
    return renewal


@router.post("/renewals/{renewal_id}/reject", response_model=BorrowRenewalResponse)
async def reject_renewal(
    renewal_id: int,
    admin_note: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin từ chối gia hạn."""
    renewal = db.query(BorrowRenewal).filter(BorrowRenewal.id == renewal_id).first()
    if not renewal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy yêu cầu gia hạn")

    if renewal.status != RenewalStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yêu cầu gia hạn không ở trạng thái chờ duyệt")

    renewal.status = RenewalStatus.rejected
    renewal.admin_note = admin_note
    renewal.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(renewal)
    return renewal


# ===== WAITLIST ENDPOINTS =====

@router.post("/waitlist", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    data: WaitlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User vào hàng chờ sách."""
    book = db.query(Book).filter(Book.id == data.book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sách")

    if book.available_quantity > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sách này còn sẵn, không cần vào hàng chờ")

    existing = (
        db.query(Waitlist)
        .filter(
            Waitlist.user_id == current_user.id,
            Waitlist.book_id == data.book_id,
            Waitlist.status == WaitlistStatus.waiting,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bạn đã trong hàng chờ sách này")

    item = Waitlist(
        user_id=current_user.id,
        book_id=data.book_id,
        quantity=data.quantity,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "Đã vào hàng chờ thành công", "id": item.id}


@router.delete("/waitlist/{waitlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_waitlist(
    waitlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User hủy hàng chờ."""
    item = db.query(Waitlist).filter(Waitlist.id == waitlist_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mục hàng chờ")

    if item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền hủy mục hàng chờ này")

    if item.status != WaitlistStatus.waiting:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chỉ có thể hủy hàng chờ đang chờ")

    item.status = WaitlistStatus.cancelled
    db.commit()
    return None
