# BACKEND_DEEP_EXPLANATION

## TL;DR

Backend nay la mot he thong quan ly thu vien theo kien truc layer nhe (Router -> DB Model), co JWT auth, role-based authorization (admin/user), va mot module RAG chatbot phuc vu hoi dap sach.

- Core business flow: User dang ky/dang nhap -> xem sach -> them wishlist -> tao phieu muon -> admin duyet/tu choi -> admin xac nhan tra sach.
- Du lieu luu trong MySQL qua SQLAlchemy ORM, table duoc tao tu dong bang `Base.metadata.create_all()` trong `main.py`.
- Validation dau vao chu yeu o Pydantic schemas (`app/schemas/*`), nhung mot so field quantity chua co rang buoc `ge=1`.
- Chatbot dung RAG pipeline (`app/services/rag/pipeline.py`): rewrite query -> vector search (embedding luu trong MySQL) -> rerank -> compress context -> generate answer.
- Kien truc hien tai de hieu cho do an/hoc tap, nhung khi scale can bo sung transaction chuan, migration, logging, retry policy, security hardening.

---

## Muc luc

- [1. Tong quan backend cua du an](#1-tong-quan-backend-cua-du-an)
- [2. Cach khoi dong he thong](#2-cach-khoi-dong-he-thong)
- [3. Ban do thu muc du an](#3-ban-do-thu-muc-du-an)
- [4. Luong request-response day du](#4-luong-request-response-day-du)
- [5. Giai thich tung layerbackend module](#5-giai-thich-tung-layerbackend-module)
- [6. Database va du lieu](#6-database-va-du-lieu)
- [7. Authentication va Authorization](#7-authentication-va-authorization)
- [8. Business logic cot loi](#8-business-logic-cot-loi)
- [9. Error handling logging validation](#9-error-handling-logging-validation)
- [10. Cau hinh bien moi truong secrets](#10-cau-hinh-bien-moi-truong-secrets)
- [11. Background jobs queues cron events](#11-background-jobs-queues-cron-events)
- [12. Tich hop ben thu ba](#12-tich-hop-ben-thu-ba)
- [13. Pattern va quyet dinh thiet ke](#13-pattern-va-quyet-dinh-thiet-ke)
- [14. Diem kho diem nguy hiem technical debt](#14-diem-kho-diem-nguy-hiem-technical-debt)
- [15. Roadmap hoc codebase cho nguoi moi](#15-roadmap-hoc-codebase-cho-nguoi-moi)
- [16. Tom tat nhu cho nguoi xay he thong](#16-tom-tat-nhu-cho-nguoi-xay-he-thong)

---

## 1. Tong quan backend cua du an

### Backend nay dung de lam gi?

Backend phuc vu bai toan **quan ly thu vien online** cho 2 nhom nguoi dung:
- **Admin**: quan ly sach, quan ly user, duyet phieu muon, xac nhan tra sach.
- **User**: tim sach, tao wishlist, gui phieu muon, theo doi trang thai phieu.
- **Chatbot AI**: hoi dap thong tin sach trong thu vien qua RAG.

### Cong nghe chinh

- Framework API: `FastAPI` (`main.py` + `app/routers/*`)
- ORM: `SQLAlchemy` (`app/models/*`, `app/database.py`)
- DB: `MySQL` (xem `sql/init.sql`)
- Auth: JWT + OAuth2 bearer token (`app/utils/auth.py`, `app/utils/dependencies.py`)
- Validation: Pydantic schemas (`app/schemas/*`)
- AI/RAG:
  - Embedding: OpenRouter (`app/services/rag/llm.py`)
  - Text generation: OpenRouter (`app/services/rag/llm.py`)
  - Vector search: embedding luu trong MySQL (`app/services/rag/vector_store.py`)

### Kien truc tong the

Kien truc thuc te la **Layered Architecture don gian**:

`Client -> Router (FastAPI) -> SQLAlchemy Session -> Models -> MySQL`

Voi chatbot:

`Client -> router chatbot -> RAG pipeline service -> LLM + vector store -> DB`

Khong co folder `controllers` hoac `repositories` rieng: routers dang vua xu ly endpoint vua chua business logic muc vua.

### 4 goc nhin (What / Why / How / Risk)

- **What**: he thong API CRUD + workflow muon/tra + chatbot.
- **Why**: giai quyet nghiep vu thu vien voi effort ngan gon cho do an.
- **How**: FastAPI dependency injection cho auth + db session; ORM query truc tiep trong routers.
- **Risk**: coupling cao o router, kho mo rong khi business logic phuc tap hon.

---

## 2. Cach khoi dong he thong

### Entry point

- File entry point: `main.py`
- Uvicorn run app: `uvicorn main:app --reload` (theo `README.md`)

### Trinh tu khoi dong (theo code)

1. Import `engine`, `Base` tu `app/database.py`.
2. Import routers tu `app/routers/__init__.py`.
3. Goi `Base.metadata.create_all(bind=engine)` ngay khi import `main.py`.
4. Tao `FastAPI(...)` app instance.
5. Dang ky `CORSMiddleware`.
6. Mount static frontend: `app.mount("/static", StaticFiles(directory="frontend"), ...)`.
7. `include_router(...)` cho auth/books/users/wishlist/borrows/chatbot.
8. Define endpoint `/` va `/health`.

### Env/config load ra sao?

- `app/config.py` goi `load_dotenv()` ngay khi module duoc import.
- `Settings` doc bien moi truong DB/JWT/AI.
- `DATABASE_URL` duoc build dong qua property.

### Ket noi DB khi nao?

- Engine duoc tao khi import `app/database.py`.
- Session duoc tao theo request qua dependency `get_db()`.
- Table duoc tao ngay startup (`create_all`) thay vi migration.

### Middleware dang ky khi nao?

- Chi co CORS middleware trong `main.py`.
- Chua thay custom middleware logging/request-id.

### 4 goc nhin

- **What**: startup dong bo, don gian.
- **Why**: nhanh de chay local.
- **How**: import-time side effect (`create_all`).
- **Risk**: production startup co the kho kiem soat schema drift, thieu migration chinh quy.

---

## 3. Ban do thu muc du an

### Thu muc/file backend quan trong

- `main.py` (**RAT QUAN TRONG**): app bootstrap + router mount.
- `app/config.py` (**RAT QUAN TRONG**): toan bo settings env.
- `app/database.py` (**RAT QUAN TRONG**): engine/session/base.
- `app/models/*` (**RAT QUAN TRONG**): ORM entities va relation.
- `app/schemas/*`: input/output contract.
- `app/routers/*` (**RAT QUAN TRONG**): endpoint + phan lon business logic.
- `app/utils/auth.py`: hash password, tao/giai ma JWT.
- `app/utils/dependencies.py` (**RAT QUAN TRONG**): auth dependency + role gate.
- `app/services/rag/*` (**RAT QUAN TRONG cho chatbot**): pipeline AI.
- `sql/init.sql`: schema SQL tay.
- `scripts/init_data.py`: seed du lieu + tao embeddings.

### Nguoi moi nen doc theo thu tu nao?

1. `main.py`
2. `app/config.py`
3. `app/database.py`
4. `app/models/user.py`, `app/models/book.py`, `app/models/borrow.py`, `app/models/wishlist.py`, `app/models/chat.py`
5. `app/schemas/*`
6. `app/utils/auth.py` va `app/utils/dependencies.py`
7. `app/routers/auth.py`
8. `app/routers/books.py`, `app/routers/wishlist.py`, `app/routers/borrows.py`, `app/routers/users.py`
9. `app/routers/chatbot.py`
10. `app/services/rag/pipeline.py` va cac file RAG con lai

### 4 goc nhin

- **What**: thu muc chia theo technical concern (models/schemas/routers/services).
- **Why**: de hoc, de tim file.
- **How**: khong tach repository/service cho module CRUD.
- **Risk**: logic trai dai o routers, kho test don vi.

---

## 4. Luong request-response day du

### 4.1 Flow dang nhap (Auth)

Text flow:

`Client -> /api/auth/login -> OAuth2PasswordRequestForm parse -> query User -> verify bcrypt -> create JWT -> response token`

Code:
- Route: `app/routers/auth.py::login`
- Hash/token util: `app/utils/auth.py`

Sample request:
```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user1&password=user123
```

Sample response:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

Validation/auth/business/db:
- Validation: form username/password (OAuth2 form parser).
- Auth requirement: none (public).
- Business rule: user phai ton tai, mat khau dung, account `is_active=True`.
- DB impact: read `users`.

4 goc nhin:
- **What**: cap token cho client.
- **Why**: tach auth theo bearer token khong can session state server.
- **How**: JWT payload chua `user_id`, `role`, `sub`.
- **Risk**: khong co refresh token/revocation list.

### 4.2 Flow tao phieu muon tu wishlist

Text flow:

`Client -> /api/borrows POST -> get_current_user -> read wishlist/items -> create borrow_requests + borrow_items -> delete wishlist (neu tao tu wishlist) -> commit -> response`

Code:
- Route: `app/routers/borrows.py::create_borrow_request`
- Models lien quan: `BorrowRequest`, `BorrowItem`, `Wishlist`, `Book`

Sample request:
```http
POST /api/borrows
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "note": "Muon de hoc mon Python",
  "due_date": "2026-04-10"
}
```

Sample response (rut gon):
```json
{
  "id": 12,
  "user_id": 5,
  "status": "pending",
  "due_date": "2026-04-10",
  "items": [
    {"book_id": 1, "quantity": 2, "book": {"title": "Lap trinh Python co ban"}}
  ]
}
```

Validation/auth/business/db:
- Validation: `BorrowRequestCreate` yeu cau `due_date`; `items` optional.
- Auth: bat buoc logged-in (`get_current_user`).
- Business rule:
  - Neu payload co `items` -> lay tu payload.
  - Neu khong -> doc tu `wishlist` user.
  - Wishlist rong -> 400.
- DB impact:
  - Insert `borrow_requests`
  - Insert nhieu `borrow_items`
  - Delete `wishlist` (trong nhanh tao tu wishlist)

4 goc nhin:
- **What**: tao request muon chua phe duyet.
- **Why**: tich hop gio muon voi quy trinh duyet admin.
- **How**: dung `db.flush()` de lay `borrow_request.id` truoc khi tao item.
- **Risk**: khong check available quantity ngay buoc tao; check de den buoc approve.

### 4.3 Flow admin duyet phieu muon

Text flow:

`Client(admin) -> /api/borrows/{id}/approve -> get_current_admin -> load borrow request + items -> validate stock -> decrement books.available_quantity -> set approved -> commit -> response`

Code: `app/routers/borrows.py::approve_borrow_request`

Business rule:
- Chi duyet khi status `pending`.
- Tung item phai du stock (`available_quantity >= quantity`).
- Sau duyet moi tru kho.

DB impact:
- Update `books.available_quantity` (nhieu dong)
- Update `borrow_requests.status`, `approved_at`, `admin_note`

Risk chinh:
- Khong co transaction lock/SELECT FOR UPDATE -> concurrency risk oversell neu 2 admin duyet gan dong thoi.

### 4.4 Flow chat RAG

Text flow:

`Client -> /api/chatbot/sessions/{id}/chat -> auth -> load recent messages -> save user message -> pipeline.chat() -> save assistant message + metadata -> commit -> response`

RAG sub-flow trong `app/services/rag/pipeline.py`:

`query -> rewrite -> vector_store.search -> rerank -> compress -> llm.generate_text(answer)`

Sample request:
```http
POST /api/chatbot/sessions/3/chat
Authorization: Bearer <jwt>
Content-Type: application/json

{"message":"Co sach nao ve tri tue nhan tao khong?"}
```

Sample response:
```json
{
  "answer": "Thu vien hien co ...",
  "rewritten_query": "tim sach Tri tue nhan tao ...",
  "sources": [
    {
      "book_id": 8,
      "title": "Tri tue nhan tao",
      "available_quantity": 6,
      "relevance_score": 9
    }
  ]
}
```

4 goc nhin:
- **What**: tro ly hoi dap thong tin sach co context retrieval.
- **Why**: giam hallucination so voi chat thuong.
- **How**: embedding luu SQL + cosine similarity bang NumPy + LLM rerank/compress.
- **Risk**: phu thuoc API quota ben ngoai; khi loi thi 503/500.

---

## 5. Giai thich tung layer/backend module

### 5.1 Routes (`app/routers/*`)

- **Vai tro**: dinh nghia endpoint, xu ly request/response, auth gate, va dang chua business logic.
- **Input/Output**: nhan Pydantic schema/form/query params, tra schema response.
- **Quan he**: goi truc tiep SQLAlchemy session + models; chatbot route goi service RAG.

4 goc nhin:
- **What**: API orchestration layer.
- **Why**: FastAPI de khai bao endpoint nhanh.
- **How**: `Depends(get_db)`, `Depends(get_current_user/admin)`.
- **Risk**: router qua day logic de test/moc.

### 5.2 Controllers

- **Hien trang**: khong co layer controller rieng.
- **Anh huong**: router dong vai controller.

### 5.3 Services

- Co service ro net cho chatbot: `app/services/rag/*`.
- CRUD nghiep vu thu vien chua co service rieng (nam trong router).

`pipeline.chat`:
- Input: `db`, `query`, `chat_history`.
- Output: dict (`answer`, `rewritten_query`, `sources`, `debug`).
- Dependency: `llm`, `vector_store`, `rewrite`, `rerank`, `compress`.
- Side effects: goi external API.
- Assumption: da index embeddings va da co API keys.
- Edge cases: ket qua tim kiem rong -> compressor tra thong diep fallback.

### 5.4 Repository/Data access

- Khong co repository layer rieng.
- Query viet trong routers va vector store.
- Uu diem: de lan dau hoc.
- Nhuoc diem: kho tai su dung, kho mock khi test.

### 5.5 Models/Entities (`app/models/*`)

- `User`: account + role + active flag.
- `Book`: inventory state (`quantity`, `available_quantity`).
- `Wishlist`: cart tam user-book.
- `BorrowRequest` + `BorrowItem`: workflow muon-tra.
- `ChatSession` + `ChatMessage`: luu hoi thoai chatbot.
- `BookEmbedding`: vector data cho RAG.

### 5.6 Middleware

- Chi co `CORSMiddleware` trong `main.py`.
- Chua co middleware custom cho logging/tracing/error envelope.

### 5.7 Validators / DTO / Schemas

- Toan bo schema trong `app/schemas/*`.
- `from_attributes = True` cho ORM serialization.
- Diem can bo sung: rang buoc so luong (`ge=1`) cho quantity fields.

### 5.8 Utils/Helpers

- `app/utils/auth.py`: bcrypt + JWT encode/decode.
- `app/utils/dependencies.py`: attach user identity vao flow qua dependency.

### 5.9 Config

- `app/config.py`: bien moi truong DB/JWT/API keys/model.

### 5.10 Jobs/Queues/Events

- Khong co queue/event bus/cron chinh thuc.
- Chi co script async tao embedding: `scripts/init_data.py::create_embeddings`.

---

## 6. Database va du lieu

### Dung database gi?

- MySQL (`sql/init.sql`, `app/config.py`)

### Ket noi o dau?

- `app/database.py`:
  - `engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)`
  - `SessionLocal = sessionmaker(...)`
  - dependency `get_db()`

### Schema du lieu chinh

- `users`
- `books`
- `wishlist`
- `borrow_requests`
- `borrow_items`
- (them qua ORM) `chat_sessions`, `chat_messages`, `book_embeddings`

Luu y quan trong:
- `sql/init.sql` chua tao `chat_sessions`, `chat_messages`, `book_embeddings`.
- Cac bang nay duoc ky vong tao boi `Base.metadata.create_all()` khi app startup.

### Quan he

- `users 1-N wishlist`
- `books 1-N wishlist`
- `users 1-N borrow_requests`
- `borrow_requests 1-N borrow_items`
- `books 1-N borrow_items`
- `users 1-N chat_sessions`
- `chat_sessions 1-N chat_messages`
- `books 1-1 book_embeddings`

### Query viet o dau?

- CRUD nghiep vu: `app/routers/*`
- Vector retrieval: `app/services/rag/vector_store.py`

### Migration

- Chua dung Alembic migration.
- Dang dung `create_all` + SQL script tay.

### Transaction boundary

- Theo tung endpoint (`db.commit()` trong router).
- Chua thay explicit transaction block cho flow nhieu update quan trong (approve/return borrow).

### Concurrency/performance risk

- Approve borrow co race condition kho sach (check truoc, tru sau, khong lock row).
- Vector search load tat ca embeddings vao RAM (`db.query(BookEmbedding).all()`), scale lon se nang.
- Potential N+1 da giam mot phan nho `joinedload` trong borrow/wishlist.

### Business rule encode trong DB/model

- Unique: `users.username`, `users.email`, `books.isbn`, wishlist unique `(user_id, book_id)`.
- Enum status/role trong model.
- Chua co check constraint non-negative cho `quantity/available_quantity`.

### 4 goc nhin

- **What**: relational model phan anh workflow thu vien.
- **Why**: de truy van relation va bao toan tinh toan ven co ban.
- **How**: SQLAlchemy relation + FK + indexes.
- **Risk**: schema evolution kho khong co migration.

---

## 7. Authentication va Authorization

### Login theo kieu nao?

- JWT Bearer token.
- Login endpoint: `app/routers/auth.py::login`.

### Token tao/verify o dau?

- Tao: `app/utils/auth.py::create_access_token`
- Verify/decode: `app/utils/auth.py::decode_token`

### User identity attach vao request ra sao?

- Dependency `get_current_user` trong `app/utils/dependencies.py`:
  1. Lay token qua `OAuth2PasswordBearer`.
  2. Decode token.
  3. Lay `user_id` tu payload.
  4. Query `User`.
  5. Check `is_active`.
  6. Return `User` object cho router.

### Phan quyen

- `get_current_admin`: reject neu role khac `admin`.
- Cac route admin-only: create/update/delete books; users management; approve/reject/return borrow.

### Middleware/auth theo thu tu chay thuc

`Request -> OAuth2 token extractor -> decode_token -> DB lookup user -> role check (neu can) -> route logic`

### Request object mutate?

- Khong mutate truc tiep `request.state`.
- User duoc truyen qua DI parameter `current_user`.

### Dieu kien reject

- Token invalid/het han -> 401.
- User khong ton tai/bi disable -> 401/403.
- Khong du role -> 403.

### Lo hong/diem can chu y

- `SECRET_KEY` default rat yeu (`your-secret-key`) neu quen set env.
- Khong co refresh token/rotation/revocation.
- `allow_origins=["*"]` + `allow_credentials=True` trong CORS la cau hinh nguy hiem cho production.
- `get_optional_user` dung `OAuth2PasswordBearer` mac dinh (`auto_error=True`) nen khong thuc su optional.

### 4 goc nhin

- **What**: JWT-based stateless auth + role check.
- **Why**: don gian, phu hop SPA frontend.
- **How**: dependency chain, khong can session storage.
- **Risk**: security hardening chua day du cho production.

---

## 8. Business logic cot loi

### Nghiep vu quan trong nhat

1. Quan ly inventory sach (`books.quantity` va `books.available_quantity`).
2. Workflow phieu muon co trang thai (`pending -> approved/rejected/need_edit -> returned`).
3. Gio muon (wishlist) la bo dem truoc khi tao phieu.
4. Chatbot RAG tra loi dua tren sach trong DB.

### "Trai tim" cua he thong

- `app/routers/borrows.py` la trai tim nghiep vu thu vien (state machine muon-tra).
- `app/services/rag/pipeline.py` la trai tim AI.

### Rule de gay bug neu sua sai

- Logic cap nhat `available_quantity` trong:
  - `books.update_book`
  - `borrows.approve_borrow_request`
  - `borrows.return_books`
- Rule status cho phep update/delete borrow request.
- Logic xoa wishlist sau khi tao borrow request.

### Flow can hieu dau tien

1. Login/auth flow.
2. Wishlist -> Borrow request creation.
3. Admin approve/reject/return.
4. Chatbot session + chat pipeline.

### 4 goc nhin

- **What**: workflow muon-tra theo trang thai + inventory.
- **Why**: dam bao sach co han va co quy trinh xac nhan.
- **How**: enum status + check truoc commit.
- **Risk**: thieu lock transaction de tranh tranh chap so luong.

---

## 9. Error handling, logging, validation

### Validation o dau?

- Pydantic schema: `app/schemas/*`.
- FastAPI Query constraints: vi du `page>=1`, `page_size<=100` trong routers.

Diem con thieu:
- quantity field nhieu noi chua co `ge=1` (wishlist, borrow item, book quantity).

### Error throw/catch

- Phan lon endpoint dung `raise HTTPException(...)` voi status code ro rang.
- Chatbot route co `try/except` cho `QuotaExceededException` (503) va error khac (500).
- Khong co global exception handler custom.

### Logging

- Chua thay logging framework duoc setup (khong co `logging` config trong backend).

### Diem yeu de kho debug

- Khong co structured log / correlation id.
- Khong co metric/trace cho tung buoc RAG.
- Error detail chatbot co the expose message noi bo (`str(e)`).

### 4 goc nhin

- **What**: xu ly loi bang HTTPException + validation schema.
- **Why**: de hieu va nhanh cho do an.
- **How**: throw truc tiep tai diem phat hien loi.
- **Risk**: khong co observability khi loi production.

---

## 10. Cau hinh, bien moi truong, secrets

### Bien moi truong quan trong (`app/config.py`)

- DB: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- JWT: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- AI: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_EMBEDDING_MODEL`

### Anh huong den he thong

- Thieu/ sai DB config -> khong ket noi duoc DB.
- `SECRET_KEY` yeu -> token de bi forge.
- Thieu `OPENROUTER_API_KEY` -> chatbot chat/index fail (500).
- Thieu `OPENROUTER_EMBEDDING_MODEL` -> embedding fail khi index/search vector.

### File cau hinh quan trong

- `app/config.py`
- `.env` (duoc nhac trong `README.md`)

### 4 goc nhin

- **What**: central config object `settings`.
- **Why**: tach secret khoi code.
- **How**: `load_dotenv` + `os.getenv` + defaults.
- **Risk**: default values co the nguy hiem neu deploy ma quen set env.

---

## 11. Background jobs, queues, cron, events

### Hien trang

- Khong co queue worker/cron scheduler/event bus.
- Co script ngoai luong de seed va index embedding: `scripts/init_data.py`.

### Chay khi nao, ai trigger?

- Trigger thu cong bang command line.
- Khong auto trigger theo event DB.

### Retry/failure

- Trong RAG embedding co retry/backoff o `app/services/rag/llm.py::_embedding_with_retry`.
- Script init_data bat exception va in loi.

### Tai sao khong async out-of-request?

- Hien tai index qua endpoint `/api/chatbot/index` thuc thi trong request cycle.
- Neu DB lon, endpoint co the timeout; ve sau nen tach sang job queue.

### 4 goc nhin

- **What**: chua co nen tang background processing dung nghia.
- **Why**: giam do phuc tap he thong.
- **How**: xu ly truc tiep trong request/script.
- **Risk**: tac vu nang gay cham API.

---

## 12. Tich hop ben thu ba

### Ngoai API nao duoc goi?

- OpenRouter embeddings API trong `app/services/rag/llm.py`.
- OpenRouter chat completion API (`AsyncOpenAI` voi `base_url` OpenRouter) trong `app/services/rag/llm.py`.

### Wrapper external service

- `app/services/rag/llm.py` dong vai tro adapter/wrapper.

### External fail thi sao?

- Embedding rate limit -> retry exponential backoff -> neu van fail, raise `QuotaExceededException`.
- Chatbot router catch `QuotaExceededException` -> HTTP 503.
- Loi khac -> HTTP 500.

### Webhook

- Khong thay webhook endpoint trong codebase.

### 4 goc nhin

- **What**: tich hop 2 nha cung cap AI.
- **Why**: phan tach embedding va generation.
- **How**: SDK clients khoi tao global.
- **Risk**: dependency ben ngoai lam he thong chat bat on khi quota/latency xau.

---

## 13. Nhung pattern va quyet dinh thiet ke

### Pattern dang dung

- **Layered architecture** (nhung compress): routers + models + schemas + utils + services.
- **Dependency Injection** qua FastAPI `Depends`.
- **Gateway/Adapter** cho external LLM (`llm.py`).
- **State machine don gian** cho borrow status (enum + transition checks).

### Vi sao co the tac gia chon cach nay?

- Uu tien de hoc, de demo, de bo tri theo feature ky thuat.
- FastAPI + SQLAlchemy la stack than thien cho mon hoc/du an vua.
- RAG tich hop de tang diem AI cho do an.

### Uu diem

- Nhanh phat trien.
- Code de doc voi nguoi moi.
- Swagger docs tu dong.

### Nhuoc diem

- Router bi over-responsibility.
- Chua co migration, logging, test automation ro rang.
- Khong co abstraction repository/service cho domain CRUD.

### Neu scale lon can refactor gi?

1. Tach service layer cho books/borrows/users.
2. Tach repository layer, unit test theo layer.
3. Them Alembic migration.
4. Them transaction lock cho inventory.
5. Them background worker cho index/chat tasks nang.
6. Them structured logging + tracing + metrics.

### 4 goc nhin

- **What**: architecture practical-first.
- **Why**: phu hop muc tieu hoc tap/prototype.
- **How**: giam abstraction ban dau.
- **Risk**: technical debt tang nhanh khi them feature.

---

## 14. Nhung diem kho, diem nguy hiem, technical debt

### Danh sach uu tien cao

1. **Race condition inventory** o `app/routers/borrows.py::approve_borrow_request`.
2. **Khong migration** (chi `create_all`) -> kho quan ly schema thay doi.
3. **CORS production risk** trong `main.py` (`allow_origins=["*"]` + credentials).
4. **JWT secret default yeu** trong `app/config.py`.
5. **Validation quantity chua chat** trong `app/schemas/borrow.py`, `app/schemas/wishlist.py`, `app/schemas/book.py`.
6. **No global logging/exception layer**.
7. **Vector search full scan** trong `app/services/rag/vector_store.py`.
8. **API contract drift**:
   - `frontend/js/api.js` goi `/api/chatbot/chat` va gui `chat_history`.
   - Backend thuc te dung `/api/chatbot/sessions/{id}/chat` voi payload `ChatRequest` chi co `message`.

### Code smell/coupling cao

- Routers query DB va xu ly business mixed.
- Chatbot status dung cac field `openrouter_configured`, `openrouter_model_configured`, `openrouter_embedding_model_configured` trong `app/routers/chatbot.py::chatbot_status`.

### Luu y chua the xac nhan 100%

- Toi chua the xac nhan hoan toan ve behavior production deployment (gunicorn workers, reverse proxy, TLS) vi codebase khong co file deployment.
- Gia thuyet hop ly nhat: he thong dang duoc thiet ke uu tien local/dev.
- Can kiem tra them file CI/CD hoặc Docker (khong thay trong workspace hien tai).

---

## 15. Cach toi nen hoc codebase nay (roadmap cu the)

### Ngay 1: hieu bo cuc va startup

- Doc `main.py`, `app/config.py`, `app/database.py`.
- Chay app va mo `/docs`.
- Dat breakpoint:
  - `main.py` (sau `app = FastAPI(...)`)
  - `app/database.py::get_db`

Muc tieu: hieu app boot, DI, DB session life cycle.

### Ngay 2: auth + user

- Doc `app/utils/auth.py`, `app/utils/dependencies.py`, `app/routers/auth.py`.
- Thu API:
  - register
  - login
  - /me
- Breakpoint:
  - `decode_token`
  - `get_current_user`

Muc tieu: hieu identity duoc attach vao request nhu the nao.

### Ngay 3: books + wishlist

- Doc `app/models/book.py`, `app/models/wishlist.py`, `app/routers/books.py`, `app/routers/wishlist.py`.
- Thu flow user:
  1. get books
  2. add wishlist
  3. update wishlist

Muc tieu: hieu inventory data va user cart.

### Ngay 4: borrow workflow (quan trong nhat)

- Doc ky `app/models/borrow.py` + `app/routers/borrows.py`.
- Thu 2 role user/admin voi chuoi day du:
  1. user tao phieu
  2. admin duyet
  3. admin tra sach
- Breakpoint:
  - `create_borrow_request`
  - `approve_borrow_request`
  - `return_books`

Muc tieu: hieu state transition + DB write impact.

### Ngay 5: chatbot RAG

- Doc `app/routers/chatbot.py` -> `app/services/rag/pipeline.py` -> `llm.py` -> `vector_store.py` -> `reranker.py` -> `context_compressor.py`.
- Thu:
  - tao session
  - chat
  - index
  - status
- Breakpoint:
  - `pipeline.chat`
  - `vector_store.search`
  - `llm.generate_text`

Muc tieu: hieu pipeline va cac diem fail external API.

### Ngay 6-7: sua thu de hieu sau hon

Nen sua thu (an toan):
1. Them `ge=1` cho quantity schema.
2. Them logging co ban trong 1 router.
3. Tach 1 ham business nho trong `borrows.py` thanh service.

Neu lam duoc 3 muc nay, ban da di tu "doc code" sang "lam chu code".

---

## 16. Tom tat nhu cho nguoi xay he thong

Neu coi ban la nguoi tao backend nay, ban can nam chac it nhat 16 diem sau:

1. App start tu `main.py`; router va middleware duoc mount tai day.
2. DB session lifecycle di qua `get_db()`; moi request co session rieng.
3. Auth la JWT bearer, user identity do dependency `get_current_user` cap.
4. Role `admin/user` quyet dinh kha nang truy cap endpoint quan tri.
5. Inventory dung 2 field: `quantity` va `available_quantity`.
6. Borrow workflow la state machine (`pending/approved/rejected/need_edit/returned`).
7. Approve borrow la diem can than nhat vi anh huong truc tiep ton kho.
8. Wishlist la buoc trung gian truoc khi tao borrow request.
9. Validation chinh nam trong Pydantic schema, nhung con thieu rang buoc so luong.
10. Error handling hien tai theo endpoint, chua co global handler/logging strategy.
11. Schema DB dang quan ly boi `create_all` + SQL script, chua co migration.
12. Chatbot luu session va message vao DB, co metadata source/rewrite.
13. RAG pipeline 5 buoc la trung tam module AI.
14. Vector store hien tai full-scan embeddings trong MySQL (de nhung chua scale).
15. External AI key/quota quyet dinh chatbot co hoat dong on dinh khong.
16. Neu viet lai de scale: tach service/repository, bo sung migration, logging, queue, transaction lock.

---

## Appendix: API flow map tong hop

### A. Sach

`Client -> /api/books -> (public/admin check neu write) -> Book ORM -> MySQL -> response`

### B. Wishlist

`Client(user) -> /api/wishlist -> get_current_user -> Wishlist ORM (+Book joinedload) -> MySQL -> response`

### C. Borrow

`Client(user/admin) -> /api/borrows -> auth/role gate -> BorrowRequest/BorrowItem/Book/Wishlist ORM -> MySQL -> response`

### D. Chatbot

`Client(user) -> /api/chatbot/sessions/{id}/chat -> auth -> DB history -> RAG pipeline -> OpenRouter chat/embeddings + MySQL embeddings -> save message -> response`

---

## Ket luan mentor-style

Nguoi viet code nay dang giai quyet bai toan "thu vien co workflow muon-tra + them AI hoi dap" bang cach practical: tan dung FastAPI va SQLAlchemy truc tiep, uu tien chay duoc nhanh va de hieu.

Neu ban phai viet lai tu dau cho production-scale, huong thiet ke hop ly la:
- Giu nguyen domain model (User/Book/Borrow/Wishlist/Chat),
- Tach ro application service va repository,
- Su dung migration + transaction strategy + optimistic/pessimistic locking,
- Them observability day du,
- Day chatbot indexing sang asynchronous job queue.

Do la buoc chuyen tu "project hoc tap tot" sang "he thong san sang van hanh that".

