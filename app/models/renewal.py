from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import enum


class RenewalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BorrowRenewal(Base):
    __tablename__ = "borrow_renewals"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("borrow_requests.id"), nullable=False, index=True)
    status = Column(Enum(RenewalStatus), default=RenewalStatus.pending)
    requested_days = Column(Integer, nullable=False)
    reason = Column(Text)
    admin_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    reviewed_at = Column(DateTime, nullable=True)

    request = relationship("BorrowRequest", back_populates="renewals")
