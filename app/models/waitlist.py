from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import enum


class WaitlistStatus(str, enum.Enum):
    waiting = "waiting"
    fulfilled = "fulfilled"
    cancelled = "cancelled"


class Waitlist(Base):
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    status = Column(Enum(WaitlistStatus), default=WaitlistStatus.waiting)
    created_at = Column(DateTime, server_default=func.now())
    notified_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="waitlist_items")
    book = relationship("Book", back_populates="waitlist_items")
