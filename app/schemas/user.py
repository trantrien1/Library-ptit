from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    admin = "admin"
    user = "user"

# Base schema
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None

# Schema cho đăng ký
class UserCreate(UserBase):
    password: str

# Schema cho đăng nhập
class UserLogin(BaseModel):
    username: str
    password: str

# Schema cho cập nhật user (admin)
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

# Schema cho reset password (admin)
class UserResetPassword(BaseModel):
    new_password: str

# Schema response
class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Schema cho token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None

