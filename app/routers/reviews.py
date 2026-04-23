from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.book import Book
from ..models.review import BookReview
from ..models.user import User
from ..models.borrow import BorrowRequest, BorrowStatus, BorrowItem
from ..schemas.review import ReviewCreate, ReviewResponse, BookReviewSummary
from ..utils.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/books", tags=["Reviews"])


@router.get("/{book_id}/reviews", response_model=list[ReviewResponse])
async def get_book_reviews(book_id: int, db: Session = Depends(get_db)):
    """Lấy danh sách đánh giá của một sách."""
    reviews = (
        db.query(BookReview)
        .join(User, User.id == BookReview.user_id)
        .filter(BookReview.book_id == book_id)
        .order_by(BookReview.created_at.desc())
        .all()
    )
    result = []
    for r in reviews:
        resp = ReviewResponse(
            id=r.id,
            user_id=r.user_id,
            book_id=r.book_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            username=r.user.username,
            full_name=r.user.full_name,
        )
        result.append(resp)
    return result


@router.get("/{book_id}/reviews/summary", response_model=BookReviewSummary)
async def get_review_summary(book_id: int, db: Session = Depends(get_db)):
    """Lấy tổng hợp đánh giá (avg rating, count)."""
    avg = db.query(func.avg(BookReview.rating)).filter(BookReview.book_id == book_id).scalar() or 0
    count = db.query(func.count(BookReview.id)).filter(BookReview.book_id == book_id).scalar() or 0
    return BookReviewSummary(book_id=book_id, average_rating=round(float(avg), 1), total_reviews=count)


@router.get("/{book_id}/reviews/me")
async def get_my_review(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy đánh giá của user hiện tại cho một sách."""
    review = (
        db.query(BookReview)
        .filter(BookReview.book_id == book_id, BookReview.user_id == current_user.id)
        .first()
    )
    if not review:
        return None
    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        book_id=review.book_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        username=current_user.username,
        full_name=current_user.full_name,
    )


@router.post("/{book_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_review(
    book_id: int,
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo hoặc cập nhật đánh giá (user đã mượn sách đó)."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sách")

    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rating phải từ 1 đến 5")

    has_borrowed = (
        db.query(BorrowItem.id)
        .join(BorrowRequest, BorrowRequest.id == BorrowItem.request_id)
        .filter(
            BorrowRequest.user_id == current_user.id,
            BorrowItem.book_id == book_id,
            BorrowRequest.status.in_([BorrowStatus.approved, BorrowStatus.returned]),
        )
        .first()
    )
    if not has_borrowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn chỉ được đánh giá sách đã mượn")

    existing = (
        db.query(BookReview)
        .filter(BookReview.book_id == book_id, BookReview.user_id == current_user.id)
        .first()
    )

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bạn đã đánh giá sách này rồi. Mỗi sách chỉ được đánh giá 1 lần.")

    review = BookReview(
        user_id=current_user.id,
        book_id=book_id,
        rating=review_data.rating,
        comment=review_data.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    return ReviewResponse(
        id=review.id,
        user_id=review.user_id,
        book_id=review.book_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        username=current_user.username,
        full_name=current_user.full_name,
    )


@router.delete("/{book_id}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_review(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa đánh giá của mình."""
    review = (
        db.query(BookReview)
        .filter(BookReview.book_id == book_id, BookReview.user_id == current_user.id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chưa có đánh giá")
    db.delete(review)
    db.commit()
