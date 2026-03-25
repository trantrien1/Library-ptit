from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import enum

class BorrowStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    returned = "returned"
    need_edit = "need_edit"

class BorrowRequest(Base):
    __tablename__ = "borrow_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(BorrowStatus), default=BorrowStatus.pending)
    note = Column(Text)
    admin_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    approved_at = Column(DateTime, nullable=True)
    due_date = Column(Date, nullable=True)
    returned_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="borrow_requests")
    items = relationship("BorrowItem", back_populates="request", cascade="all, delete-orphan")

class BorrowItem(Base):
    __tablename__ = "borrow_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("borrow_requests.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    quantity = Column(Integer, default=1)

    # Relationships
    request = relationship("BorrowRequest", back_populates="items")
    book = relationship("Book", back_populates="borrow_items")

