"""
Context Compressor - nén và trích xuất thông tin liên quan từ kết quả tìm kiếm.

Thay vì đưa toàn bộ document vào prompt, compressor chỉ giữ lại
phần thông tin thực sự cần thiết để trả lời câu hỏi,
giúp tiết kiệm token và tăng chất lượng câu trả lời.
"""
from . import llm

_COMPRESS_PROMPT = """Bạn là bộ trích xuất thông tin thư viện.
Từ danh sách sách bên dưới, hãy trích xuất CHỈ những thông tin liên quan đến câu hỏi.

Câu hỏi: "{query}"

Danh sách sách tìm được:
{context}

Yêu cầu:
1. Chỉ giữ lại thông tin liên quan đến câu hỏi.
2. Giữ nguyên các số liệu cụ thể (số lượng, ISBN, v.v.).
3. Tổ chức thông tin dạng gạch đầu dòng cho từng cuốn sách liên quan.
4. Nếu không cuốn nào liên quan, trả về "Không tìm thấy sách phù hợp."

Thông tin đã trích xuất:"""


async def compress(query: str, results: list[dict]) -> str:
    """Nén context từ kết quả tìm kiếm, chỉ giữ phần liên quan."""
    if not results:
        return "Không tìm thấy sách nào trong thư viện phù hợp với câu hỏi."

    # Format context
    context_parts = []
    for r in results:
        meta = r["metadata"]
        context_parts.append(
            f"- Tên: {meta.get('title', 'N/A')}\n"
            f"  Tác giả: {meta.get('author', 'N/A')}\n"
            f"  Thể loại: {meta.get('category', 'N/A')}\n"
            f"  ISBN: {meta.get('isbn', 'N/A')}\n"
            f"  Tổng: {meta.get('quantity', 0)} cuốn, Còn: {meta.get('available_quantity', 0)} cuốn\n"
            f"  Mô tả: {r['document'][:300]}"
        )

    context_str = "\n\n".join(context_parts)
    prompt = _COMPRESS_PROMPT.format(query=query, context=context_str)

    compressed = await llm.generate_text(prompt, temperature=0.1)
    return compressed.strip()
