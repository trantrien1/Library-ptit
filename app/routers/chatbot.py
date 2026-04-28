import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.chat import ChatSession, ChatMessage, SenderType
from ..schemas.chatbot import (
    ChatRequest, ChatResponse,
    SessionCreate, SessionUpdate,
    SessionOut, SessionDetailOut, MessageOut,
    IndexResponse,
)
from ..services.rag import llm, pipeline, vector_store
from ..services.rag.llm import ProviderAuthException, QuotaExceededException
from ..utils.dependencies import get_current_user
from ..config import settings

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

_HISTORY_LIMIT = 12  # số tin nhắn gần nhất dùng làm context RAG


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_session_or_404(session_id: int, user_id: int, db: Session) -> ChatSession:
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên chat")
    return session


def _auto_title(text: str, max_len: int = 60) -> str:
    """Tự động tạo tiêu đề từ tin nhắn đầu tiên."""
    text = text.strip()
    return text[:max_len] + "..." if len(text) > max_len else text


def _ensure_text_generation_configured():
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_API_KEY trong file .env")
    if not settings.OPENROUTER_MODEL:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_MODEL trong file .env")


def _ensure_embedding_configured():
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_API_KEY trong file .env")
    if not settings.OPENROUTER_EMBEDDING_MODEL:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_EMBEDDING_MODEL trong file .env")


_DIFFICULTIES = {"easy", "medium", "hard"}
_OPTION_IDS = {"A", "B", "C", "D"}


def _extract_json(raw: str) -> dict:
    clean = (raw or "").strip()
    if clean.startswith("```"):
        clean = clean.removeprefix("```json").removeprefix("```").strip()
        if clean.endswith("```"):
            clean = clean[:-3].strip()
    try:
        data = json.loads(clean)
    except json.JSONDecodeError:
        start = clean.find("{")
        end = clean.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("AI response is not valid JSON")
        data = json.loads(clean[start:end + 1])
    if not isinstance(data, dict):
        raise ValueError("AI response JSON must be an object")
    return data


