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
from ..services.rag import pipeline, vector_store
from ..services.rag.llm import QuotaExceededException
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
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_API_KEY trong file .env")

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

    try:
        result = await pipeline.chat(db, request.message, history)
    except QuotaExceededException as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi chatbot: {str(e)}")

    # Lưu tin nhắn assistant kèm metadata RAG
    meta = {
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
    )


# ── Index & Status ───────────────────────────────────────────────────────────

@router.post("/index", response_model=IndexResponse)
async def index_books(db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    """Index toàn bộ sách vào vector store."""
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="Chưa cấu hình OPENROUTER_API_KEY trong file .env")
    try:
        count = await pipeline.index_all_books(db)
        return IndexResponse(message="Index thành công", indexed_count=count)
    except QuotaExceededException as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi index: {str(e)}")


@router.get("/status")
async def chatbot_status(db: Session = Depends(get_db)):
    """Kiểm tra trạng thái chatbot."""
    has_key = bool(settings.OPENROUTER_API_KEY)
    indexed = vector_store.get_indexed_count(db)
    return {
        "gemini_configured": has_key,
        "indexed_books": indexed,
        "ready": has_key and indexed > 0,
    }
