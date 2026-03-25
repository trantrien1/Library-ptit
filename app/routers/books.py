from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from math import ceil
from ..database import get_db
from ..models.book import Book
from ..models.user import User
from ..schemas.book import BookCreate, BookUpdate, BookResponse, BookListResponse
from ..utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/books", tags=["Books"])

@router.get("", response_model=BookListResponse)
async def get_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lấy danh sách sách (có pagination và tìm kiếm)"""
    query = db.query(Book)

    # Tìm kiếm theo title, author, isbn
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_filter),
                Book.author.ilike(search_filter),
                Book.isbn.ilike(search_filter)
            )
        )

    # Lọc theo category
    if category:
        query = query.filter(Book.category == category)

    # Đếm tổng số
    total = query.count()
    total_pages = ceil(total / page_size)

    # Pagination
    books = query.offset((page - 1) * page_size).limit(page_size).all()

    return BookListResponse(
        items=books,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Lấy danh sách các category"""
    categories = db.query(Book.category).distinct().filter(Book.category.isnot(None)).all()
    return [cat[0] for cat in categories]

@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: int, db: Session = Depends(get_db)):
    """Lấy chi tiết sách theo ID"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách"
        )
    return book

@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    book_data: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Thêm sách mới (Admin only)"""
    # Kiểm tra ISBN đã tồn tại
    if book_data.isbn:
        existing = db.query(Book).filter(Book.isbn == book_data.isbn).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ISBN đã tồn tại"
            )

    new_book = Book(
        title=book_data.title,
        author=book_data.author,
        isbn=book_data.isbn,
        category=book_data.category,
        description=book_data.description,
        quantity=book_data.quantity,
        available_quantity=book_data.quantity,  # Ban đầu available = total
        cover_image=book_data.cover_image
    )

    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return new_book

@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: int,
    book_data: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Cập nhật thông tin sách (Admin only)"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách"
        )

    # Kiểm tra ISBN mới có trùng không
    if book_data.isbn and book_data.isbn != book.isbn:
        existing = db.query(Book).filter(Book.isbn == book_data.isbn).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ISBN đã tồn tại"
            )

    update_data = book_data.model_dump(exclude_unset=True)

    # Nếu cập nhật quantity, cần cập nhật available_quantity tương ứng
    if "quantity" in update_data:
        diff = update_data["quantity"] - book.quantity
        new_available = book.available_quantity + diff
        if new_available < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể giảm số lượng vì có sách đang được mượn"
            )
        update_data["available_quantity"] = new_available

    for key, value in update_data.items():
        setattr(book, key, value)

    db.commit()
    db.refresh(book)

    return book

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Xóa sách (Admin only)"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sách"
        )

    # Kiểm tra sách có đang được mượn không
    if book.quantity != book.available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa sách đang được mượn"
        )

    db.delete(book)
    db.commit()

    return None

