import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "library_ptit")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    # OpenRouter API (text generation + embeddings)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "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")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-5.4-nano")
    OPENROUTER_EMBEDDING_MODEL: str = os.getenv(
        "OPENROUTER_EMBEDDING_MODEL",
        "qwen/qwen3-embedding-4b",
    )

    # Reminder scheduler + email
    REMINDER_DAYS_AHEAD_DEFAULT: int = int(os.getenv("REMINDER_DAYS_AHEAD_DEFAULT", "3"))
    REMINDER_SCHEDULER_ENABLED: bool = os.getenv("REMINDER_SCHEDULER_ENABLED", "false").lower() == "true"
    REMINDER_SCHEDULER_INTERVAL_MINUTES: int = int(os.getenv("REMINDER_SCHEDULER_INTERVAL_MINUTES", "60"))

    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # File uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    PDF_PREVIEW_MAX_PAGES: int = int(os.getenv("PDF_PREVIEW_MAX_PAGES", "15"))

    # Renewal
    MAX_RENEWAL_COUNT: int = int(os.getenv("MAX_RENEWAL_COUNT", "2"))
    DEFAULT_RENEWAL_DAYS: int = int(os.getenv("DEFAULT_RENEWAL_DAYS", "7"))

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()

