"""
Advanced RAG Pipeline - điều phối toàn bộ luồng xử lý.

Flow:
  User Query
    → Query Rewriter (viết lại câu hỏi)
    → Vector Search  (tìm kiếm trong MySQL)
    → Re-ranker      (xếp hạng lại kết quả)
    → Context Compressor (nén context)
    → Answer Generator   (sinh câu trả lời)
"""
from sqlalchemy.orm import Session

from . import llm, vector_store
from .query_rewriter import rewrite
from .reranker import rerank
from .context_compressor import compress

_ANSWER_PROMPT = """Bạn là trợ lý thư viện PTIT (Học viện Công nghệ Bưu chính Viễn thông).
Nhiệm vụ: trả lời câu hỏi của độc giả về sách trong thư viện dựa trên thông tin được cung cấp.

QUY TẮC:
1. Chỉ trả lời dựa trên thông tin thư viện được cung cấp bên dưới.
2. Nếu không tìm thấy sách phù hợp, hãy nói rõ và gợi ý cách tìm khác.
3. Luôn đề cập số lượng còn lại nếu người dùng hỏi mượn sách.
4. Trả lời bằng tiếng Việt, thân thiện và hữu ích.
5. Nếu câu hỏi không liên quan đến sách/thư viện, hãy nhẹ nhàng hướng người dùng quay lại chủ đề thư viện.

Thông tin thư viện tìm được:
{context}

Lịch sử hội thoại:
{history}

Câu hỏi: {query}

Trả lời:"""


async def chat(db: Session, query: str, chat_history: list[dict] | None = None) -> dict:
    """
    Xử lý câu hỏi qua Advanced RAG pipeline.

    Returns dict gồm:
      - answer: câu trả lời
      - rewritten_query: câu hỏi sau khi viết lại
      - sources: danh sách sách liên quan
      - debug: thông tin debug cho từng bước
    """
    chat_history = chat_history or []
    debug = {}

    # === Bước 1: Query Rewriting ===
    rewritten_query = await rewrite(query, chat_history)
    debug["rewritten_query"] = rewritten_query

    # === Bước 2: Vector Search (MySQL) ===
    search_results = await vector_store.search(db, rewritten_query, top_k=10)
    debug["vector_search_count"] = len(search_results)

    # === Bước 3: Re-ranking ===
    reranked_results = await rerank(rewritten_query, search_results, top_k=5)
    debug["reranked_count"] = len(reranked_results)

    # === Bước 4: Context Compression ===
    compressed_context = await compress(rewritten_query, reranked_results)
    debug["compressed_context_length"] = len(compressed_context)

    # === Bước 5: Answer Generation ===
    # Format lịch sử
    if chat_history:
        history_lines = []
        for msg in chat_history[-6:]:
            role = "Người dùng" if msg["role"] == "user" else "Trợ lý"
            history_lines.append(f"{role}: {msg['content'][:200]}")
        history_str = "\n".join(history_lines)
    else:
        history_str = "(Cuộc hội thoại mới)"

    answer_prompt = _ANSWER_PROMPT.format(
        context=compressed_context,
        history=history_str,
        query=query,
    )
    answer = await llm.generate_text(answer_prompt, temperature=0.4)

    # Trích sources để trả về frontend
    sources = []
    for r in reranked_results:
        meta = r["metadata"]
        sources.append({
            "book_id": meta.get("book_id"),
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "category": meta.get("category", ""),
            "available_quantity": meta.get("available_quantity", 0),
            "relevance_score": r.get("relevance_score"),
        })

    return {
        "answer": answer.strip(),
        "rewritten_query": rewritten_query,
        "sources": sources,
        "debug": debug,
    }


async def index_all_books(db: Session) -> int:
    """Index toàn bộ sách từ database vào MySQL vector store."""
    from ...models.book import Book
    books = db.query(Book).all()
    count = await vector_store.index_books(db, books)
    return count
