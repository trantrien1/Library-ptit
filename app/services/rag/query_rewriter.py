"""
Query Rewriter - viết lại câu hỏi người dùng để tìm kiếm tốt hơn.

Xử lý:
- Câu hỏi mơ hồ → cụ thể hơn
- Câu hỏi phụ thuộc ngữ cảnh chat → câu hỏi độc lập
- Từ viết tắt / lóng → từ chuẩn
"""
from . import llm

_REWRITE_PROMPT = """Bạn là trợ lý thư viện. Nhiệm vụ: viết lại câu hỏi của người dùng thành một câu truy vấn tìm kiếm sách TỐT HƠN.

Quy tắc:
1. Nếu câu hỏi tham chiếu đến lịch sử hội thoại (ví dụ "cuốn đó", "sách ấy", "còn quyển nào khác"), hãy thay thế bằng thông tin cụ thể từ lịch sử.
2. Mở rộng từ viết tắt: CNTT → Công nghệ thông tin, AI → Trí tuệ nhân tạo, CSDL → Cơ sở dữ liệu, v.v.
3. Giữ ngắn gọn, tập trung vào keyword tìm kiếm sách.
4. Chỉ trả về câu truy vấn đã viết lại, KHÔNG giải thích gì thêm.

Lịch sử hội thoại:
{history}

Câu hỏi gốc: {query}

Câu truy vấn tìm kiếm đã viết lại:"""


async def rewrite(query: str, chat_history: list[dict]) -> str:
    """Viết lại câu query dựa trên ngữ cảnh hội thoại."""
    # Format lịch sử
    if chat_history:
        history_lines = []
        for msg in chat_history[-6:]:  # Lấy 6 tin nhắn gần nhất
            role = "Người dùng" if msg["role"] == "user" else "Trợ lý"
            history_lines.append(f"{role}: {msg['content'][:200]}")
        history_str = "\n".join(history_lines)
    else:
        history_str = "(Không có)"

    prompt = _REWRITE_PROMPT.format(history=history_str, query=query)
    rewritten = await llm.generate_text(prompt, temperature=0.1)
    return rewritten.strip().strip('"').strip("'")
