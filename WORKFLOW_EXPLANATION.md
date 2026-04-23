# 🏗️ WORKFLOW - DÒNG CHẢY DỰ ÁN THƯ VIỆN PTIT

## 📊 SƠ ĐỒ TỔNG QUÁT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THƯ VIỆN PTIT - HỆ THỐNG                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────┐              ┌──────────────────────────┐     │
│  │      FRONTEND            │              │      BACKEND (FastAPI)   │     │
│  ├──────────────────────────┤              ├──────────────────────────┤     │
│  │ - index.html (Trang chủ) │              │ main.py (Entry Point)    │     │
│  │ - login.html             │◄──────────►  │ app/routers/*.py         │     │
│  │ - register.html          │    HTTP      │ app/schemas/*.py         │     │
│  │ - admin/*                │   Request    │ app/models/*.py          │     │
│  │ - user/*                 │   Response   │ app/services/*           │     │
│  │ - css/style.css          │              │ app/utils/*              │     │
│  │ - js/*.js                │              │                          │     │
│  └──────────────────────────┘              └──────────────────────────┘     │
│         (User Interface)                      (Business Logic)              │
│                                                      ▲                      │
│                                                      │                      │
│                                        ┌─────────────▼──────────────┐       │
│                                        │    MySQL Database          │       │
│                                        ├────────────────────────────┤       │
│                                        │ - users                    │       │
│                                        │ - books                    │       │
│                                        │ - wishlist                 │       │
│                                        │ - borrow_requests          │       │
│                                        │ - borrow_items             │       │
│                                        │ - chat_sessions            │       │
│                                        │ - chat_messages            │       │
│                                        │ - book_embeddings (RAG)    │       │
│                                        └────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 WORKFLOW TỪNG FEATURE

### 1️⃣ **AUTHENTICATION (ĐĂNG KÝ & ĐĂNG NHẬP)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
└─────────────────────────────────────────────────────────────────┘

A. ĐĂNG KÝ (Register):
   
   Frontend (register.html)
   └─► User nhập: username, email, password, full_name, phone
       └─► POST /api/auth/register (UserCreate schema)
           └─► Backend auth.py
               ├─ Kiểm tra username tồn tại? ❌ → Error 400
               ├─ Kiểm tra email tồn tại? ❌ → Error 400
               ├─ Hash password bằng bcrypt
               ├─ Tạo User (role = "user", is_active = True)
               ├─ Lưu vào database
               └─► Response: UserResponse (id, username, email, role, created_at)

B. ĐĂNG NHẬP (Login):
   
   Frontend (login.html)
   └─► User nhập: username, password
       └─► POST /api/auth/login (OAuth2PasswordRequestForm)
           └─► Backend auth.py
               ├─ Tìm user theo username
               ├─ Verify password với stored hash ❌ → Error 401
               ├─ Kiểm tra is_active ❌ → Error 403
               ├─ Create JWT Token:
               │  ├─ sub: username
               │  ├─ user_id: user.id
               │  ├─ role: user.role ("admin" hoặc "user")
               │  └─ Hết hạn: 30 phút
               └─► Response: Token (access_token, token_type="bearer")
                   └─► Frontend lưu token vào localStorage
                       └─► Thêm vào header: Authorization: Bearer {token}

C. LẤY THÔNG TIN USER HIỆN TẠI (Get Me):
   
   Frontend (any page)
   └─► GET /api/auth/me (Header: Authorization: Bearer {token})
       └─► Backend auth.py + get_current_user (dependency)
           ├─ Decode JWT token → lấy user_id
           ├─ Query database → lấy User
           └─► Response: UserResponse

```

---

### 2️⃣ **QUẢN LÝ SÁCH (Books Management)**

```
┌─────────────────────────────────────────────────────────────────┐
│              BOOKS MANAGEMENT FLOW                              │
└─────────────────────────────────────────────────────────────────┘

A. XEM DANH SÁCH SÁCH (Get Books):
   
   Frontend (user/books.html)
   └─► GET /api/books?page=1&page_size=10&search=Python&category=IT
       └─► Backend books.py
           ├─ Lấy tất cả books từ database
           ├─ Tìm kiếm: title LIKE, author LIKE, isbn LIKE
           ├─ Lọc: category == ?
           ├─ Pagination: offset, limit
           └─► Response: BookListResponse
               ├─ items: [Book1, Book2, ...]
               ├─ total: 50
               ├─ page: 1
               ├─ page_size: 10
               └─ total_pages: 5

B. XEM CHI TIẾT SÁCH (Get Book):
   
   Frontend (click vào sách)
   └─► GET /api/books/{book_id}
       └─► Backend books.py
           ├─ Query: WHERE id = {book_id}
           └─► Response: BookResponse (id, title, author, quantity, available_quantity, ...)

C. THÊM SÁCH MỚI (Admin Only):
   
   Frontend (admin/books.html)
   └─► POST /api/books (Header: Authorization: Bearer {admin_token})
       └─► Backend books.py + get_current_admin (dependency)
           ├─ Verify user.role == "admin" ❌ → Error 403
           ├─ Kiểm tra ISBN đã tồn tại ❌ → Error 400
           ├─ Tạo Book mới (available_quantity = quantity)
           ├─ Lưu vào database
           └─► Response: BookResponse

D. CẬP NHẬT SÁCH (Admin Only):
   
   PUT /api/books/{book_id}
   └─► Backend books.py
       ├─ Verify admin role
       ├─ Update fields (optional): title, author, quantity, category, ...
       ├─ Update available_quantity
       └─► Response: BookResponse

E. XÓA SÁCH (Admin Only):
   
   DELETE /api/books/{book_id}
   └─► Backend books.py
       ├─ Verify admin role
       ├─ Xóa khỏi database
       └─► Response: {message: "Xóa thành công"}

```

---

### 3️⃣ **WISHLIST (GIỎ MƯỢN)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    WISHLIST FLOW                                │
└─────────────────────────────────────────────────────────────────┘

A. XEM WISHLIST (Get Wishlist):
   
   Frontend (user/dashboard.html)
   └─► GET /api/wishlist (Header: Authorization: Bearer {token})
       └─► Backend wishlist.py + get_current_user
           ├─ Query: wishlist WHERE user_id = {current_user.id}
           ├─ Load relationship: book (BookResponse)
           └─► Response: WishlistResponse
               ├─ items: [WishlistItem1, WishlistItem2, ...]
               └─ total_items: 3

B. THÊM VÀO WISHLIST (Add to Wishlist):
   
   Frontend (user/books.html - click "Thêm vào giỏ mượn")
   └─► POST /api/wishlist
       Body: {book_id: 5, quantity: 2}
       └─► Backend wishlist.py
           ├─ Kiểm tra sách tồn tại ❌ → Error 404
           ├─ Nếu sách đã có trong wishlist:
           │  └─ Update quantity
           ├─ Nếu sách chưa có:
           │  └─ Tạo Wishlist item mới
           ├─ Lưu vào database
           └─► Response: WishlistItemResponse

C. CẬP NHẬT SỐ LƯỢNG (Update Wishlist Item):
   
   PUT /api/wishlist/{book_id}
   Body: {quantity: 5}
   └─► Backend wishlist.py
       ├─ Update item WHERE user_id=current_user.id AND book_id=?
       └─► Response: WishlistItemResponse

D. XÓA KHỎI WISHLIST (Delete from Wishlist):
   
   DELETE /api/wishlist/{book_id}
   └─► Backend wishlist.py
       ├─ Delete WHERE user_id=current_user.id AND book_id=?
       └─► Response: {message: "Xóa thành công"}

```

---

### 4️⃣ **QUẢN LÝ PHIẾU MƯỢN (Borrow Management)**

```
┌─────────────────────────────────────────────────────────────────┐
│            BORROW REQUEST WORKFLOW                              │
└─────────────────────────────────────────────────────────────────┘

STATUS FLOW:
   pending ──► approved ──► returned
       └────► rejected
       └────► need_edit ──► (user cập nhật) ──► pending

A. XEM DANH SÁCH PHIẾU MƯỢN (Get Borrow Requests):
   
   Frontend (user/borrows.html hoặc admin/borrows.html)
   └─► GET /api/borrows?page=1&status_filter=approved
       └─► Backend borrows.py
           ├─ Nếu role == "user":
           │  └─ Lấy phiếu của mình (WHERE user_id = current_user.id)
           ├─ Nếu role == "admin":
           │  └─ Lấy tất cả phiếu (có thể tìm kiếm theo username)
           ├─ Lọc theo status (nếu có)
           ├─ Load relationship: items (+ book chi tiết), user info
           └─► Response: BorrowListResponse (pagination)

B. TẠO PHIẾU MƯỢN (Create Borrow Request):
   
   Frontend (user/dashboard.html - "Mượn sách")
   └─► POST /api/borrows
       Body: {
         note: "Mượn cho đồ án",
         due_date: "2024-04-20",
         items: [
           {book_id: 1, quantity: 1},
           {book_id: 5, quantity: 2}
         ]
       }
       └─► Backend borrows.py
           ├─ Validate due_date >= hôm nay
           ├─ Kiểm tra items hoặc lấy từ wishlist
           ├─ Kiểm tra available_quantity >= quantity ❌ → Error 400
           ├─ Tạo BorrowRequest (status = "pending")
           ├─ Tạo BorrowItem cho mỗi book
           ├─ Giảm available_quantity trong Book
           ├─ Lưu vào database
           └─► Response: BorrowRequestResponse

C. USER CẬP NHẬT PHIẾU (khi status = "need_edit"):
   
   Frontend (user/borrows.html - "Chỉnh sửa")
   └─► PUT /api/borrows/{request_id}
       Body: {
         note: "Mượn lại với ghi chú mới",
         due_date: "2024-04-25",
         items: [{book_id: 1, quantity: 3}]
       }
       └─► Backend borrows.py
           ├─ Kiểm tra status == "need_edit" ❌ → Error 400
           ├─ Khôi phục available_quantity của items cũ
           ├─ Kiểm tra available_quantity mới ❌ → Error 400
           ├─ Cập nhật phiếu (set status = "pending")
           ├─ Cập nhật items
           ├─ Giảm available_quantity mới
           └─► Response: BorrowRequestResponse

D. ADMIN DUYỆT PHIẾU (Approve Borrow):
   
   Frontend (admin/borrows.html - click "Duyệt")
   └─► POST /api/borrows/{request_id}/approve
       Body: {admin_note: "OK, mượn được"}
       └─► Backend borrows.py + get_current_admin
           ├─ Kiểm tra status == "pending" ❌ → Error 400
           ├─ Update status = "approved"
           ├─ Set approved_at = now()
           ├─ Set admin_note
           └─► Response: BorrowRequestResponse

E. ADMIN TỪ CHỐI / YÊU CẦU CHỈNH SỬA (Reject or Require Edit):
   
   Frontend (admin/borrows.html - click "Từ chối" hoặc "Yêu cầu sửa")
   └─► POST /api/borrows/{request_id}/reject
       Body: {
         admin_note: "Yêu cầu thêm thông tin",
         require_edit: true  // true = need_edit, false = rejected
       }
       └─► Backend borrows.py
           ├─ Kiểm tra status == "pending" ❌ → Error 400
           ├─ Khôi phục available_quantity (vì phiếu bị từ chối)
           ├─ Update status = "need_edit" hoặc "rejected"
           ├─ Set admin_note
           └─► Response: BorrowRequestResponse

F. XÁC NHẬN TRẢ SÁCH (Return Books):
   
   Frontend (admin/borrows.html - "Xác nhận trả")
   └─► POST /api/borrows/{request_id}/return
       Body: {admin_note: "Đã nhận đủ sách"}
       └─► Backend borrows.py
           ├─ Kiểm tra status == "approved" ❌ → Error 400
           ├─ Khôi phục available_quantity cho tất cả items
           ├─ Update status = "returned"
           ├─ Set returned_at = now()
           ├─ Xóa items từ wishlist (nếu cùng user)
           └─► Response: BorrowRequestResponse

```

---

### 5️⃣ **CHATBOT AI (RAG System)**

```
┌─────────────────────────────────────────────────────────────────┐
│            CHATBOT FLOW (Retrieval-Augmented Gen)               │
└─────────────────────────────────────────────────────────────────┘

A. TẠO SESSION CHAT:
   
   Frontend (user/chatbot.html)
   └─► POST /api/chatbot/sessions
       Body: {title: "Hỏi về sách Python"}
       └─► Backend chatbot.py
           ├─ Create ChatSession
           ├─ Lưu vào database
           └─► Response: SessionOut (id, title, created_at)

B. GỬI TIN NHẮN & NHẬN PHẢN HỒI:
   
   Frontend (user/chatbot.html - nhập message)
   └─► POST /api/chatbot/sessions/{session_id}/chat
       Body: {message: "Có sách nào về Python không?"}
       └─► Backend chatbot.py
           │
           ├─ 1️⃣ QUERY REWRITING (Viết lại câu hỏi)
           │  └─► Call LLM: "Viết lại câu: Có sách nào về Python không?"
           │      └─► Kết quả: "sách Python, programming Python"
           │
           ├─ 2️⃣ VECTOR SEARCH (Tìm sách liên quan)
           │  ├─ Convert query → vector embedding (Google Gemini)
           │  ├─ Compare với book_embeddings trong MySQL (cosine similarity)
           │  ├─ Lấy top-5 sách phù hợp nhất
           │  └─► BookSource[] (title, author, relevance_score)
           │
           ├─ 3️⃣ CONTEXT COMPRESSION (Nén thông tin)
           │  └─► Tạo context từ top-5 books
           │      Ví dụ:
           │      """
           │      Sách liên quan:
           │      1. Python for Beginners - John Doe (score: 0.95)
           │      2. Advanced Python - Jane Smith (score: 0.92)
           │      """
           │
           ├─ 4️⃣ RE-RANKING (Xếp hạng lại kết quả)
           │  └─► Sắp xếp sách theo độ phù hợp
           │
           ├─ 5️⃣ LLM GENERATION (Sinh câu trả lời)
           │  └─► Call OpenRouter API:
           │      Input: context + message
           │      Output: "Có các sách về Python sau..."
           │
           ├─ 6️⃣ LƯU LỮU SỬ (Save Chat History)
           │  ├─ Save user message
           │  ├─ Save assistant response
           │  └─► Message type: "user" hoặc "assistant"
           │
           └─► Response: ChatResponse
               ├─ answer: "Có các sách về Python sau..."
               ├─ rewritten_query: "sách Python, programming"
               └─ sources: [BookSource1, BookSource2, ...]

C. XEM LỊCH SỬ CHAT:
   
   GET /api/chatbot/sessions/{session_id}
   └─► Response: SessionDetailOut
       ├─ id, title, created_at
       └─ messages: [MessageOut1, MessageOut2, ...]

D. INDEXING BOOKS (Index sách vào vector store):
   
   POST /api/chatbot/index (Admin only)
   └─► Backend chatbot.py
       ├─ Lấy tất cả books
       ├─ Convert mỗi book thành embedding (Google Gemini)
       ├─ Lưu embedding vào book_embeddings table
       └─► Response: {message: "Indexed 150 books"}

```

---

## 📁 **KIẾN TRÚC THƯMỤC - PHẦN NÀO LÀM CÁI NÀY**

```
📦 main.py
├─ Entry point của FastAPI app
├─ Khởi tạo database tables
├─ Mount CORS, static files
└─ Include tất cả routers

📦 app/config.py
├─ Đọc biến môi trường từ .env
├─ Cấu hình database connection string
├─ Cấu hình JWT (secret key, algorithm, expire time)
└─ Cấu hình API keys (Gemini, OpenRouter)

📦 app/database.py
├─ Create SQLAlchemy engine
├─ Create session factory
├─ Define Base ORM class
└─ get_db() dependency

📦 app/models/
├─ user.py → User ORM model (table users)
├─ book.py → Book ORM model (table books)
├─ book_embedding.py → BookEmbedding model (vector store)
├─ wishlist.py → Wishlist ORM model (table wishlist)
├─ borrow.py → BorrowRequest, BorrowItem models
├─ chat.py → ChatSession, ChatMessage models
└─ [Map tới database schema]

📦 app/schemas/
├─ user.py → Pydantic schemas cho user (register, login, response, ...)
├─ book.py → Pydantic schemas cho book
├─ wishlist.py → Pydantic schemas cho wishlist
├─ borrow.py → Pydantic schemas cho borrow (create, approve, reject, ...)
├─ chatbot.py → Pydantic schemas cho chat (request, response, session, ...)
└─ [Validate request, define response format]

📦 app/routers/
├─ auth.py → POST /api/auth/register, login; GET /api/auth/me
├─ books.py → GET /api/books, GET /api/books/{id}, POST (admin), PUT (admin), DELETE (admin)
├─ wishlist.py → GET, POST, PUT, DELETE /api/wishlist/*
├─ borrows.py → GET, POST /api/borrows; POST /approve, /reject, /return
├─ users.py → Admin quản lý users (GET, PUT, DELETE)
├─ chatbot.py → POST /chat, GET /sessions, POST /index, ...
└─ [API endpoints, xử lý requests]

📦 app/services/rag/
├─ pipeline.py → Orchestrate RAG workflow
├─ llm.py → Call OpenRouter LLM
├─ vector_store.py → MySQL vector search
├─ query_rewriter.py → Viết lại query
├─ reranker.py → Xếp hạng kết quả
└─ context_compressor.py → Nén context

📦 app/utils/
├─ auth.py → Hash password, verify password, create JWT, decode JWT
└─ dependencies.py → get_current_user, get_current_admin (dependency injection)

📦 frontend/
├─ index.html → Trang chủ (login/register links)
├─ login.html → Form đăng nhập
├─ register.html → Form đăng ký
├─ admin/ → Trang cho admin
│  ├─ dashboard.html
│  ├─ books.html → Quản lý sách
│  ├─ users.html → Quản lý users
│  └─ borrows.html → Quản lý mượn trả
├─ user/ → Trang cho user
│  ├─ dashboard.html → Trang chủ user
│  ├─ books.html → Xem sách, thêm vào wishlist
│  ├─ borrows.html → Phiếu mượn của mình
│  ├─ wishlist.html → Giỏ mượn
│  └─ chatbot.html → Chat AI
├─ css/style.css → CSS chung
└─ js/
   ├─ api.js → Functions gọi API (fetch requests)
   ├─ auth.js → JWT token management
   └─ app.js → DOM manipulation, UI logic

📦 sql/
└─ init.sql → SQL script tạo tables, insert sample data

📦 scripts/
├─ create_admin_hash.py → Script tạo admin hash
└─ init_data.py → Script import sample data

```

---

## 🔄 **QÚID TRÌNH NGƯỜI DÙNG CỤ THỂ**

### **Scenario 1: User mượn sách**

```
1. Frontend: index.html
   └─► Click "Đăng nhập" → login.html
       └─► Nhập username, password
           └─► Call: POST /api/auth/login
               └─► Response: {access_token: "abc123..."}
                   └─► localStorage.setItem("token", "abc123...")

2. Frontend: Redirect đến user/dashboard.html
   └─► GET /api/auth/me (Header: Bearer abc123...)
       └─► Response: UserResponse (hiển thị tên user)

3. Frontend: Click "Xem sách" → user/books.html
   └─► GET /api/books?page=1
       └─► Response: BookListResponse (danh sách sách)
           └─► Hiển thị sách trên UI

4. Frontend: Tìm kiếm "Python"
   └─► GET /api/books?search=Python
       └─► Response: Sách có "Python" trong tên/tác giả

5. Frontend: Click sách "Python for Beginners" → Xem chi tiết
   └─► GET /api/books/5
       └─► Response: BookResponse (chi tiết)

6. Frontend: Click "Thêm vào giỏ" → books.html
   └─► POST /api/wishlist {book_id: 5, quantity: 2}
       └─► Response: WishlistItemResponse
           └─► Update UI (hiện "Đã thêm vào giỏ")

7. Frontend: Thêm 1-2 sách khác vào wishlist

8. Frontend: Click "Mượn sách" → dashboard.html
   └─► POST /api/borrows
       Body: {
         note: "Mượn cho đồ án",
         due_date: "2024-04-20",
         items: [
           {book_id: 5, quantity: 2},
           {book_id: 10, quantity: 1}
         ]
       }
       └─► Response: BorrowRequestResponse (status: "pending")
           └─► Alert: "Phiếu mượn đã tạo, chờ admin duyệt"

9. Frontend: borrows.html → Xem phiếu của mình
   └─► GET /api/borrows?page=1
       └─► Response: BorrowListResponse (status: "pending")

10. [Admin duyệt phiếu]
    Frontend (Admin): admin/borrows.html
    └─► POST /api/borrows/{request_id}/approve
        └─► Response: BorrowRequestResponse (status: "approved")

11. Frontend: borrows.html (reload)
    └─► GET /api/borrows?page=1
        └─► Response: Status đã thành "approved"
            └─► User nhìn thấy: "Phiếu đã được duyệt"

12. [User trả sách]
    Frontend (Admin): admin/borrows.html
    └─► POST /api/borrows/{request_id}/return
        └─► Response: BorrowRequestResponse (status: "returned")
```

---

### **Scenario 2: User chat với Chatbot AI**

```
1. Frontend: user/chatbot.html
   └─► POST /api/chatbot/sessions
       Body: {title: "Hỏi sách Python"}
       └─► Response: SessionOut (id: 42)

2. Frontend: Nhập câu hỏi "Có sách nào về Python không?"
   └─► POST /api/chatbot/sessions/42/chat
       Body: {message: "Có sách nào về Python không?"}
       └─► Backend:
           ├─ Query Rewriting: "sách Python, programming"
           ├─ Vector Search: Tìm top-5 sách similar
           ├─ LLM Call: Sinh câu trả lời
           └─► Response: ChatResponse
               ├─ answer: "Có 3 sách về Python..."
               ├─ rewritten_query: "sách Python, programming"
               └─ sources: [Book1, Book2, Book3]

3. Frontend: Hiển thị answer và recommend books

4. Frontend: User click vào sách recommended
   └─► POST /api/wishlist {book_id: 8, quantity: 1}
       └─► Thêm vào giỏ mượn

```

---

## 🔐 **AUTHENTICATION & AUTHORIZATION**

```
┌─────────────────────────────────────────┐
│     JWT Token Structure                 │
├─────────────────────────────────────────┤
│ Header: {                               │
│   "alg": "HS256",                      │
│   "typ": "JWT"                         │
│ }                                       │
│                                         │
│ Payload: {                              │
│   "sub": "john_doe",                   │
│   "user_id": 5,                        │
│   "role": "user",                      │
│   "exp": 1712425200  (30 min)          │
│ }                                       │
│                                         │
│ Signature: HMACSHA256(                 │
│   base64(header) + "." +               │
│   base64(payload),                     │
│   secret_key                           │
│ )                                       │
└─────────────────────────────────────────┘

Role-based Access Control:
  - Public: GET /api/books (xem danh sách sách)
  - User: POST /api/borrows, GET /api/wishlist, ...
  - Admin: POST /api/books (thêm sách), GET /api/users (quản lý), ...

get_current_user(token) dependency:
  1. Lấy token từ Authorization header
  2. Decode token → user_id, role
  3. Query database → User object
  4. Return User object

get_current_admin(current_user) dependency:
  1. Verify current_user.role == "admin"
  2. Nếu không → raise HTTPException 403
  3. Return current_user
```

---

## 📊 **DATABASE SCHEMA (Mối quan hệ)**

```
users
├─ id (PK)
├─ username (UNIQUE)
├─ email (UNIQUE)
├─ password_hash
├─ full_name
├─ phone
├─ role (admin/user)
├─ is_active
└─ created_at

books
├─ id (PK)
├─ title
├─ author
├─ isbn (UNIQUE)
├─ category
├─ description
├─ quantity
├─ available_quantity
├─ cover_image
└─ created_at

wishlist (1:N với users, 1:N với books)
├─ id (PK)
├─ user_id (FK → users)
├─ book_id (FK → books)
├─ quantity
└─ added_at

borrow_requests (1:N với users)
├─ id (PK)
├─ user_id (FK → users)
├─ status (pending/approved/rejected/returned/need_edit)
├─ note
├─ admin_note
├─ created_at
├─ approved_at
├─ returned_at
└─ due_date

borrow_items (1:N với borrow_requests, M:1 với books)
├─ id (PK)
├─ borrow_request_id (FK)
├─ book_id (FK → books)
└─ quantity

chat_sessions (1:N với users)
├─ id (PK)
├─ user_id (FK → users)
├─ title
├─ version
├─ created_at
└─ updated_at

chat_messages (1:N với chat_sessions)
├─ id (PK)
├─ session_id (FK → chat_sessions)
├─ sender_type (user/assistant)
├─ content
├─ metadata_
└─ created_at

book_embeddings (vector store)
├─ id (PK)
├─ book_id (FK → books)
├─ embedding (vector 768-dim)
├─ model (Google Gemini)
└─ created_at
```

---

## 🎯 **TÓMT TẮT DÒNG CHẢY**

```
User → Browser → Frontend (HTML/CSS/JS)
                     ↓
                 Call API (HTTP)
                     ↓
Backend (FastAPI) → Validate (Schemas) → Query/Update Database
                     ↓
              Return JSON Response
                     ↓
Frontend → Parse JSON → Update UI → Display to User
```

**Tất cả các API endpoints được bảo vệ bằng JWT token + role-based access control**

---

## 📝 **NOTES**

- **Schemas** là boundary giữa Frontend và Backend (validate data)
- **Models** là mapping tới database tables
- **Routers** là API endpoints
- **Services** là business logic (RAG, LLM calls, ...)
- **Utils** là helper functions (auth, JWT, dependencies)
- **Frontend** là giao diện người dùng (HTML/CSS/JS)

Dòng chảy: **User Action → Frontend → API Call → Backend Validation → Database → Response → Update UI**