def _as_tags(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _validate_flashcards(data: dict) -> dict:
    if data.get("type") != "flashcards":
        raise ValueError("Flashcard JSON must have type=flashcards")
    cards = data.get("cards")
    if not isinstance(cards, list) or not cards:
        raise ValueError("Flashcard JSON must include cards")

    normalized_cards = []
    seen_ids = set()
    for index, item in enumerate(cards, start=1):
        if not isinstance(item, dict):
            raise ValueError("Flashcard item must be an object")
        card_id = str(item.get("id") or f"fc_{index}")
        if card_id in seen_ids:
            raise ValueError("Flashcard ids must be unique")
        seen_ids.add(card_id)
        front = str(item.get("front") or "").strip()
        back = str(item.get("back") or "").strip()
        if not front or not back:
            raise ValueError("Flashcard front/back cannot be empty")
        difficulty = str(item.get("difficulty") or "medium")
        if difficulty not in _DIFFICULTIES:
            difficulty = "medium"
        normalized_cards.append({
            "id": card_id,
            "front": front,
            "back": back,
            "hint": str(item.get("hint") or "").strip(),
            "difficulty": difficulty,
            "tags": _as_tags(item.get("tags")),
        })

    return {
        "type": "flashcards",
        "title": str(data.get("title") or "Bộ flashcard ôn tập"),
        "description": str(data.get("description") or "Ôn tập nhanh bằng thẻ lật."),
        "sourceSummary": str(data.get("sourceSummary") or ""),
        "cards": normalized_cards,
    }


def _validate_quiz(data: dict, require_explanations: bool = True) -> dict:
    if data.get("type") != "quiz":
        raise ValueError("Quiz JSON must have type=quiz")
    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError("Quiz JSON must include questions")

    normalized_questions = []
    seen_ids = set()
    for index, item in enumerate(questions, start=1):
        if not isinstance(item, dict):
            raise ValueError("Quiz question must be an object")
        question_id = str(item.get("id") or f"q_{index}")
        if question_id in seen_ids:
            raise ValueError("Quiz question ids must be unique")
        seen_ids.add(question_id)
        question_text = str(item.get("question") or "").strip()
        options = item.get("options")
        if not question_text or not isinstance(options, list) or len(options) != 4:
            raise ValueError("Each quiz question must have text and exactly 4 options")

        normalized_options = []
        for option in options:
            if not isinstance(option, dict):
                raise ValueError("Quiz option must be an object")
            option_id = str(option.get("id") or "").strip()
            option_text = str(option.get("text") or "").strip()
            if option_id not in _OPTION_IDS or not option_text:
                raise ValueError("Quiz option id/text is invalid")
            normalized_options.append({"id": option_id, "text": option_text})

        correct_option_id = str(item.get("correctOptionId") or "").strip()
        if correct_option_id not in {option["id"] for option in normalized_options}:
            raise ValueError("correctOptionId must match an option id")
        explanation = str(item.get("explanation") or "").strip()
        if require_explanations and not explanation:
            raise ValueError("Quiz explanation is required")
        difficulty = str(item.get("difficulty") or "medium")
        if difficulty not in _DIFFICULTIES:
            difficulty = "medium"

        normalized_questions.append({
            "id": question_id,
            "question": question_text,
            "options": normalized_options,
            "correctOptionId": correct_option_id,
            "explanation": explanation,
            "difficulty": difficulty,
            "tags": _as_tags(item.get("tags")),
        })

    return {
        "type": "quiz",
        "title": str(data.get("title") or "Quiz trắc nghiệm"),
        "description": str(data.get("description") or "Luyện tập nhanh với câu hỏi trắc nghiệm."),
        "sourceSummary": str(data.get("sourceSummary") or ""),
        "questions": normalized_questions,
    }


def _source_from_search_result(item: dict) -> dict:
    metadata = item.get("metadata") or {}
    return {
        "book_id": metadata.get("book_id"),
        "title": metadata.get("title") or "",
        "author": metadata.get("author") or "",
        "category": metadata.get("category") or "",
        "available_quantity": metadata.get("available_quantity") or 0,
        "relevance_score": round(1 - float(item.get("distance") or 1), 4),
    }


def _format_sources_for_prompt(sources: list[dict]) -> str:
    if not sources:
        return "Không có nguồn thư viện phù hợp. Dựa trên nội dung người dùng cung cấp."
    return json.dumps(sources, ensure_ascii=False)


async def _generate_valid_json(prompt: str, validator, *, require_explanations: bool | None = None) -> tuple[str, dict]:
    raw_response = ""
    last_error: Exception | None = None
    retry_instruction = """

Lưu ý kỹ thuật bắt buộc:
- Trả về JSON compact/minified hợp lệ.
- Không bọc Markdown, không thêm giải thích ngoài JSON.
- Mỗi câu hỏi/front/back/explanation phải ngắn gọn, tối đa 160 ký tự.
- Không dùng xuống dòng trong string.
- Đảm bảo JSON đóng đủ tất cả dấu ngoặc.
""".strip()

    for attempt in range(2):
        attempt_prompt = prompt if attempt == 0 else f"{prompt}\n\n{retry_instruction}"
        raw_response = await llm.generate_text(
            attempt_prompt,
            temperature=0.1,
            max_tokens=1000,
            json_mode=True,
        )
        try:
            data = _extract_json(raw_response)
            if require_explanations is None:
                return raw_response, validator(data)
            return raw_response, validator(data, require_explanations=require_explanations)
        except Exception as error:
            last_error = error

    raise last_error or ValueError("AI response is not valid JSON")


def build_flashcard_prompt(input_text: str, options: dict, sources: list[dict]) -> str:
    card_count = int(options.get("cardCount") or 10)
    difficulty = str(options.get("difficulty") or "mixed")
    return f"""
Bạn là AI tạo flashcard học tập cho sinh viên từ nội dung được cung cấp.
Hãy tạo bộ flashcard dựa trên yêu cầu của người dùng và nguồn tài liệu nếu có.
Chỉ trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON.

Schema bắt buộc:
{{
  "type": "flashcards",
  "title": string,
  "description": string,
  "sourceSummary": string,
  "cards": [
    {{
      "id": string,
      "front": string,
      "back": string,
      "hint": string,
      "difficulty": "easy" | "medium" | "hard",
      "tags": string[]
    }}
  ]
}}

Yêu cầu:
- Tạo đúng {card_count} thẻ.
- Mức độ ưu tiên: {difficulty}.
- Nội dung ngắn gọn, dễ ôn tập.
- Mỗi thẻ chỉ tập trung vào một ý chính.
- Không tạo thẻ quá dài.
- Mỗi front/back/hint tối đa 160 ký tự.
- front nên là câu hỏi hoặc thuật ngữ.
- back là câu trả lời hoặc định nghĩa rõ ràng.
- tags liên quan đến chủ đề.
- difficulty phải đúng enum.
- Trả về JSON compact hợp lệ, không Markdown.

Yêu cầu người dùng:
{input_text}

Nguồn tài liệu:
{_format_sources_for_prompt(sources)}
""".strip()


def build_quiz_prompt(input_text: str, options: dict, sources: list[dict]) -> str:
    question_count = int(options.get("questionCount") or 10)
    difficulty = str(options.get("difficulty") or "mixed")
    include_explanations = bool(options.get("includeExplanations", True))
    explanation_rule = "explanation không được rỗng." if include_explanations else "explanation có thể ngắn."
    return f"""
Bạn là AI tạo câu hỏi trắc nghiệm học tập cho sinh viên từ nội dung được cung cấp.
Hãy tạo quiz dựa trên yêu cầu của người dùng và nguồn tài liệu nếu có.
Chỉ trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON.

Schema bắt buộc:
{{
  "type": "quiz",
  "title": string,
  "description": string,
  "sourceSummary": string,
  "questions": [
    {{
      "id": string,
      "question": string,
      "options": [
        {{ "id": "A", "text": string }},
        {{ "id": "B", "text": string }},
        {{ "id": "C", "text": string }},
        {{ "id": "D", "text": string }}
      ],
      "correctOptionId": "A" | "B" | "C" | "D",
      "explanation": string,
      "difficulty": "easy" | "medium" | "hard",
      "tags": string[]
    }}
  ]
}}

Yêu cầu:
- Tạo đúng {question_count} câu hỏi.
- Mức độ ưu tiên: {difficulty}.
- Mỗi câu có đúng 4 đáp án A, B, C, D.
- Chỉ có một đáp án đúng.
- Phương án sai phải hợp lý.
- {explanation_rule}
- Câu hỏi, đáp án và giải thích phải ngắn gọn, mỗi trường tối đa 160 ký tự.
- difficulty phải đúng enum.
- Không đưa đáp án đúng ra ngoài JSON.
- Trả về JSON compact hợp lệ, không Markdown.

Yêu cầu người dùng:
{input_text}

Nguồn tài liệu:
{_format_sources_for_prompt(sources)}
""".strip()


# ── Session CRUD ─────────────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(body: SessionCreate, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    """Tạo phiên chat mới."""
    session = ChatSession(user_id=current_user.id, title=body.title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(db: Session = Depends(get_db),
                  current_user=Depends(get_current_user)):
    """Danh sách phiên chat của user, mới nhất trước."""
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session(session_id: int, db: Session = Depends(get_db),
                current_user=Depends(get_current_user)):
    """Lấy phiên chat kèm toàn bộ tin nhắn."""
    return _get_session_or_404(session_id, current_user.id, db)


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def rename_session(session_id: int, body: SessionUpdate,
                   db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    """Đổi tiêu đề phiên chat."""
    session = _get_session_or_404(session_id, current_user.id, db)
    session.title = body.title
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    """Xoá phiên chat."""
    session = _get_session_or_404(session_id, current_user.id, db)
    db.delete(session)
    db.commit()


# ── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat(session_id: int, request: ChatRequest,
               db: Session = Depends(get_db),
               current_user=Depends(get_current_user)):
    """Gửi tin nhắn trong phiên chat, lịch sử được lưu vào DB."""
    _ensure_text_generation_configured()

    session = _get_session_or_404(session_id, current_user.id, db)

    # Lấy lịch sử từ DB
    recent_msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(_HISTORY_LIMIT)
        .all()
    )
    history = [
        {"role": m.sender_type.value, "content": m.content}
        for m in reversed(recent_msgs)
    ]

    # Lưu tin nhắn người dùng
    user_msg = ChatMessage(
        session_id=session_id,
        sender_type=SenderType.user,
        content=request.message,
    )
    db.add(user_msg)

    # Tự động đặt tiêu đề từ tin nhắn đầu tiên
    if not recent_msgs and session.title == "Cuộc trò chuyện mới":
        session.title = _auto_title(request.message)

    if request.mode in {"quiz", "flashcard"}:
        sources = []
        raw_response = ""

        try:
            if request.mode == "quiz":
                prompt = build_quiz_prompt(request.message, request.options, sources)
                raw_response, structured = await _generate_valid_json(
                    prompt,
                    _validate_quiz,
                    require_explanations=bool(request.options.get("includeExplanations", True)),
                )
                result_type = "quiz"
                answer = "Đã tạo quiz trắc nghiệm. Hãy làm bài trực tiếp bên dưới."
                meta = {
                    "mode": "quiz",
                    "resultType": result_type,
                    "quiz": structured,
                    "sources": sources,
                    "rawResponse": raw_response,
                    "rewritten_query": request.message,
                }
            else:
                prompt = build_flashcard_prompt(request.message, request.options, sources)
                raw_response, structured = await _generate_valid_json(prompt, _validate_flashcards)
                result_type = "flashcards"
                answer = "Đã tạo bộ flashcard ôn tập. Hãy luyện tập trực tiếp bên dưới."
                meta = {
                    "mode": "flashcard",
                    "resultType": result_type,
                    "flashcards": structured,
                    "sources": sources,
                    "rawResponse": raw_response,
                    "rewritten_query": request.message,
                }
        except QuotaExceededException as e:
            db.rollback()
            raise HTTPException(status_code=503, detail=str(e))
        except ProviderAuthException as e:
            db.rollback()
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            result_type = "validation_error"
            answer = "AI trả về dữ liệu chưa đúng định dạng. Vui lòng thử lại."
            meta = {
                "mode": request.mode,
                "resultType": result_type,
                "validationError": str(e),
                "sources": sources,
                "rawResponse": raw_response,
                "rewritten_query": request.message,
            }

        assistant_msg = ChatMessage(
            session_id=session_id,
            sender_type=SenderType.assistant,
            content=answer,
            metadata_=json.dumps(meta, ensure_ascii=False),
        )
        db.add(assistant_msg)
        session.version = (session.version or 1) + 1
        db.commit()

        return ChatResponse(
            answer=answer,
            rewritten_query=request.message,
            sources=sources,
            result_type=result_type,
            metadata=meta,
        )

    try:
        result = await pipeline.chat(db, request.message, history)
    except QuotaExceededException as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderAuthException as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi chatbot: {str(e)}")

    # Lưu tin nhắn assistant kèm metadata RAG
    meta = {
        "mode": request.mode,
        "resultType": "text",
        "rewritten_query": result["rewritten_query"],
        "sources": result["sources"],
    }
    assistant_msg = ChatMessage(
        session_id=session_id,
        sender_type=SenderType.assistant,
        content=result["answer"],
        metadata_=json.dumps(meta, ensure_ascii=False),
    )
    db.add(assistant_msg)

    # Tăng version session (optimistic versioning)
    session.version = (session.version or 1) + 1
    db.commit()

    return ChatResponse(
        answer=result["answer"],
        rewritten_query=result["rewritten_query"],
        sources=result["sources"],
        result_type="text",
        metadata=meta,
    )


# ── Index & Status ───────────────────────────────────────────────────────────

@router.post("/index", response_model=IndexResponse)
async def index_books(db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    """Index toàn bộ sách vào vector store."""
    _ensure_embedding_configured()
    try:
        count = await pipeline.index_all_books(db)
        return IndexResponse(message="Index thành công", indexed_count=count)
    except QuotaExceededException as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderAuthException as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi index: {str(e)}")


@router.get("/status")
async def chatbot_status(db: Session = Depends(get_db)):
    """Kiểm tra trạng thái chatbot."""
    openrouter_chat_ready = bool(settings.OPENROUTER_API_KEY and settings.OPENROUTER_MODEL)
    openrouter_embedding_ready = bool(settings.OPENROUTER_API_KEY and settings.OPENROUTER_EMBEDDING_MODEL)
    indexed = vector_store.get_indexed_count(db)
    return {
        "openrouter_configured": bool(settings.OPENROUTER_API_KEY),
        "openrouter_model_configured": bool(settings.OPENROUTER_MODEL),
        "openrouter_embedding_model_configured": bool(settings.OPENROUTER_EMBEDDING_MODEL),
        "embedding_provider": "openrouter",
        "indexed_books": indexed,
        "ready": openrouter_chat_ready and openrouter_embedding_ready and indexed > 0,
    }
