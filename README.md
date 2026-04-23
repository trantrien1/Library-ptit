# 📚 Thư viện PTIT - Hệ thống quản lý thư viện trực tuyến

Dự án quản lý thư viện cho Học viện Công nghệ Bưu chính Viễn thông (PTIT).

## 📋 Tính năng

### Dành cho Admin (Quản lý thư viện)
- **Quản lý sách**: Thêm, sửa, xóa, tìm kiếm sách
- **Quản lý độc giả**: Xem, cập nhật thông tin, reset mật khẩu, vô hiệu hóa tài khoản
- **Quản lý mượn trả**: Duyệt/từ chối phiếu mượn, yêu cầu chỉnh sửa, xác nhận trả sách
- **Dashboard thống kê**: Biểu đồ Bar/Line/Pie theo bộ lọc thời gian (7/30/90 ngày)
- **Nhắc hạn chủ động**: Có thể chạy thủ công hoặc chạy scheduler định kỳ để gửi email nhắc hạn

### Dành cho User (Độc giả)
- **Xem danh sách sách**: Tìm kiếm, lọc theo danh mục
- **Giỏ mượn (Wishlist)**: Thêm sách muốn mượn, điều chỉnh số lượng
- **Tạo phiếu mượn**: Gửi yêu cầu mượn sách, chờ admin duyệt
- **Theo dõi phiếu mượn**: Xem trạng thái, chỉnh sửa khi cần
- **Nhắc hạn trả tự động**: Cảnh báo phiếu sắp đến hạn hoặc quá hạn ngay trên dashboard và trang phiếu mượn
- **Xem nhanh chi tiết phiếu**: Từ banner nhắc hạn có nút mở thẳng modal chi tiết phiếu

## 🤖 Chatbot AI với RAG

### Tính năng
- **Trợ lý thư viện thông minh**: Hỏi đáp về sách trong thư viện
- **Tìm kiếm nâng cao**: Sử dụng RAG (Retrieval-Augmented Generation) để trả lời chính xác
- **Lịch sử hội thoại**: Lưu trữ và quản lý các phiên trò chuyện
- **Gợi ý sách**: Đề xuất sách dựa trên câu hỏi

### Cách sử dụng
1. Đăng nhập vào tài khoản user
2. Truy cập trang Chatbot AI
3. Nhập câu hỏi về sách (ví dụ: "Có sách nào về Python không?")
4. Chatbot sẽ trả lời dựa trên dữ liệu sách trong thư viện

### Công nghệ RAG
- **Query Rewriting**: Viết lại câu hỏi để tìm kiếm tốt hơn
- **Vector Search**: Tìm kiếm sách tương tự bằng embedding
- **Re-ranking**: Sắp xếp kết quả tìm kiếm
- **Context Compression**: Nén thông tin sách liên quan
- **LLM Generation**: Sinh câu trả lời bằng OpenRouter và Gemini

## 🛠️ Công nghệ sử dụng

- **Backend**: Python + FastAPI
- **Database**: MySQL
- **Frontend**: HTML/CSS/JavaScript (Vanilla)
- **Authentication**: JWT (JSON Web Tokens)
- **AI/ML**: Google Gemini (embeddings), OpenRouter (LLM), NumPy
- **Vector Store**: MySQL với cosine similarity cho RAG

## 📁 Cấu trúc dự án

```
LibraryPTIT/
├── main.py                 # Entry point FastAPI
├── requirements.txt        # Python dependencies
├── .env                    # Biến môi trường (cần cấu hình)
├── app/
│   ├── config.py          # Cấu hình (DB, JWT)
│   ├── database.py        # Kết nối MySQL
│   ├── models/            # SQLAlchemy Models
│   │   ├── user.py
│   │   ├── book.py
│   │   ├── book_embedding.py
│   │   ├── wishlist.py
│   │   ├── borrow.py
│   │   ├── chat.py
│   │   └── borrow.py
│   ├── schemas/           # Pydantic Schemas
│   │   ├── user.py
│   │   ├── book.py
│   │   ├── wishlist.py
│   │   ├── borrow.py
│   │   └── chatbot.py
│   ├── routers/           # API Routes
│   │   ├── auth.py
│   │   ├── books.py
│   │   ├── users.py
│   │   ├── wishlist.py
│   │   ├── borrows.py
│   │   └── chatbot.py
│   ├── services/          # Business Logic
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── pipeline.py
│   │   │   ├── llm.py
│   │   │   ├── vector_store.py
│   │   │   ├── query_rewriter.py
│   │   │   ├── reranker.py
│   │   │   └── context_compressor.py
│   └── utils/             # Utilities
│       ├── auth.py        # JWT, Password hashing
│       └── dependencies.py # Dependency injection
├── frontend/
│   ├── index.html         # Trang chủ
│   ├── login.html         # Đăng nhập
│   ├── register.html      # Đăng ký
│   ├── css/style.css      # Styles
│   ├── js/
│   │   ├── api.js         # API calls
│   │   ├── auth.js        # Auth utilities
│   │   └── app.js         # UI utilities
│   ├── admin/             # Trang Admin
│   │   ├── dashboard.html
│   │   ├── books.html
│   │   ├── users.html
│   │   └── borrows.html
│   └── user/              # Trang User
│       ├── dashboard.html
│       ├── books.html
│       ├── wishlist.html
│       └── borrows.html
└── sql/
    └── init.sql           # Script tạo database
```

