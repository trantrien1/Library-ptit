from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from ..database import get_db
from ..models.user import User
from ..models.book import Book
from ..models.wishlist import Wishlist
from ..schemas.wishlist import WishlistAdd, WishlistUpdate, WishlistItemResponse, WishlistResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])

@router.get("", response_model=WishlistResponse)
async def get_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách wishlist của user"""
    items = db.query(Wishlist).options(
        joinedload(Wishlist.book)
    ).filter(Wishlist.user_id == current_user.id).all()

    return WishlistResponse(
        items=items,
        total_items=len(items)
    )

@router.post("", response_model=WishlistItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_wishlist(
    data: WishlistAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm sách vào wishlist"""
    # Kiểm tra sách tồn tại
    book = db.query(Book).filter(Book.id == data.book_id).first()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách"
        )

    # Kiểm tra đã có trong wishlist chưa
    existing = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.book_id == data.book_id
    ).first()

    if existing:
        # Nếu đã có, cập nhật số lượng
        existing.quantity = data.quantity
        db.commit()
        db.refresh(existing)
        return existing

    # Tạo mới
    wishlist_item = Wishlist(
        user_id=current_user.id,
        book_id=data.book_id,
        quantity=data.quantity
    )

    db.add(wishlist_item)
    db.commit()
    db.refresh(wishlist_item)

    # Load relationship
    wishlist_item = db.query(Wishlist).options(
        joinedload(Wishlist.book)
    ).filter(Wishlist.id == wishlist_item.id).first()

    return wishlist_item

@router.put("/{book_id}", response_model=WishlistItemResponse)
async def update_wishlist_item(
    book_id: int,
    data: WishlistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật số lượng sách trong wishlist"""
    item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.book_id == book_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách trong wishlist"
        )

    if data.quantity <= 0:
        # Nếu quantity = 0, xóa khỏi wishlist
        db.delete(item)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_204_NO_CONTENT,
            detail="Đã xóa sách khỏi wishlist"
        )

    item.quantity = data.quantity
    db.commit()
    db.refresh(item)

    # Load relationship
    item = db.query(Wishlist).options(
        joinedload(Wishlist.book)
    ).filter(Wishlist.id == item.id).first()

    return item

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_wishlist(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa sách khỏi wishlist"""
    item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.book_id == book_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách trong wishlist"
        )

    db.delete(item)
    db.commit()

    return None

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa toàn bộ wishlist"""
    db.query(Wishlist).filter(Wishlist.user_id == current_user.id).delete()
    db.commit()

    return None

