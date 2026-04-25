-- ============================================
-- THƯ VIỆN PTIT - Database Initialization
-- ============================================
-- Chạy script này trong MySQL để tạo database
-- ============================================

-- Tạo Database
CREATE DATABASE IF NOT EXISTS library_ptit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_ptit;

-- ============================================
-- Bảng Users (Người dùng)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- ============================================
-- Bảng Books (Sách)
-- ============================================
CREATE TABLE IF NOT EXISTS books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100),
    isbn VARCHAR(20) UNIQUE,
    category VARCHAR(50),
    description TEXT,
    quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0,
    cover_image VARCHAR(255),
    pdf_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title),
    INDEX idx_category (category),
    INDEX idx_isbn (isbn)
);

-- ============================================
-- Bảng Wishlist (Giỏ mượn)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE KEY unique_wishlist (user_id, book_id)
);

-- ============================================
-- Bảng Borrow Requests (Phiếu mượn)
-- ============================================
CREATE TABLE IF NOT EXISTS borrow_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'returned', 'need_edit') DEFAULT 'pending',
    note TEXT,
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    due_date DATE NULL,
    returned_at TIMESTAMP NULL,
    renewal_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- Bảng Borrow Items (Chi tiết phiếu mượn)
-- ============================================
CREATE TABLE IF NOT EXISTS borrow_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT DEFAULT 1,
    FOREIGN KEY (request_id) REFERENCES borrow_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id)
);

-- ============================================
-- AI-Powered Discovery & Digital Resources
-- ============================================
CREATE TABLE IF NOT EXISTS library_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(80) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_library_setting_key (setting_key)
);

CREATE TABLE IF NOT EXISTS digital_resources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL DEFAULT 'ebook',
    source_type VARCHAR(50) NOT NULL DEFAULT 'internal',
    url VARCHAR(500),
    description TEXT,
    subjects VARCHAR(255),
    access_level VARCHAR(50) NOT NULL DEFAULT 'authenticated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_digital_resource_title (title),
    INDEX idx_digital_resource_subjects (subjects)
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    reason TEXT,
    score FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_book_recommendation (user_id, book_id),
    INDEX idx_recommendation_user (user_id),
    INDEX idx_recommendation_book (book_id)
);

-- ============================================
-- Library Social Hub
-- ============================================
CREATE TABLE IF NOT EXISTS discussion_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    topic VARCHAR(120),
    description TEXT,
    owner_id INT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    status VARCHAR(40) DEFAULT 'active',
    rules TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_discussion_group_slug (slug),
    INDEX idx_discussion_group_topic (topic)
);

CREATE TABLE IF NOT EXISTS discussion_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    book_id INT NULL,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    post_type VARCHAR(40) DEFAULT 'discussion',
    tags VARCHAR(255),
    rating INT NULL,
    status VARCHAR(40) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES discussion_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_discussion_post_group (group_id),
    INDEX idx_discussion_post_user (user_id),
    INDEX idx_discussion_post_book (book_id)
);

CREATE TABLE IF NOT EXISTS discussion_group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(40) DEFAULT 'member',
    status VARCHAR(40) DEFAULT 'approved',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES discussion_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_discussion_group_member (group_id, user_id),
    INDEX idx_discussion_group_member_group (group_id),
    INDEX idx_discussion_group_member_user (user_id)
);

CREATE TABLE IF NOT EXISTS discussion_post_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(40) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_discussion_comment_post (post_id),
    INDEX idx_discussion_comment_user (user_id)
);

CREATE TABLE IF NOT EXISTS discussion_post_reactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    reaction_type VARCHAR(40) DEFAULT 'like',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_discussion_post_reaction (post_id, user_id, reaction_type),
    INDEX idx_discussion_reaction_post (post_id),
    INDEX idx_discussion_reaction_user (user_id)
);

CREATE TABLE IF NOT EXISTS discussion_post_saves (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_discussion_post_save (post_id, user_id),
    INDEX idx_discussion_save_post (post_id),
    INDEX idx_discussion_save_user (user_id)
);

