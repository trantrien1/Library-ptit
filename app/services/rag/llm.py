"""
LLM wrapper cho RAG pipeline.

Text generation và embeddings đều gọi qua OpenRouter.
"""
from openai import AsyncOpenAI

from ...config import settings


class QuotaExceededException(Exception):
    """Raised khi vượt quá API quota sau tất cả các lần retry."""
    pass


class ProviderAuthException(Exception):
    """Raised khi OpenRouter từ chối API key hoặc project/user không hợp lệ."""
    pass


_openrouter_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.OPENROUTER_API_KEY,
)

_RATE_LIMIT_KEYS = ("429", "RESOURCE_EXHAUSTED", "quota", "rate_limit", "too many")
_AUTH_ERROR_KEYS = ("401", "unauthorized", "user not found", "invalid api key", "no auth credentials")


def _is_rate_limit(error: Exception) -> bool:
    text = str(error).lower()
    return any(key in text for key in _RATE_LIMIT_KEYS)


def _is_auth_error(error: Exception) -> bool:
    text = str(error).lower()
    return any(key in text for key in _AUTH_ERROR_KEYS)


def _raise_openrouter_error(error: Exception, service_name: str):
    if _is_auth_error(error):
        raise ProviderAuthException(
            "OpenRouter từ chối API key (401 User not found). "
            "Hãy kiểm tra OPENROUTER_API_KEY trong file .env và restart backend."
        ) from error
    if _is_rate_limit(error):
        raise QuotaExceededException(
            f"OpenRouter {service_name} tạm thời không khả dụng do vượt giới hạn. "
            "Vui lòng thử lại sau 1-2 phút."
        ) from error
    raise error


async def generate_text(
    prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    json_mode: bool = False,
) -> str:
    """Sinh text bằng OpenRouter Chat Completions."""
    try:
        payload = {
            "model": settings.OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        response = await _openrouter_client.chat.completions.create(
            **payload,
        )
        return response.choices[0].message.content or ""
    except Exception as error:
        _raise_openrouter_error(error, "chat")


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Tạo embeddings cho danh sách text bằng OpenRouter Embeddings API."""
    if not texts:
        return []
    try:
        response = await _openrouter_client.embeddings.create(
            model=settings.OPENROUTER_EMBEDDING_MODEL,
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception as error:
        _raise_openrouter_error(error, "embeddings")


async def generate_query_embedding(query: str) -> list[float]:
    """Tạo embedding cho câu query bằng OpenRouter Embeddings API."""
    embeddings = await generate_embeddings([query])
    return embeddings[0] if embeddings else []
