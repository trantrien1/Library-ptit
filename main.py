from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routers import auth_router, books_router, users_router, wishlist_router, borrows_router, chatbot_router

# Tạo tables trong database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Thư viện PTIT API",
    description="API cho hệ thống quản lý thư viện PTIT",
    version="1.0.0"
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
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Include routers
app.include_router(auth_router)
app.include_router(books_router)
app.include_router(users_router)
app.include_router(wishlist_router)
app.include_router(borrows_router)
app.include_router(chatbot_router)


@app.get("/")
async def root():
    return {"message": "Chào mừng đến với Thư viện PTIT API", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

