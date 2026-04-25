import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app.database_schema import ensure_database_schema
from app.routers import auth_router, books_router, users_router, wishlist_router, borrows_router, chatbot_router, admin_stats_router, notifications_router, reviews_router, platform_router, events_lab_router, library_info_router, dashboard_router
from app.services.notifications import reminder_scheduler
from app.config import settings

BASE_DIR = Path(__file__).resolve().parent
LEGACY_FRONTEND_DIR = BASE_DIR / "frontend"
UPLOAD_DIR = BASE_DIR / settings.UPLOAD_DIR

# Tạo tables trong database
ensure_database_schema(engine)

# Tạo thư mục uploads
os.makedirs(UPLOAD_DIR / "books", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    reminder_scheduler.start()
    try:
        yield
    finally:
        reminder_scheduler.shutdown()


app = FastAPI(
    title="Thư viện PTIT API",
    description="API cho hệ thống quản lý thư viện PTIT",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - cho phép frontend truy cập API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production nên giới hạn origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files cho frontend
if LEGACY_FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=LEGACY_FRONTEND_DIR), name="static")

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth_router)
app.include_router(books_router)
app.include_router(users_router)
app.include_router(wishlist_router)
app.include_router(borrows_router)
app.include_router(chatbot_router)
app.include_router(admin_stats_router)
app.include_router(notifications_router)
app.include_router(reviews_router)
app.include_router(platform_router)
app.include_router(events_lab_router)
app.include_router(library_info_router)
app.include_router(dashboard_router)


@app.get("/")
async def root():
    return {"message": "Chào mừng đến với Thư viện PTIT API", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
