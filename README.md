# Library PTIT Reader Workspace

Hệ thống thư viện số cho sinh viên PTIT, gồm backend FastAPI, database MySQL và frontend Next.js. Dự án hỗ trợ quản lý sách, mượn trả, dashboard quản trị/người dùng, Chatbot AI RAG, cộng đồng học tập, sự kiện & lab, thông tin thư viện, feedback và đóng góp.

## Tính Năng Chính

### Reader Workspace

- Tra cứu sách, xem chi tiết, đánh giá và thêm vào giỏ mượn.
- Tạo phiếu mượn, theo dõi trạng thái, chỉnh sửa, hủy và gửi yêu cầu gia hạn.
- Dashboard cá nhân với KPI, lời nhắc, hoạt động cộng đồng, sự kiện/lab và chatbot.
- Chatbot AI với các chế độ: Hỏi đáp thông minh, Chatbot thư viện, Tóm tắt nội dung, Quiz trắc nghiệm, Flashcard ôn tập.
- Quiz và Flashcard được render bằng UI tương tác từ JSON do AI trả về.
- Library Social Hub: tạo nhóm, tham gia/rời nhóm, duyệt thành viên, đăng bài, like, bình luận, phân quyền quản trị nhóm.
- Sự kiện & Lab: đăng ký sự kiện, xem mã check-in, đặt lịch lab/thiết bị, xem tutorial/video.
- Thông tin thư viện: giờ mở cửa, tin tức, thông báo, feedback, tình nguyện và đóng góp tài liệu.

### Admin Console

- Quản lý sách, độc giả, phiếu mượn và nhắc hạn trả.
- Dashboard quản trị với thống kê thư viện, cộng đồng, sự kiện/lab, feedback và chatbot.
- Quản lý Social Hub, nhóm, bài viết và quyền quản trị nhóm.
- Quản lý sự kiện, danh sách đăng ký, check-in, lab, booking lab và tutorial.
- Quản lý tin tức/thông báo, feedback, donation và chương trình tình nguyện.

## Công Nghệ

- Backend: Python, FastAPI, SQLAlchemy, Pydantic
- Database: MySQL
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI, lucide-react
- Auth: JWT
- AI: OpenRouter cho chat completion và embeddings
- RAG: Query rewrite, vector search, rerank, context compression, answer generation

## Cấu Trúc Dự Án

```text
Library-ptit/
├── main.py
├── requirements.txt
├── .env                         # Tạo thủ công, không commit
├── app/
│   ├── config.py
│   ├── database.py
│   ├── database_schema.py
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── services/
│   │   └── rag/
│   └── utils/
├── scripts/
│   ├── init_data.py
│   └── demo_*.ps1
├── sql/
│   └── init.sql
├── uploads/
├── frontend/                    # Frontend HTML cũ, giữ để tham khảo
└── web/                         # Frontend Next.js hiện tại
    ├── app/
    ├── components/
    ├── lib/
    └── public/
```

## Cài Đặt Backend

### 1. Tạo Database

Chạy MySQL và tạo schema bằng file SQL:

```bash
mysql -u root -p < sql/init.sql
```

Hoặc mở MySQL Workbench và chạy nội dung `sql/init.sql`.

### 2. Tạo File `.env`

Tạo file `.env` tại đúng thư mục root backend:

```text
Library-ptit/.env
```

Ví dụ:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=library_ptit

# JWT
SECRET_KEY=change-this-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-your-new-key
OPENROUTER_MODEL=openai/gpt-5.4-nano
OPENROUTER_EMBEDDING_MODEL=qwen/qwen3-embedding-4b

# Uploads
UPLOAD_DIR=uploads

