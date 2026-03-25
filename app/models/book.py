from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    author = Column(String(100))
    isbn = Column(String(20), unique=True, index=True)
    category = Column(String(50), index=True)
    description = Column(Text)
    quantity = Column(Integer, default=0)
    available_quantity = Column(Integer, default=0)
    cover_image = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    wishlist_items = relationship("Wishlist", back_populates="book", cascade="all, delete-orphan")
    borrow_items = relationship("BorrowItem", back_populates="book")

