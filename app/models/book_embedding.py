from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class BookEmbedding(Base):
    __tablename__ = "book_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), unique=True, nullable=False)
    document = Column(Text, nullable=False)       # Text đã dùng để tạo embedding
    embedding = Column(Text, nullable=False)       # JSON array of floats
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    book = relationship("Book")
