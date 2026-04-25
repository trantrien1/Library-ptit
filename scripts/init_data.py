"""
Script khởi tạo dữ liệu mẫu cho database.
Chạy script này sau khi đã tạo database và cấu hình .env

Usage:
    python scripts/init_data.py
"""
import sys
import os
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import inspect, text

# Thêm thư mục gốc vào path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.database_schema import ensure_database_schema
from app.models.user import User, UserRole
from app.models.book import Book
from app.models.platform import (
    BookingResource,
    ChallengeParticipant,
    DigitalResource,
    DiscussionGroup,
    DiscussionGroupMember,
    DiscussionPost,
    DiscussionPostComment,
    DiscussionPostReaction,
    DiscussionPostSave,
    Event,
    EventRegistration,
    Lab,
    LabBooking,
    LibrarianQuestion,
    NewsPost,
    PrintJob,
    ReadingChallenge,
    Recommendation,
    Tutorial,
    UserBadge,
    VolunteerDonation,
    VolunteerProgram,
)
from app.utils.auth import get_password_hash


BOOK_COVER_IMAGES = {
    "Lập trình Python cơ bản": "/ChatGPT Image 20_47_27 25 thg 4, 2026 (1).png",
    "Cấu trúc dữ liệu và giải thuật": "/ChatGPT Image 20_47_27 25 thg 4, 2026 (2).png",
    "Mạng máy tính": "/ChatGPT Image 20_47_27 25 thg 4, 2026 (3).png",
    "Cơ sở dữ liệu": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (4).png",
    "Toán cao cấp A1": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (5).png",
    "Vật lý đại cương": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (6).png",
    "Lập trình Web với HTML/CSS/JavaScript": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (7).png",
    "Trí tuệ nhân tạo": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (8).png",
    "Tiếng Anh chuyên ngành CNTT": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (9).png",
    "Kinh tế vĩ mô": "/ChatGPT Image 20_47_28 25 thg 4, 2026 (10).png",
}


def update_sample_book_covers(db):
    updated = 0
    for title, cover_image in BOOK_COVER_IMAGES.items():
        book = db.query(Book).filter(Book.title == title).first()
        if book and book.cover_image != cover_image:
            book.cover_image = cover_image
            updated += 1
    if updated:
        db.commit()
        print(f"✅ Đã cập nhật ảnh bìa cho {updated} cuốn sách mẫu")
    return updated
from app.services.rag import vector_store