## 🚀 Hướng dẫn cài đặt

### Bước 1: Cài đặt MySQL

1. Tải và cài đặt MySQL: https://dev.mysql.com/downloads/
2. Tạo database và chạy script SQL:

```bash
# Đăng nhập MySQL
mysql -u root -p

# Chạy script tạo database
source sql/init.sql
```

Hoặc mở MySQL Workbench và chạy nội dung file `sql/init.sql`.

### Bước 2: Cấu hình môi trường

1. Mở file `.env` và cập nhật thông tin:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password  # ← Đổi thành password của bạn
DB_NAME=library_ptit

# JWT Configuration
SECRET_KEY=your-super-secret-key-change-this  # ← Đổi thành key bí mật
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Reminder Scheduler + SMTP (tuỳ chọn)
REMINDER_DAYS_AHEAD_DEFAULT=3
REMINDER_SCHEDULER_ENABLED=false
REMINDER_SCHEDULER_INTERVAL_MINUTES=60
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_USE_TLS=true

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key  # ← API key từ Google AI Studio
OPENROUTER_API_KEY=your_openrouter_api_key  # ← API key từ OpenRouter
```

### Lấy API Keys cho Chatbot

1. **GEMINI_API_KEY**: Đăng ký tại [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **OPENROUTER_API_KEY**: Đăng ký tại [OpenRouter](https://openrouter.ai/keys)

### Bước 3: Cài đặt Python dependencies

```bash
# Tạo virtual environment (khuyến nghị)
python -m venv venv

# Kích hoạt venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Cài đặt packages
pip install -r requirements.txt
```

### Bước 4: Chạy ứng dụng

```bash
# Chạy server
uvicorn main:app --reload

# Hoặc
python -m uvicorn main:app --reload
```

Server sẽ chạy tại: http://localhost:8000

## 📖 Sử dụng

### Truy cập ứng dụng

- **Trang chủ**: http://localhost:8000/static/index.html
- **Đăng nhập**: http://localhost:8000/static/login.html
- **API Docs**: http://localhost:8000/docs (Swagger UI)

### Demo nhanh API thống kê Admin

Chạy script PowerShell để gọi 3 endpoint thống kê (overview, books, users):

```powershell
Set-Location d:\Developer\Library-ptit
.\scripts\demo_admin_stats.ps1 -BaseUrl "http://127.0.0.1:8000" -Username "admin" -Password "admin123" -PeriodDays 30
```

### Demo nhanh API nhắc hạn trả

Chạy script PowerShell để xem phiếu đang mượn và kết quả nhắc hạn trả theo 2 khung thời gian:

```powershell
Set-Location d:\Developer\Library-ptit
.\scripts\demo_due_reminders.ps1 -BaseUrl "http://127.0.0.1:8000" -Username "user1" -Password "123456" -DaysAhead 3
```

### Demo nhanh scheduler/email nhắc hạn (Admin)

Kiểm tra trạng thái scheduler và chạy nhắc hạn thủ công bằng tài khoản admin:

```powershell
Set-Location d:\Developer\Library-ptit
.\scripts\demo_reminder_scheduler.ps1 -BaseUrl "http://127.0.0.1:8000" -Username "admin" -Password "admin123" -DaysAhead 3 -DryRun $true
```

Hoặc gọi thủ công từng request:

```powershell
$baseUrl = "http://127.0.0.1:8000"
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=admin&password=admin123"
$headers = @{ Authorization = "Bearer $($login.access_token)" }
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/admin/notifications/reminders/status" -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/admin/notifications/reminders/run?days_ahead=3&dry_run=true" -Headers $headers | ConvertTo-Json -Depth 6
```

> Lưu ý: để gửi email thật, cần cấu hình SMTP đầy đủ và đặt `REMINDER_SCHEDULER_ENABLED=true`.

### Tài khoản mặc định

- **Admin**:
  - Username: `admin`
  - Password: `admin123`

### Quy trình mượn sách

1. **User đăng ký/đăng nhập**
2. **Xem danh sách sách** → Thêm sách vào giỏ mượn
3. **Vào giỏ mượn** → Điều chỉnh số lượng → Chọn ngày trả → Tạo phiếu mượn
4. **Phiếu mượn ở trạng thái "Chờ duyệt"**
5. **Admin duyệt phiếu** → Số lượng sách giảm
6. **Nếu không đủ sách** → Admin yêu cầu chỉnh sửa → User chỉnh lại
7. **Khi trả sách** → Admin xác nhận → Số lượng sách tăng lại

### Sử dụng Chatbot AI

1. Đăng nhập với tài khoản user
2. Truy cập "Chatbot AI" từ menu
3. Nhập câu hỏi về sách (ví dụ: "Tìm sách về trí tuệ nhân tạo")
4. Chatbot sẽ trả lời và hiển thị sách liên quan
5. Có thể tạo nhiều phiên trò chuyện khác nhau

---
Dự án được phát triển cho môn học Python - PTIT.
© 2026 Thư viện PTIT. All rights reserved.