# Reminder scheduler + email, optional
REMINDER_DAYS_AHEAD_DEFAULT=3
REMINDER_SCHEDULER_ENABLED=false
REMINDER_SCHEDULER_INTERVAL_MINUTES=60
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
```


### 3. Cài Dependencies

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Linux/macOS:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Seed Dữ Liệu Mẫu

```bash
python scripts/init_data.py
```

Script này tạo:

- Admin/user mẫu
- 10 sách mẫu và ảnh bìa từ `web/public`
- Dữ liệu cộng đồng, sự kiện/lab, tutorial, tin tức, feedback/donation mẫu
- Embeddings cho sách nếu `OPENROUTER_API_KEY` hợp lệ

Nếu chỉ muốn kiểm tra biến môi trường backend đang đọc:

```powershell
$env:PYTHONIOENCODING='utf-8'
.\venv\Scripts\python.exe -c "from app.config import settings; print(settings.DB_HOST, settings.DB_NAME, bool(settings.OPENROUTER_API_KEY), settings.OPENROUTER_MODEL, settings.OPENROUTER_EMBEDDING_MODEL)"
```

### 5. Chạy Backend

```bash
uvicorn main:app --reload
```

Backend chạy tại:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Cài Đặt Frontend Next.js

```bash
cd web
npm install
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:3000
```

Nếu port 3000 bận, Next.js sẽ tự dùng port khác.

Build production:

```bash
cd web
npm run build
npm run start
```

Nếu cần cấu hình API root cho frontend, tạo `web/.env.local`:

```env
NEXT_PUBLIC_API_ROOT=http://127.0.0.1:8000
```

## Tài Khoản Mẫu

Admin:

```text
username: admin
password: admin123
```

User:

```text
username: user1
password: user123
```

Một số user cộng đồng mẫu dùng password:

```text
user123
```

## Chatbot AI Và OpenRouter

Chatbot dùng OpenRouter cho:

- Chat completion: hỏi đáp, RAG, tóm tắt, quiz, flashcard
- Embeddings: index sách và tìm kiếm vector

Các chế độ `quiz` và `flashcard` không đi qua RAG. Backend yêu cầu AI trả JSON hợp lệ, validate schema rồi frontend render thành UI tương tác.

Nếu gặp lỗi:

```text
OpenRouter từ chối API key (401 User not found)
```

Kiểm tra theo thứ tự:

1. File `.env` nằm đúng tại `Library-ptit/.env`.
2. `OPENROUTER_API_KEY` là key mới, chưa bị revoke.
3. Không còn key cũ ở biến môi trường hệ thống hoặc `.env` thư mục cha.
4. Backend đã được restart sau khi đổi key.
5. Tài khoản OpenRouter còn credit/quota và model được phép sử dụng.

Nếu từng lộ key trên Git:

1. Revoke key cũ trên OpenRouter.
2. Tạo key mới.
3. Xóa key khỏi git history bằng BFG Repo-Cleaner hoặc `git filter-repo`.
4. Force-push lịch sử đã làm sạch nếu repo remote cần sạch.

## Các Endpoint Chính

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Books:

- `GET /api/books`
- `POST /api/books`
- `PATCH /api/books/{id}`
- `DELETE /api/books/{id}`

Borrowing:

- `GET /api/borrows`
- `POST /api/borrows`
- `PATCH /api/borrows/{id}`
- `POST /api/borrows/{id}/approve`
- `POST /api/borrows/{id}/return`

Chatbot:

- `GET /api/chatbot/sessions`
- `POST /api/chatbot/sessions`
- `POST /api/chatbot/sessions/{session_id}/chat`
- `POST /api/chatbot/index`
- `GET /api/chatbot/status`

Social Hub:

- `GET /api/platform/groups`
- `POST /api/platform/groups`
- `POST /api/platform/groups/{group_id}/join`
- `DELETE /api/platform/groups/{group_id}/leave`
- `PATCH /api/platform/groups/{group_id}/members/{user_id}/approve`
- `PATCH /api/platform/groups/{group_id}/members/{user_id}/reject`
- `GET /api/platform/posts`
- `POST /api/platform/posts`
- `PATCH /api/platform/posts/{post_id}`
- `DELETE /api/platform/posts/{post_id}`

Sự kiện & Lab:

- `GET /api/events`
- `POST /api/events`
- `POST /api/events/{id}/register`
- `DELETE /api/events/{id}/register`
- `POST /api/events/{id}/checkin`
- `GET /api/labs`
- `POST /api/labs/{id}/bookings`
- `GET /api/lab-bookings`
- `PATCH /api/lab-bookings/{id}/approve`
- `PATCH /api/lab-bookings/{id}/reject`
- `GET /api/tutorials`

Thông tin thư viện:

- `GET /api/library-info`
- `GET /api/news`
- `POST /api/feedback`
- `GET /api/my-feedback`
- `POST /api/donations`
- `GET /api/volunteer-programs`

Dashboard:

- `GET /api/dashboard/user/overview`
- `GET /api/dashboard/admin/overview`

## Kiểm Tra Nhanh

Backend syntax:

```bash
python -m py_compile app/config.py app/services/rag/llm.py app/routers/chatbot.py scripts/init_data.py
```

Frontend build:

```bash
cd web
npm run build
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Chatbot status:

```bash
curl http://127.0.0.1:8000/api/chatbot/status
```

## Ghi Chú Bảo Mật

- `.env` không được commit.
- Không hard-code API key trong `app/config.py`.
- Khi nghi ngờ key đã lộ, revoke ngay và tạo key mới.
- Không chia sẻ database password, JWT secret hoặc OpenRouter key trong issue/commit/log public.

## License

Dự án phục vụ học tập và phát triển hệ thống thư viện số PTIT.