def ensure_legacy_columns():
    """Patch columns that may be missing in older databases."""
    inspector = inspect(engine)
    required_columns = {
        "books": {
            "pdf_file": "ALTER TABLE books ADD COLUMN pdf_file VARCHAR(255) NULL"
        },
        "borrow_requests": {
            "renewal_count": (
                "ALTER TABLE borrow_requests "
                "ADD COLUMN renewal_count INT NOT NULL DEFAULT 0"
            )
        },
        "discussion_groups": {
            "requires_approval": "ALTER TABLE discussion_groups ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE",
            "status": "ALTER TABLE discussion_groups ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
            "rules": "ALTER TABLE discussion_groups ADD COLUMN rules TEXT",
        },
        "discussion_posts": {
            "tags": "ALTER TABLE discussion_posts ADD COLUMN tags VARCHAR(255) NULL",
            "status": "ALTER TABLE discussion_posts ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
        },
        "discussion_group_members": {
            "status": "ALTER TABLE discussion_group_members ADD COLUMN status VARCHAR(40) DEFAULT 'approved'",
        },
        "discussion_post_comments": {
            "status": "ALTER TABLE discussion_post_comments ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
        },
        "library_events": {
            "speaker": "ALTER TABLE library_events ADD COLUMN speaker VARCHAR(160) NULL",
            "format": "ALTER TABLE library_events ADD COLUMN format VARCHAR(40) DEFAULT 'offline'",
            "online_link": "ALTER TABLE library_events ADD COLUMN online_link VARCHAR(500) NULL",
            "capacity": "ALTER TABLE library_events ADD COLUMN capacity INT NOT NULL DEFAULT 40",
            "registration_deadline": "ALTER TABLE library_events ADD COLUMN registration_deadline DATETIME NULL",
            "status": "ALTER TABLE library_events ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'open'",
            "tags": "ALTER TABLE library_events ADD COLUMN tags VARCHAR(255) NULL",
            "thumbnail": "ALTER TABLE library_events ADD COLUMN thumbnail VARCHAR(500) NULL",
            "materials": "ALTER TABLE library_events ADD COLUMN materials TEXT",
            "require_checkin": "ALTER TABLE library_events ADD COLUMN require_checkin BOOLEAN DEFAULT TRUE",
            "created_by": "ALTER TABLE library_events ADD COLUMN created_by INT NULL",
            "updated_at": "ALTER TABLE library_events ADD COLUMN updated_at TIMESTAMP NULL",
        },
        "library_tutorials": {
            "video_url": "ALTER TABLE library_tutorials ADD COLUMN video_url VARCHAR(500) NULL",
            "thumbnail": "ALTER TABLE library_tutorials ADD COLUMN thumbnail VARCHAR(500) NULL",
            "topic": "ALTER TABLE library_tutorials ADD COLUMN topic VARCHAR(120) NULL",
            "level": "ALTER TABLE library_tutorials ADD COLUMN level VARCHAR(40) DEFAULT 'beginner'",
            "view_count": "ALTER TABLE library_tutorials ADD COLUMN view_count INT NOT NULL DEFAULT 0",
            "is_featured": "ALTER TABLE library_tutorials ADD COLUMN is_featured BOOLEAN DEFAULT FALSE",
            "status": "ALTER TABLE library_tutorials ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'published'",
            "attachments": "ALTER TABLE library_tutorials ADD COLUMN attachments TEXT",
            "created_by": "ALTER TABLE library_tutorials ADD COLUMN created_by INT NULL",
            "updated_at": "ALTER TABLE library_tutorials ADD COLUMN updated_at TIMESTAMP NULL",
        },
        "library_news": {
            "news_type": "ALTER TABLE library_news ADD COLUMN news_type VARCHAR(40) DEFAULT 'announcement'",
            "summary": "ALTER TABLE library_news ADD COLUMN summary TEXT",
            "status": "ALTER TABLE library_news ADD COLUMN status VARCHAR(40) DEFAULT 'published'",
            "related_target_type": "ALTER TABLE library_news ADD COLUMN related_target_type VARCHAR(40) DEFAULT 'none'",
            "related_target_id": "ALTER TABLE library_news ADD COLUMN related_target_id INT NULL",
            "cta_label": "ALTER TABLE library_news ADD COLUMN cta_label VARCHAR(120) NULL",
            "cta_url": "ALTER TABLE library_news ADD COLUMN cta_url VARCHAR(500) NULL",
            "updated_at": "ALTER TABLE library_news ADD COLUMN updated_at TIMESTAMP NULL",
        },
        "library_feedback": {
            "priority": "ALTER TABLE library_feedback ADD COLUMN priority VARCHAR(40) DEFAULT 'normal'",
            "updated_at": "ALTER TABLE library_feedback ADD COLUMN updated_at TIMESTAMP NULL",
        },
        "volunteer_donations": {
            "title": "ALTER TABLE volunteer_donations ADD COLUMN title VARCHAR(180) NULL",
            "contact_info": "ALTER TABLE volunteer_donations ADD COLUMN contact_info VARCHAR(180) NULL",
            "updated_at": "ALTER TABLE volunteer_donations ADD COLUMN updated_at TIMESTAMP NULL",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in required_columns.items():
            try:
                existing_columns = {
                    column["name"] for column in inspector.get_columns(table_name)
                }
            except Exception:
                continue

            for column_name, ddl in columns.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(ddl))
                print(f"Updated schema: {table_name}.{column_name}")

def init_database():
    """Tạo tất cả tables"""
    ensure_database_schema(engine)
    ensure_legacy_columns()
    print("✅ Đã tạo các tables trong database")

def create_admin():
    """Tạo tài khoản admin mặc định"""
    db = SessionLocal()
    try:
        # Kiểm tra admin đã tồn tại chưa
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("ℹ️ Tài khoản admin đã tồn tại")
            return

        # Tạo admin mới
        admin = User(
            username="admin",
            email="admin@ptit.edu.vn",
            password_hash=get_password_hash("admin123"),
            full_name="Administrator",
            role=UserRole.admin,
            is_active=True
        )
        db.add(admin)
        db.commit()
        print("✅ Đã tạo tài khoản admin:")
        print("   Username: admin")
        print("   Password: admin123")
    finally:
        db.close()

def create_sample_books():
    """Tạo một số sách mẫu"""
    db = SessionLocal()
    try:
        # Kiểm tra đã có sách chưa
        existing_books = db.query(Book).count()
        if existing_books > 0:
            print(f"ℹ️ Database đã có {existing_books} cuốn sách")
            update_sample_book_covers(db)
            return

        # Danh sách sách mẫu
        sample_books = [
            {
                "title": "Lập trình Python cơ bản",
                "author": "Nguyễn Văn A",
                "isbn": "978-604-1-00001-1",
                "category": "Công nghệ thông tin",
                "description": "Sách hướng dẫn lập trình Python từ cơ bản đến nâng cao, phù hợp cho người mới bắt đầu.",
                "quantity": 10,
                "available_quantity": 10,
                "cover_image": BOOK_COVER_IMAGES["Lập trình Python cơ bản"]
            },
            {
                "title": "Cấu trúc dữ liệu và giải thuật",
                "author": "Trần Văn B",
                "isbn": "978-604-1-00002-2",
                "category": "Công nghệ thông tin",
                "description": "Sách về các cấu trúc dữ liệu và thuật toán phổ biến trong lập trình.",
                "quantity": 5,
                "available_quantity": 5,
                "cover_image": BOOK_COVER_IMAGES["Cấu trúc dữ liệu và giải thuật"]
            },
            {
                "title": "Mạng máy tính",
                "author": "Lê Thị C",
                "isbn": "978-604-1-00003-3",
                "category": "Công nghệ thông tin",
                "description": "Giáo trình mạng máy tính, bao gồm các khái niệm cơ bản về networking.",
                "quantity": 8,
                "available_quantity": 8,
                "cover_image": BOOK_COVER_IMAGES["Mạng máy tính"]
            },
            {
                "title": "Cơ sở dữ liệu",
                "author": "Phạm Văn D",
                "isbn": "978-604-1-00004-4",
                "category": "Công nghệ thông tin",
                "description": "Nhập môn cơ sở dữ liệu, SQL và thiết kế database.",
                "quantity": 12,
                "available_quantity": 12,
                "cover_image": BOOK_COVER_IMAGES["Cơ sở dữ liệu"]
            },
            {
                "title": "Toán cao cấp A1",
                "author": "Hoàng Văn E",
                "isbn": "978-604-1-00005-5",
                "category": "Toán học",
                "description": "Giáo trình toán cao cấp A1 dành cho sinh viên đại học.",
                "quantity": 15,
                "available_quantity": 15,
                "cover_image": BOOK_COVER_IMAGES["Toán cao cấp A1"]
            },
            {
                "title": "Vật lý đại cương",
                "author": "Ngô Thị F",
                "isbn": "978-604-1-00006-6",
                "category": "Vật lý",
                "description": "Giáo trình vật lý đại cương cho sinh viên khối kỹ thuật.",
                "quantity": 10,
                "available_quantity": 10,
                "cover_image": BOOK_COVER_IMAGES["Vật lý đại cương"]
            },
            {
                "title": "Lập trình Web với HTML/CSS/JavaScript",
                "author": "Đỗ Văn G",
                "isbn": "978-604-1-00007-7",
                "category": "Công nghệ thông tin",
                "description": "Hướng dẫn lập trình web frontend từ cơ bản đến nâng cao.",
                "quantity": 7,
                "available_quantity": 7,
                "cover_image": BOOK_COVER_IMAGES["Lập trình Web với HTML/CSS/JavaScript"]
            },
            {
                "title": "Trí tuệ nhân tạo",
                "author": "Vũ Thị H",
                "isbn": "978-604-1-00008-8",
                "category": "Công nghệ thông tin",
                "description": "Giới thiệu về AI, Machine Learning và Deep Learning.",
                "quantity": 6,
                "available_quantity": 6,
                "cover_image": BOOK_COVER_IMAGES["Trí tuệ nhân tạo"]
            },
            {
                "title": "Tiếng Anh chuyên ngành CNTT",
                "author": "Bùi Văn I",
                "isbn": "978-604-1-00009-9",
                "category": "Ngoại ngữ",
                "description": "Từ vựng và ngữ pháp tiếng Anh trong lĩnh vực CNTT.",
                "quantity": 20,
                "available_quantity": 20,
                "cover_image": BOOK_COVER_IMAGES["Tiếng Anh chuyên ngành CNTT"]
            },
            {
                "title": "Kinh tế vĩ mô",
                "author": "Cao Thị K",
                "isbn": "978-604-1-00010-0",
                "category": "Kinh tế",
                "description": "Giáo trình kinh tế vĩ mô cơ bản.",
                "quantity": 8,
                "available_quantity": 8,
                "cover_image": BOOK_COVER_IMAGES["Kinh tế vĩ mô"]
            }
        ]

        for book_data in sample_books:
            book = Book(**book_data)
            db.add(book)

        db.commit()
        print(f"✅ Đã tạo {len(sample_books)} cuốn sách mẫu")
    finally:
        db.close()

def create_sample_user():
    """Tạo một tài khoản user mẫu"""
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == "user1").first()
        if existing_user:
            print("ℹ️ Tài khoản user1 đã tồn tại")
            return

        user = User(
            username="user1",
            email="user1@ptit.edu.vn",
            password_hash=get_password_hash("user123"),
            full_name="Nguyễn Văn User",
            phone="0123456789",
            role=UserRole.user,
            is_active=True
        )
        db.add(user)
        db.commit()
        print("✅ Đã tạo tài khoản user mẫu:")
        print("   Username: user1")
        print("   Password: user123")
    finally:
        db.close()

