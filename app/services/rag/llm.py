"""
LLM wrapper cho RAG pipeline.
- Text generation: OpenRouter API (Qwen3-4B)
- Embeddings: Google Gemini (gemini-embedding-001)
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor

import google.genai as genai
from openai import AsyncOpenAI

from ...config import settings


class QuotaExceededException(Exception):
    """Raised khi vượt quá API quota sau tất cả các lần retry."""
    pass


# Gemini client (embeddings only)
_gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
_executor = ThreadPoolExecutor(max_workers=5)

# OpenRouter async client (text generation)
_openrouter_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.OPENROUTER_API_KEY,
)

# Từ khoá nhận diện lỗi rate limit / quota
_RATE_LIMIT_KEYS = ("429", "RESOURCE_EXHAUSTED", "quota", "rate_limit", "too many")


def _is_rate_limit(error: Exception) -> bool:
    s = str(error).lower()
    return any(k in s for k in _RATE_LIMIT_KEYS)


async def _embedding_with_retry(fn, max_retries: int = 3, base_delay: float = 2.0):
    """Chạy hàm embedding sync trong ThreadPoolExecutor với retry."""
    loop = asyncio.get_event_loop()
    for attempt in range(max_retries):
        try:
            return await loop.run_in_executor(_executor, fn)
        except Exception as e:
            if _is_rate_limit(e) and attempt < max_retries - 1:
                wait = base_delay * (2 ** attempt)   # 2s, 4s, 8s
                await asyncio.sleep(wait)
                continue
            if _is_rate_limit(e):
                raise QuotaExceededException(
                    "Embedding API tạm thời không khả dụng do vượt giới hạn. "
                    "Vui lòng thử lại sau 1-2 phút."
                ) from e
            raise


async def generate_text(prompt: str, temperature: float = 0.3) -> str:
    """Sinh text bằng OpenRouter (Qwen3-4B)."""
    response = await _openrouter_client.chat.completions.create(
        model=settings.OPENROUTER_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=2048,
    )
    return response.choices[0].message.content


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Tạo embeddings cho danh sách text bằng Gemini, retry khi bị rate limit."""
    def _fn():
        result = _gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
        )
        return [emb.values for emb in result.embeddings]

    return await _embedding_with_retry(_fn)


async def generate_query_embedding(query: str) -> list[float]:
    """Tạo embedding cho câu query bằng Gemini, retry khi bị rate limit."""
    def _fn():
        result = _gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=query,
        )
        return result.embeddings[0].values

    return await _embedding_with_retry(_fn)
