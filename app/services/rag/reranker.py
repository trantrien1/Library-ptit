"""
Re-ranker - xếp hạng lại kết quả tìm kiếm bằng LLM.

Sau khi vector search trả về top-K kết quả, re-ranker sẽ
đánh giá lại mức độ liên quan của từng kết quả với câu hỏi
và sắp xếp lại chính xác hơn.
"""
import json
from . import llm

_RERANK_PROMPT = """Bạn là hệ thống đánh giá độ liên quan cho thư viện sách.

Câu hỏi của người dùng: "{query}"

Dưới đây là danh sách sách được tìm thấy. Hãy chấm điểm mỗi cuốn từ 0-10 dựa trên mức độ liên quan với câu hỏi.
- 10: Hoàn toàn phù hợp
- 7-9: Rất liên quan
- 4-6: Có liên quan một phần
- 1-3: Ít liên quan
- 0: Không liên quan

{books}

Trả về JSON array với format: [{{"id": "...", "score": N}}, ...]
CHỈ trả về JSON, không giải thích."""


async def rerank(query: str, results: list[dict], top_k: int = 5) -> list[dict]:
    """Xếp hạng lại kết quả dựa trên LLM scoring."""
    if not results:
        return []

    # Nếu ít kết quả, không cần re-rank
    if len(results) <= 2:
        return results

    # Format danh sách sách
    books_text = ""
    for i, r in enumerate(results):
        meta = r["metadata"]
        books_text += (
            f"\n[ID: {r['id']}] {meta.get('title', '')} - "
            f"Tác giả: {meta.get('author', '')} | "
            f"Thể loại: {meta.get('category', '')} | "
            f"Mô tả: {r['document'][:150]}"
        )

    prompt = _RERANK_PROMPT.format(query=query, books=books_text)

    try:
        response = await llm.generate_text(prompt, temperature=0.0)
        # Parse JSON từ response
        response = response.strip()
        # Loại bỏ markdown code block nếu có
        if response.startswith("```"):
            response = response.split("\n", 1)[1]
            response = response.rsplit("```", 1)[0]

        scores = json.loads(response)
        score_map = {str(s["id"]): s["score"] for s in scores}

        # Gắn score vào kết quả
        for r in results:
            r["relevance_score"] = score_map.get(r["id"], 5)

        # Sắp xếp theo score giảm dần
        results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        # Lọc bỏ kết quả không liên quan (score < 3)
        results = [r for r in results if r.get("relevance_score", 0) >= 3]

        return results[:top_k]
    except (json.JSONDecodeError, KeyError):
        # Nếu parse lỗi, trả về kết quả gốc
        return results[:top_k]