def create_platform_sample_data():
    """Tạo dữ liệu mẫu cho các module thư viện số, social hub và dịch vụ bạn đọc."""
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        user = db.query(User).filter(User.username == "user1").first()
        books = db.query(Book).order_by(Book.id.asc()).all()

        if not admin or not user:
            print("ℹ️ Bỏ qua dữ liệu platform vì chưa có admin/user mẫu")
            return

        sample_social_users = [
            ("linh.pk", "linh.pk@ptit.edu.vn", "Phạm Khánh Linh"),
            ("tuan.da", "tuan.da@ptit.edu.vn", "Đỗ Anh Tuấn"),
            ("huy.tq", "huy.tq@ptit.edu.vn", "Trần Quốc Huy"),
            ("nam.lh", "nam.lh@ptit.edu.vn", "Lê Hải Nam"),
        ]
        social_users = [user]
        for username, email, full_name in sample_social_users:
            social_user = db.query(User).filter(User.username == username).first()
            if not social_user:
                social_user = User(
                    username=username,
                    email=email,
                    password_hash=get_password_hash("user123"),
                    full_name=full_name,
                    role=UserRole.user,
                    is_active=True,
                )
                db.add(social_user)
                db.flush()
            social_users.append(social_user)

        if db.query(DigitalResource).count() == 0:
            resources = [
                DigitalResource(
                    title="PTIT AI Research Starter Pack",
                    resource_type="ebook",
                    source_type="internal",
                    url="/uploads/resources/ai-research-starter.pdf",
                    description="Tài liệu nhập môn AI, RAG, embedding và quy trình nghiên cứu bằng trợ lý AI.",
                    subjects="AI,RAG,Machine Learning,Research",
                    access_level="authenticated",
                ),
                DigitalResource(
                    title="Cybersecurity Lab Notes",
                    resource_type="multimedia",
                    source_type="internal",
                    url="/uploads/resources/cybersecurity-lab-notes.zip",
                    description="Ghi chú thực hành an toàn thông tin, network scanning và hardening.",
                    subjects="Cybersecurity,Network,Lab",
                    access_level="authenticated",
                ),
                DigitalResource(
                    title="Luận văn mẫu: Hệ thống thư viện số",
                    resource_type="thesis",
                    source_type="institutional",
                    url="/uploads/resources/digital-library-thesis.pdf",
                    description="Luận văn mẫu về thiết kế cổng thư viện số tích hợp tìm kiếm ngữ nghĩa.",
                    subjects="Digital Library,Semantic Search,Thesis",
                    access_level="authenticated",
                ),
            ]
            db.add_all(resources)
            print(f"✅ Đã tạo {len(resources)} tài nguyên số mẫu")
        else:
            print("ℹ️ Tài nguyên số mẫu đã tồn tại")

        if books and db.query(Recommendation).count() == 0:
            recommendations = [
                Recommendation(
                    user_id=user.id,
                    book_id=book.id,
                    reason="Gợi ý dựa trên ngành học CNTT và xu hướng đọc tài liệu AI/Python.",
                    score=90 - index * 5,
                )
                for index, book in enumerate(books[:4])
            ]
            db.add_all(recommendations)
            print(f"✅ Đã tạo {len(recommendations)} gợi ý cá nhân hóa")

        if db.query(DiscussionGroup).count() == 0:
            groups = [
                DiscussionGroup(
                    name="Cộng đồng AI",
                    slug="cong-dong-ai",
                    topic="AI",
                    description="Trao đổi về AI, RAG, prompt engineering và ứng dụng trong học tập.",
                    owner_id=admin.id,
                    is_public=True,
                ),
                DiscussionGroup(
                    name="Hội nghiện Cybersecurity",
                    slug="hoi-nghien-cybersecurity",
                    topic="Cybersecurity",
                    description="Thảo luận CTF, bảo mật hệ thống và tài nguyên an toàn thông tin.",
                    owner_id=admin.id,
                    is_public=True,
                    requires_approval=True,
                ),
                DiscussionGroup(
                    name="Nhóm học CodePTIT",
                    slug="nhom-hoc-codeptit",
                    topic="Programming",
                    description="Cùng học thuật toán, cấu trúc dữ liệu và luyện đề CodePTIT.",
                    owner_id=admin.id,
                    is_public=True,
                ),
            ]
            db.add_all(groups)
            db.flush()
            posts = [
                DiscussionPost(
                    group_id=groups[0].id,
                    user_id=user.id,
                    book_id=books[7].id if len(books) > 7 else None,
                    title="Nên bắt đầu học RAG từ đâu?",
                    content="Mình đang đọc tài liệu AI trong thư viện. Có ai có lộ trình học RAG cho sinh viên năm 2 không?",
                    post_type="discussion",
                ),
                DiscussionPost(
                    group_id=groups[2].id,
                    user_id=user.id,
                    book_id=books[1].id if len(books) > 1 else None,
                    title="Review sách Cấu trúc dữ liệu và giải thuật",
                    content="Sách dễ theo dõi, phù hợp để ôn lại stack, queue, tree và graph trước khi luyện đề.",
                    post_type="review",
                    rating=5,
                ),
            ]
            db.add_all(posts)
            print(f"✅ Đã tạo {len(groups)} nhóm thảo luận và {len(posts)} bài viết mẫu")
        else:
            print("ℹ️ Social Hub mẫu đã tồn tại")

        groups = db.query(DiscussionGroup).order_by(DiscussionGroup.id.asc()).all()
        posts = db.query(DiscussionPost).order_by(DiscussionPost.id.asc()).all()

        if groups and db.query(DiscussionGroupMember).count() == 0:
            members = []
            for group in groups:
                members.append(DiscussionGroupMember(group_id=group.id, user_id=admin.id, role="admin", status="approved"))
                for index, social_user in enumerate(social_users):
                    members.append(
                        DiscussionGroupMember(
                            group_id=group.id,
                            user_id=social_user.id,
                            role="member",
                            status="approved",
                        )
                    )
            db.add_all(members)
            print(f"âœ… ÄÃ£ táº¡o {len(members)} thÃ nh viÃªn nhÃ³m máº«u")

        if groups and db.query(DiscussionPost).count() < 5:
            existing_titles = {post.title for post in posts}
            extra_posts = [
                DiscussionPost(
                    group_id=groups[0].id,
                    user_id=social_users[1].id,
                    book_id=books[7].id if len(books) > 7 else None,
                    title="Tổng hợp tài liệu RAG cho đồ án thư viện số",
                    content="Mình gom một số ghi chú về rewrite query, multi-stage search, rerank và context compression. Bạn nào làm chatbot tra cứu tài liệu có thể dùng làm checklist.",
                    post_type="resource",
                ),
                DiscussionPost(
                    group_id=groups[1].id if len(groups) > 1 else groups[0].id,
                    user_id=social_users[3].id,
                    book_id=books[2].id if len(books) > 2 else None,
                    title="Có tài liệu nhập môn phân tích mã độc cho người mới không?",
                    content="Mình đã học qua mạng máy tính và Python cơ bản. Bạn nào có sách, khóa học hoặc bài lab phù hợp thì gợi ý giúp mình với.",
                    post_type="question",
                ),
                DiscussionPost(
                    group_id=groups[2].id if len(groups) > 2 else groups[0].id,
                    user_id=social_users[2].id,
                    book_id=books[0].id if books else None,
                    title="Mẹo giữ thói quen đọc 10 trang mỗi ngày",
                    content="Mình đặt mục tiêu rất nhỏ: mỗi tối đọc 10 trang rồi ghi 3 ý chính vào sổ. Sau 2 tuần thấy dễ duy trì hơn nhiều.",
                    post_type="discussion",
                ),
            ]
            new_posts = [post for post in extra_posts if post.title not in existing_titles]
            if new_posts:
                db.add_all(new_posts)
                db.flush()
                posts.extend(new_posts)
                print(f"âœ… ÄÃ£ táº¡o thÃªm {len(new_posts)} bÃ i viáº¿t social feed")

        if posts and db.query(DiscussionPostComment).count() == 0:
            comments = [
                DiscussionPostComment(
                    post_id=posts[0].id,
                    user_id=social_users[1].id,
                    content="Bạn có thể bắt đầu từ embedding, vector search rồi mới sang rerank. Mình thấy cách học theo pipeline dễ hiểu hơn.",
                ),
                DiscussionPostComment(
                    post_id=posts[0].id,
                    user_id=social_users[2].id,
                    content="Thư viện nên ghim một bộ tài liệu RAG cơ bản cho sinh viên làm đồ án.",
                ),
                DiscussionPostComment(
                    post_id=posts[min(1, len(posts) - 1)].id,
                    user_id=social_users[3].id,
                    content="Review rất hữu ích, mình sẽ mượn cuốn này để ôn lại graph.",
                ),
            ]
            db.add_all(comments)
            print(f"âœ… ÄÃ£ táº¡o {len(comments)} bÃ¬nh luáº­n máº«u")

        if posts and db.query(DiscussionPostReaction).count() == 0:
            reactions = []
            saves = []
            for index, post in enumerate(posts[:5]):
                for social_user in social_users[: max(2, min(len(social_users), 5 - index))]:
                    reactions.append(
                        DiscussionPostReaction(
                            post_id=post.id,
                            user_id=social_user.id,
                            reaction_type="like",
                        )
                    )
                saves.append(DiscussionPostSave(post_id=post.id, user_id=social_users[index % len(social_users)].id))
            db.add_all(reactions + saves)
            print(f"âœ… ÄÃ£ táº¡o {len(reactions)} lÆ°á»£t thÃ­ch vÃ  {len(saves)} lÆ°u bÃ i máº«u")

        if db.query(ReadingChallenge).count() == 0:
            now = datetime.utcnow()
            challenge = ReadingChallenge(
                title="Thử thách 5 cuốn sách AI trong tháng",
                description="Đọc và review 5 tài liệu liên quan AI, dữ liệu hoặc lập trình.",
                start_date=now,
                end_date=now + timedelta(days=30),
                target_books=5,
            )
            db.add(challenge)
            db.flush()
            db.add(ChallengeParticipant(challenge_id=challenge.id, user_id=user.id, progress=1))
            print("✅ Đã tạo reading challenge mẫu")

        if db.query(ReadingChallenge).count() < 2:
            now = datetime.utcnow()
            second_challenge = ReadingChallenge(
                title="7 ngày ghi chú học thuật",
                description="Mỗi ngày đọc một tài liệu ngắn và chia sẻ tối thiểu 3 ý chính lên Social Hub.",
                start_date=now - timedelta(days=2),
                end_date=now + timedelta(days=12),
                target_books=7,
            )
            db.add(second_challenge)
            db.flush()

        challenges = db.query(ReadingChallenge).order_by(ReadingChallenge.id.asc()).all()
        existing_participants = {
            (participant.challenge_id, participant.user_id)
            for participant in db.query(ChallengeParticipant).all()
        }
        challenge_participants = []
        for challenge_index, challenge in enumerate(challenges[:2]):
            for user_index, social_user in enumerate(social_users):
                key = (challenge.id, social_user.id)
                if key in existing_participants:
                    continue
                challenge_participants.append(
                    ChallengeParticipant(
                        challenge_id=challenge.id,
                        user_id=social_user.id,
                        progress=max(1, min(challenge.target_books, challenge.target_books - user_index - challenge_index)),
                        completed=False,
                    )
                )
        if challenge_participants:
            db.add_all(challenge_participants)
            print(f"âœ… ÄÃ£ táº¡o {len(challenge_participants)} lÆ°á»£t tham gia thá»­ thÃ¡ch")

        if db.query(UserBadge).filter(UserBadge.user_id == user.id).count() == 0:
            db.add_all([
                UserBadge(
                    user_id=user.id,
                    badge_code="active-reviewer",
                    title="Cây viết review",
                    description="Đã đóng góp bài review hữu ích cho cộng đồng.",
                    points=120,
                ),
                UserBadge(
                    user_id=user.id,
                    badge_code="rag-explorer",
                    title="RAG Explorer",
                    description="Tích cực sử dụng AI Research Assistant để học tập.",
                    points=80,
                ),
            ])
            print("✅ Đã tạo huy hiệu người dùng mẫu")

        badge_templates = [
            ("community-starter", "Người khởi xướng thảo luận", "Đã tạo hoặc tham gia nhiều chủ đề học tập.", 140),
            ("helpful-answer", "Câu trả lời hữu ích", "Có bình luận được cộng đồng đánh giá cao.", 110),
            ("reading-streak", "Duy trì thói quen đọc", "Tham gia thử thách đọc đều đặn.", 95),
        ]
        extra_badges = []
        for index, social_user in enumerate(social_users[1:]):
            if db.query(UserBadge).filter(UserBadge.user_id == social_user.id).count() > 0:
                continue
            badge_code, title, description, points = badge_templates[index % len(badge_templates)]
            extra_badges.append(
                UserBadge(
                    user_id=social_user.id,
                    badge_code=badge_code,
                    title=title,
                    description=description,
                    points=points,
                )
            )
        if extra_badges:
            db.add_all(extra_badges)
            print(f"âœ… ÄÃ£ táº¡o {len(extra_badges)} huy hiá»‡u cá»™ng Ä‘á»“ng bá»• sung")

        if db.query(BookingResource).count() == 0:
            booking_resources = [
                BookingResource(
                    name="Phòng học nhóm A1",
                    resource_type="room",
                    location="Tầng 2 - Library PTIT",
                    capacity=8,
                    status="available",
                    description="Phòng học nhóm có bảng trắng và màn hình trình chiếu.",
                ),
                BookingResource(
                    name="PC nghiên cứu ML-01",
                    resource_type="pc",
                    location="Lab máy tính tầng 3",
                    capacity=1,
                    status="available",
                    description="Máy trạm phục vụ nghiên cứu dữ liệu và AI.",
                ),
                BookingResource(
                    name="VR Innovation Kit",
                    resource_type="lab",
                    location="Innovation Lab",
                    capacity=2,
                    status="available",
                    description="Bộ thiết bị VR dành cho demo và nghiên cứu UX.",
                ),
            ]
            db.add_all(booking_resources)
            print(f"✅ Đã tạo {len(booking_resources)} tài nguyên đặt chỗ")

        if db.query(PrintJob).filter(PrintJob.user_id == user.id).count() == 0:
            db.add(PrintJob(
                user_id=user.id,
                file_name="research-outline.pdf",
                page_count=6,
                pickup_code="PTIT2026",
                status="queued",
            ))
            print("✅ Đã tạo lệnh in mẫu")

        if db.query(LibrarianQuestion).filter(LibrarianQuestion.user_id == user.id).count() == 0:
            db.add(LibrarianQuestion(
                user_id=user.id,
                question="Em muốn tìm tài liệu về RAG và semantic search cho đồ án, thư viện có gợi ý nào không?",
                status="open",
            ))
            print("✅ Đã tạo câu hỏi thủ thư mẫu")

        if db.query(Event).count() == 0:
            now = datetime.utcnow()
            events = [
                Event(
                    title="Workshop: Sử dụng AI trong nghiên cứu học thuật",
                    event_type="workshop",
                    description="Hướng dẫn query rewriting, citation checking và dùng AI có trách nhiệm.",
                    speaker="TS. Nguyễn Minh Anh",
                    format="offline",
                    location="Hội trường Library PTIT",
                    start_time=now + timedelta(days=7),
                    end_time=now + timedelta(days=7, hours=2),
                    capacity=60,
                    registration_deadline=now + timedelta(days=6),
                    status="open",
                    tags="AI,RAG,Nghiên cứu",
                    require_checkin=True,
                    created_by=admin.id,
                ),
                Event(
                    title="Recorded Talk: Kỹ năng tìm tài liệu khoa học",
                    event_type="training",
                    description="Video buổi hướng dẫn tìm kiếm tài liệu học thuật và quản lý trích dẫn.",
                    speaker="Thủ thư học thuật PTIT",
                    format="online",
                    location="Online",
                    start_time=now - timedelta(days=10),
                    end_time=now - timedelta(days=10, hours=-1),
                    capacity=100,
                    registration_deadline=now - timedelta(days=11),
                    status="ended",
                    tags="Research,Citation",
                    recorded_url="https://example.com/library/research-skills",
                    created_by=admin.id,
                ),
                Event(
                    title="Phiên thực hành Innovation Lab: Thiết kế prototype bằng VR",
                    event_type="lab_session",
                    description="Sinh viên trải nghiệm thiết bị VR, quy trình đặt lịch lab và demo prototype học tập.",
                    speaker="Innovation Lab Team",
                    format="offline",
                    location="Innovation Lab - Tầng 3",
                    start_time=now + timedelta(days=14),
                    end_time=now + timedelta(days=14, hours=3),
                    capacity=20,
                    registration_deadline=now + timedelta(days=12),
                    status="open",
                    tags="VR,Innovation Lab,Prototype",
                    require_checkin=True,
                    created_by=admin.id,
                ),
            ]
            db.add_all(events)
            db.flush()
            db.add(EventRegistration(event_id=events[0].id, user_id=user.id, status="registered"))
            print(f"✅ Đã tạo {len(events)} sự kiện mẫu")

        if db.query(Lab).count() == 0:
            now = datetime.utcnow()
            labs = [
                Lab(
                    name="Innovation Lab VR",
                    description="Không gian trải nghiệm VR phục vụ môn học tương tác người-máy, UX và demo sản phẩm.",
                    location="Tầng 3 - Library PTIT",
                    capacity=6,
                    equipment="2 kính VR, máy trạm đồ họa, màn hình trình chiếu",
                    rules="Đặt lịch trước tối thiểu 24 giờ.\nKhông tự ý tháo lắp thiết bị.\nBáo lại thủ thư khi phát sinh lỗi.",
                    opening_hours="08:00 - 17:00, Thứ 2 - Thứ 6",
                    status="available",
                    is_bookable=True,
                ),
                Lab(
                    name="Máy in 3D Mini Lab",
                    description="Thiết bị in 3D cho đồ án mô phỏng, thiết kế sản phẩm và hoạt động sáng tạo.",
                    location="Khu Lab sáng tạo",
                    capacity=4,
                    equipment="Máy in 3D, filament PLA, bộ dụng cụ đo kiểm",
                    rules="Chỉ dùng vật liệu được thư viện phê duyệt.\nCó mặt đúng giờ để nhận bàn giao thiết bị.",
                    opening_hours="09:00 - 16:30, Thứ 2 - Thứ 6",
                    status="available",
                    is_bookable=True,
                ),
                Lab(
                    name="PC nghiên cứu dữ liệu",
                    description="Máy trạm cấu hình cao phục vụ xử lý dữ liệu, demo AI và phân tích tài liệu số.",
                    location="Phòng máy nghiên cứu - Tầng 2",
                    capacity=1,
                    equipment="GPU workstation, Python, Jupyter, công cụ phân tích dữ liệu",
                    rules="Không cài phần mềm lạ.\nSao lưu dữ liệu cá nhân sau phiên sử dụng.",
                    opening_hours="08:00 - 20:00",
                    status="maintenance",
                    is_bookable=True,
                ),
            ]
            db.add_all(labs)
            db.flush()
            db.add(
                LabBooking(
                    lab_id=labs[0].id,
                    user_id=user.id,
                    start_time=now + timedelta(days=3, hours=2),
                    end_time=now + timedelta(days=3, hours=4),
                    purpose="Thử nghiệm demo VR cho đồ án thư viện số",
                    participant_count=3,
                    status="pending",
                )
            )
            print(f"✅ Đã tạo {len(labs)} lab/thiết bị mẫu")

        if db.query(Tutorial).count() == 0:
            tutorials = [
                Tutorial(
                    title="Cách trích dẫn tài liệu IEEE",
                    category="research-skills",
                    description="Hướng dẫn chuẩn hóa trích dẫn và bibliography theo IEEE.",
                    content_url="https://example.com/tutorials/ieee-citation",
                    video_url="https://example.com/tutorials/ieee-citation",
                    duration_minutes=25,
                    topic="Kỹ năng nghiên cứu",
                    level="beginner",
                    view_count=18,
                    is_featured=True,
                    status="published",
                    created_by=admin.id,
                ),
                Tutorial(
                    title="Sử dụng AI để tóm tắt tài liệu dài",
                    category="ai-learning",
                    description="Cách dùng chatbot RAG để tóm tắt, tạo quiz và flashcard.",
                    content_url="https://example.com/tutorials/ai-summary",
                    video_url="https://example.com/tutorials/ai-summary",
                    duration_minutes=30,
                    topic="AI trong học tập",
                    level="intermediate",
                    view_count=27,
                    is_featured=True,
                    status="published",
                    created_by=admin.id,
                ),
                Tutorial(
                    title="Đặt lịch Innovation Lab và sử dụng thiết bị an toàn",
                    category="lab-skills",
                    description="Hướng dẫn quy trình đặt lịch, nhận bàn giao thiết bị và quy định sử dụng lab.",
                    content_url="https://example.com/tutorials/lab-booking",
                    video_url="https://example.com/tutorials/lab-booking",
                    duration_minutes=18,
                    topic="Lab sáng tạo",
                    level="beginner",
                    view_count=9,
                    is_featured=False,
                    status="published",
                    created_by=admin.id,
                ),
            ]
            db.add_all(tutorials)
            print(f"✅ Đã tạo {len(tutorials)} tutorial mẫu")

        if db.query(NewsPost).count() == 0:
            first_event = db.query(Event).filter(Event.status == "open").order_by(Event.id.asc()).first()
            first_lab = db.query(Lab).filter(Lab.status == "available").order_by(Lab.id.asc()).first()
            first_tutorial = db.query(Tutorial).filter(Tutorial.status == "published").order_by(Tutorial.id.asc()).first()
            news = [
                NewsPost(
                    title="Thư viện PTIT ra mắt cổng tài nguyên số",
                    category="announcement",
                    news_type="announcement",
                    summary="Bạn đọc có thể tra cứu tài liệu số, nhận gợi ý học tập và theo dõi thông báo mới từ thư viện.",
                    content="Bạn đọc có thể truy cập ebook, luận văn, video workshop và tài nguyên đa phương tiện ngay trên hệ thống.",
                    published=True,
                    status="published",
                    related_target_type="none",
                ),
                NewsPost(
                    title="Mở đăng ký Innovation Lab tháng này",
                    category="lab",
                    news_type="lab",
                    summary="Sinh viên có thể đặt lịch sử dụng thiết bị VR, máy tính nghiên cứu và không gian lab sáng tạo.",
                    content="Sinh viên có thể đặt lịch sử dụng thiết bị VR, máy tính nghiên cứu và không gian lab sáng tạo.",
                    published=True,
                    status="published",
                    related_target_type="lab",
                    related_target_id=first_lab.id if first_lab else None,
                    cta_label="Đặt lịch Lab",
                    cta_url=f"/user/events?tab=labs&labId={first_lab.id}" if first_lab else "/user/events?tab=labs",
                ),
                NewsPost(
                    title="Workshop AI trong nghiên cứu học thuật sắp mở đăng ký",
                    category="event",
                    news_type="event",
                    summary="Tham gia workshop để học cách dùng AI và RAG trong quá trình tìm kiếm, tóm tắt và trích dẫn tài liệu.",
                    content="Workshop dành cho sinh viên muốn ứng dụng AI trong học tập và nghiên cứu. Số chỗ có hạn, vui lòng đăng ký trước hạn.",
                    published=True,
                    status="published",
                    related_target_type="event",
                    related_target_id=first_event.id if first_event else None,
                    cta_label="Đăng ký sự kiện",
                    cta_url=f"/user/events?tab=upcoming&eventId={first_event.id}" if first_event else "/user/events?tab=upcoming",
                ),
                NewsPost(
                    title="Video hướng dẫn trích dẫn tài liệu IEEE",
                    category="tutorial",
                    news_type="tutorial",
                    summary="Xem nhanh video hướng dẫn chuẩn hóa trích dẫn và bibliography theo IEEE.",
                    content="Tutorial giúp sinh viên chuẩn hóa trích dẫn trong báo cáo, đồ án và bài nghiên cứu.",
                    published=True,
                    status="published",
                    related_target_type="tutorial",
                    related_target_id=first_tutorial.id if first_tutorial else None,
                    cta_label="Xem hướng dẫn",
                    cta_url=f"/user/events?tab=tutorials&tutorialId={first_tutorial.id}" if first_tutorial else "/user/events?tab=tutorials",
                ),
            ]
            db.add_all(news)
            print(f"✅ Đã tạo {len(news)} tin tức mẫu")

        if db.query(VolunteerProgram).count() == 0:
            first_event = db.query(Event).filter(Event.status == "open").order_by(Event.id.asc()).first()
            programs = [
                VolunteerProgram(
                    title="Hỗ trợ workshop AI",
                    description="Hỗ trợ check-in, hướng dẫn chỗ ngồi và chuẩn bị tài liệu cho workshop AI.",
                    location="Hội trường Library PTIT",
                    schedule_note="Theo lịch workshop gần nhất",
                    status="open",
                    related_target_type="event",
                    related_target_id=first_event.id if first_event else None,
                    cta_label="Đăng ký tham gia",
                    cta_url=f"/user/events?tab=upcoming&eventId={first_event.id}" if first_event else "/user/events?tab=upcoming",
                ),
                VolunteerProgram(
                    title="Hướng dẫn bạn đọc mới",
                    description="Giới thiệu cách tra cứu tài liệu, mượn sách và sử dụng cổng thư viện số cho sinh viên năm nhất.",
                    location="Khu tra cứu tầng 1",
                    schedule_note="Mỗi chiều thứ 4",
                    status="open",
                    related_target_type="volunteer",
                    cta_label="Đăng ký tham gia",
                ),
                VolunteerProgram(
                    title="Sắp xếp sách cuối tuần",
                    description="Cùng thủ thư sắp xếp lại khu sách chuyên ngành và dán nhãn tài liệu mới.",
                    location="Kho sách mở",
                    schedule_note="Sáng thứ 7 hằng tuần",
                    status="open",
                    related_target_type="volunteer",
                    cta_label="Đăng ký tham gia",
                ),
            ]
            db.add_all(programs)
            print(f"✅ Đã tạo {len(programs)} chương trình tình nguyện mẫu")

        if db.query(VolunteerDonation).filter(VolunteerDonation.user_id == user.id).count() == 0:
            db.add(VolunteerDonation(
                user_id=user.id,
                program_type="volunteer",
                message="Em muốn tham gia hỗ trợ phân loại tài liệu và hướng dẫn bạn đọc mới.",
                status="submitted",
            ))
            print("✅ Đã tạo đăng ký volunteer mẫu")

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

