from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from math import ceil
from ..database import get_db
from ..models.user import User, UserRole
from ..schemas.user import UserResponse, UserUpdate, UserResetPassword
from ..utils.dependencies import get_current_admin
from ..utils.auth import get_password_hash

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("", response_model=List[UserResponse])
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Lấy danh sách độc giả (Admin only)"""
    query = db.query(User)

    # Lọc theo role
    if role:
        query = query.filter(User.role == role)
    else:
        # Mặc định chỉ hiển thị user, không hiển thị admin
        query = query.filter(User.role == UserRole.user)

    # Tìm kiếm theo username, email, full_name
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                User.username.ilike(search_filter),
                User.email.ilike(search_filter),
                User.full_name.ilike(search_filter)
            )
        )

    # Pagination
    users = query.offset((page - 1) * page_size).limit(page_size).all()

    return users

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Lấy thông tin độc giả theo ID (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy độc giả"
        )
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Cập nhật thông tin độc giả (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy độc giả"
        )

    # Không cho phép admin tự vô hiệu hóa chính mình
    if user.id == current_user.id and user_data.is_active == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể vô hiệu hóa tài khoản của chính mình"
        )

    update_data = user_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user

@router.put("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    data: UserResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Reset mật khẩu độc giả (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy độc giả"
        )

    user.password_hash = get_password_hash(data.new_password)
    db.commit()

    return {"message": "Đã reset mật khẩu thành công"}

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Xóa độc giả (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy độc giả"
        )

    # Không cho phép admin tự xóa chính mình
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa tài khoản của chính mình"
        )

    db.delete(user)
    db.commit()

    return None

