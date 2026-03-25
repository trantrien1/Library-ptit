"""
MySQL Vector Store - lưu trữ embeddings trong MySQL, tìm kiếm bằng cosine similarity.
"""
import json
import numpy as np
from sqlalchemy.orm import Session

from . import llm
from ...models.book import Book
from ...models.book_embedding import BookEmbedding


def _book_to_document(book: Book) -> str:
    """Chuyển một Book ORM object thành text để embedding."""
    parts = [
        f"Tên sách: {book.title}",
        f"Tác giả: {book.author}" if book.author else "",
        f"Thể loại: {book.category}" if book.category else "",
        f"ISBN: {book.isbn}" if book.isbn else "",
        f"Mô tả: {book.description}" if book.description else "",
        f"Số lượng: {book.quantity}, Còn lại: {book.available_quantity}",
    ]
    return "\n".join(p for p in parts if p)


def _book_to_metadata(book: Book) -> dict:
    """Trích metadata từ Book ORM object."""
    return {
        "book_id": book.id,
        "title": book.title or "",
        "author": book.author or "",
        "isbn": book.isbn or "",
        "category": book.category or "",
        "quantity": book.quantity or 0,
        "available_quantity": book.available_quantity or 0,
    }


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Tính cosine similarity giữa 2 vector bằng numpy."""
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


async def index_books(db: Session, books: list[Book]) -> int:
    """Index (upsert) danh sách sách vào MySQL."""
    if not books:
        return 0

    documents = [_book_to_document(b) for b in books]

    # Tạo embeddings qua Gemini
    embeddings = await llm.generate_embeddings(documents)

    for book, doc, emb in zip(books, documents, embeddings):
        existing = db.query(BookEmbedding).filter(BookEmbedding.book_id == book.id).first()
        emb_json = json.dumps(emb)

        if existing:
            existing.document = doc
            existing.embedding = emb_json
        else:
            db.add(BookEmbedding(
                book_id=book.id,
                document=doc,
                embedding=emb_json,
            ))

    db.commit()
    return len(books)


async def search(db: Session, query: str, top_k: int = 10) -> list[dict]:
    """Tìm kiếm sách tương tự câu query bằng cosine similarity."""
    # Lấy tất cả embeddings từ MySQL
    all_embeddings = db.query(BookEmbedding).all()
    if not all_embeddings:
        return []

    # Tạo embedding cho câu query
    query_embedding = await llm.generate_query_embedding(query)

    # Tính cosine similarity cho từng sách
    scored = []
    for record in all_embeddings:
        stored_emb = json.loads(record.embedding)
        sim = _cosine_similarity(query_embedding, stored_emb)
        scored.append((record, sim))

    # Sắp xếp theo similarity giảm dần
    scored.sort(key=lambda x: x[1], reverse=True)

    # Lấy top-K và format kết quả
    items = []
    for record, sim in scored[:top_k]:
        book = record.book
        items.append({
            "id": str(record.book_id),
            "document": record.document,
            "metadata": _book_to_metadata(book),
            "distance": round(1 - sim, 4),  # distance = 1 - similarity
        })
    return items


def delete_book(db: Session, book_id: int):
    """Xoá embedding của sách khỏi MySQL."""
    db.query(BookEmbedding).filter(BookEmbedding.book_id == book_id).delete()
    db.commit()


def get_indexed_count(db: Session) -> int:
    """Trả về số lượng sách đã index."""
    return db.query(BookEmbedding).count()
