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
-- LƯU Ý: Để tạo dữ liệu mẫu (admin, sách, user)
-- Hãy chạy: python scripts/init_data.py
-- ============================================
