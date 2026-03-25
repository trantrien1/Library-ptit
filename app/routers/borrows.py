from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from math import ceil
from ..database import get_db
from ..models.user import User
from ..models.book import Book
from ..models.wishlist import Wishlist
from ..models.borrow import BorrowRequest, BorrowItem, BorrowStatus
from ..schemas.borrow import (
    BorrowRequestCreate, BorrowRequestUpdate, BorrowRequestResponse,
    BorrowApprove, BorrowReject, BorrowListResponse
)
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