CREATE TABLE IF NOT EXISTS reading_challenges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    target_books INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    challenge_id INT NOT NULL,
    user_id INT NOT NULL,
    progress INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES reading_challenges(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_challenge_user (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_badges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    badge_code VARCHAR(60) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    points INT DEFAULT 0,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_badge_user (user_id)
);

-- ============================================
-- Reader Services
-- ============================================
CREATE TABLE IF NOT EXISTS booking_resources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    location VARCHAR(160),
    capacity INT DEFAULT 1,
    status VARCHAR(40) DEFAULT 'available',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_booking_resource_type (resource_type)
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resource_id INT NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    purpose TEXT,
    status VARCHAR(40) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES booking_resources(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS print_jobs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    page_count INT DEFAULT 1,
    pickup_code VARCHAR(30) NOT NULL,
    status VARCHAR(40) DEFAULT 'queued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_print_job_pickup_code (pickup_code)
);

CREATE TABLE IF NOT EXISTS librarian_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    question TEXT NOT NULL,
    response TEXT,
    status VARCHAR(40) DEFAULT 'open',
    appointment_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Events, Training & Innovation Lab
-- ============================================
CREATE TABLE IF NOT EXISTS library_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    event_type VARCHAR(60) DEFAULT 'workshop',
    description TEXT,
    speaker VARCHAR(160),
    format VARCHAR(40) DEFAULT 'offline',
    location VARCHAR(180),
    online_link VARCHAR(500),
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    capacity INT NOT NULL DEFAULT 40,
    registration_deadline DATETIME NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'open',
    tags VARCHAR(255),
    thumbnail VARCHAR(500),
    materials TEXT,
    recorded_url VARCHAR(500),
    require_checkin BOOLEAN DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_library_event_type (event_type),
    INDEX idx_library_event_status (status),
    INDEX idx_library_event_start_time (start_time)
);

CREATE TABLE IF NOT EXISTS event_registrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'registered',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (event_id) REFERENCES library_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_event_registration_user (event_id, user_id),
    INDEX idx_event_registration_event (event_id),
    INDEX idx_event_registration_user (user_id),
    INDEX idx_event_registration_status (status)
);

CREATE TABLE IF NOT EXISTS labs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    location VARCHAR(180),
    capacity INT NOT NULL DEFAULT 1,
    equipment TEXT,
    rules TEXT,
    opening_hours VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'available',
    is_bookable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lab_status (status),
    INDEX idx_lab_bookable (is_bookable)
);

CREATE TABLE IF NOT EXISTS lab_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lab_id INT NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    purpose TEXT,
    participant_count INT NOT NULL DEFAULT 1,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_lab_booking_lab (lab_id),
    INDEX idx_lab_booking_user (user_id),
    INDEX idx_lab_booking_status (status),
    INDEX idx_lab_booking_time (start_time, end_time)
);

CREATE TABLE IF NOT EXISTS library_tutorials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80),
    description TEXT,
    content_url VARCHAR(500),
    video_url VARCHAR(500),
    thumbnail VARCHAR(500),
    duration_minutes INT DEFAULT 0,
    topic VARCHAR(120),
    level VARCHAR(40) DEFAULT 'beginner',
    view_count INT NOT NULL DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    status VARCHAR(40) NOT NULL DEFAULT 'published',
    attachments TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_library_tutorial_category (category),
    INDEX idx_library_tutorial_topic (topic),
    INDEX idx_library_tutorial_status (status)
);

-- ============================================
-- Library Information & Official Channels
-- ============================================
CREATE TABLE IF NOT EXISTS library_news (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(80) DEFAULT 'news',
    news_type VARCHAR(40) DEFAULT 'announcement',
    summary TEXT,
    content TEXT NOT NULL,
    published BOOLEAN DEFAULT TRUE,
    status VARCHAR(40) DEFAULT 'published',
    related_target_type VARCHAR(40) DEFAULT 'none',
    related_target_id INT NULL,
    cta_label VARCHAR(120) NULL,
    cta_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_library_news_type (news_type),
    INDEX idx_library_news_status (status)
);

CREATE TABLE IF NOT EXISTS library_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    feedback_type VARCHAR(60) DEFAULT 'general',
    subject VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(40) DEFAULT 'normal',
    status VARCHAR(40) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS volunteer_donations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    program_type VARCHAR(60) NOT NULL,
    title VARCHAR(180) NULL,
    contact_info VARCHAR(180) NULL,
    message TEXT,
    status VARCHAR(40) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS volunteer_programs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    location VARCHAR(180),
    schedule_note VARCHAR(180),
    status VARCHAR(40) DEFAULT 'open',
    related_target_type VARCHAR(40) DEFAULT 'none',
    related_target_id INT NULL,
    cta_label VARCHAR(120),
    cta_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_volunteer_program_status (status)
);

-- ============================================
-- LƯU Ý: Để tạo dữ liệu mẫu (admin, sách, user)
-- Hãy chạy: python scripts/init_data.py
-- ============================================