async def create_embeddings():
    """Tạo embeddings cho tất cả sách trong database"""
    db = SessionLocal()
    try:
        # Lấy tất cả sách từ database
        books = db.query(Book).all()
        
        if not books:
            print("ℹ️ Không có sách nào  lam database")
            return
        
        print(f"🔄 Đang tạo embeddings cho {len(books)} cuốn sách...")
        
        # Gọi hàm index_books từ vector_store (async)
        indexed_count = await vector_store.index_books(db, books)
        
        print(f"✅ Đã tạo embeddings cho {indexed_count} cuốn sách thành công!")
        
    except Exception as e:
        print(f"❌ Lỗi khi tạo embeddings: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("="*50)
    print("🚀 Khởi tạo dữ liệu cho Thư viện PTIT")
    print("="*50)

    try:
        init_database()
        create_admin()
        create_sample_books()
        create_sample_user()
        create_platform_sample_data()
        
        # Tạo embeddings cho sách (chạy async function)
        print("\n" + "="*50)
        print("📚 Khởi tạo embeddings cho sách...")
        print("="*50)
        asyncio.run(create_embeddings())

        print("\n" + "="*50)
        print("✅ Hoàn tất khởi tạo!")
        print("="*50)
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        print("Hãy kiểm tra lại cấu hình database trong file .env")

