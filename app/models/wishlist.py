from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Wishlist(Base):
    __tablename__ = "wishlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1)
    added_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="wishlist_items")
    book = relationship("Book", back_populates="wishlist_items")

