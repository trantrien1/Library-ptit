// API Base URL
const API_URL = '/api';

// Helper function để xử lý response
async function handleResponse(response) {
    // Lấy text response trước
    const text = await response.text();

    // Thử parse JSON
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        // Nếu không phải JSON, xử lý như text error
        if (!response.ok) {
            throw new Error(getErrorMessage(response.status, text));
        }
        throw new Error('Phản hồi từ server không hợp lệ');
    }

    // Kiểm tra response status
    if (!response.ok) {
        // Xử lý các loại error detail khác nhau từ FastAPI
        let errorMessage = 'Có lỗi xảy ra';

        if (data.detail) {
            if (typeof data.detail === 'string') {
                errorMessage = data.detail;
            } else if (Array.isArray(data.detail)) {
                // Validation errors từ Pydantic
                errorMessage = data.detail.map(err => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : 'Trường';
                    const msg = translateValidationError(err.msg, field);
                    return msg;
                }).join('. ');
            } else if (data.detail.msg) {
                errorMessage = data.detail.msg;
            }
        } else if (data.message) {
            errorMessage = data.message;
        }

        throw new Error(errorMessage);
    }

    return data;
}

// Dịch lỗi validation sang tiếng Việt
function translateValidationError(msg, field) {
    const fieldNames = {
        'title': 'Tên sách',
        'author': 'Tác giả',
        'isbn': 'ISBN',
        'category': 'Danh mục',
        'quantity': 'Số lượng',
        'description': 'Mô tả',
        'cover_image': 'Ảnh bìa',
        'username': 'Tên đăng nhập',
        'password': 'Mật khẩu',
        'email': 'Email',
        'full_name': 'Họ tên',
        'phone': 'Số điện thoại',
        'note': 'Ghi chú',
        'due_date': 'Ngày trả'
    };

    const fieldName = fieldNames[field] || field;

    // Dịch các lỗi phổ biến
    if (msg.includes('String should have at most')) {
        const match = msg.match(/at most (\d+)/);
        const maxLen = match ? match[1] : '?';
        return `${fieldName} không được quá ${maxLen} ký tự`;
    }
    if (msg.includes('String should have at least')) {
        const match = msg.match(/at least (\d+)/);
        const minLen = match ? match[1] : '?';
        return `${fieldName} phải có ít nhất ${minLen} ký tự`;
    }
    if (msg.includes('field required') || msg.includes('Field required')) {
        return `${fieldName} là bắt buộc`;
    }
    if (msg.includes('value is not a valid email')) {
        return `${fieldName} không đúng định dạng email`;
    }
    if (msg.includes('value is not a valid integer')) {
        return `${fieldName} phải là số nguyên`;
    }
    if (msg.includes('ensure this value is greater than')) {
        return `${fieldName} phải lớn hơn 0`;
    }
    if (msg.includes('ensure this value is less than')) {
        return `${fieldName} quá lớn`;
    }
    if (msg.includes('Invalid URL')) {
        return `${fieldName} không đúng định dạng URL`;
    }

    return `${fieldName}: ${msg}`;
}

// Lấy thông báo lỗi theo status code
function getErrorMessage(status, text) {
    switch (status) {
        case 400:
            return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
        case 401:
            return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
        case 403:
            return 'Bạn không có quyền thực hiện thao tác này.';
        case 404:
            return 'Không tìm thấy dữ liệu yêu cầu.';
        case 409:
            return 'Dữ liệu bị trùng lặp.';
        case 422:
            return 'Dữ liệu không đúng định dạng. Vui lòng kiểm tra lại.';
        case 500:
            return 'Lỗi máy chủ. Vui lòng thử lại sau.';
        default:
            return `Lỗi ${status}: ${text || 'Có lỗi xảy ra'}`;
    }
}

// Helper function để tạo headers với token
function getHeaders(includeAuth = true) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (includeAuth) {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
}

// ===== AUTH API =====
const authAPI = {
    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        return handleResponse(response);
    },

    async register(userData) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify(userData)
        });
        return handleResponse(response);
    },

    async getMe() {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    }
};

// ===== BOOKS API =====
const booksAPI = {
    async getBooks(page = 1, pageSize = 10, search = '', category = '') {
        let url = `${API_URL}/books?page=${page}&page_size=${pageSize}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;

        const response = await fetch(url, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    },

    async getBook(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}`, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    },

    async getCategories() {
        const response = await fetch(`${API_URL}/books/categories`, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    },

    async createBook(bookData) {
        const response = await fetch(`${API_URL}/books`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(bookData)
        });
        return handleResponse(response);
    },

    async updateBook(bookId, bookData) {
        const response = await fetch(`${API_URL}/books/${bookId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(bookData)
        });
        return handleResponse(response);
    },

    async deleteBook(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    },

    async uploadPdf(bookId, file) {
        const formData = new FormData();
        formData.append('pdf', file);
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_URL}/books/${bookId}/upload-pdf`, {
            method: 'POST',
            headers,
            body: formData
        });
        return handleResponse(response);
    }
};

// ===== USERS API =====
const usersAPI = {
    async getUsers(page = 1, pageSize = 10, search = '', role = '') {
        let url = `${API_URL}/users?page=${page}&page_size=${pageSize}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (role) url += `&role=${encodeURIComponent(role)}`;

        const response = await fetch(url, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async getUser(userId) {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async updateUser(userId, userData) {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(userData)
        });
        return handleResponse(response);
    },

    async resetPassword(userId, newPassword) {
        const response = await fetch(`${API_URL}/users/${userId}/reset-password`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ new_password: newPassword })
        });
        return handleResponse(response);
    },

    async deleteUser(userId) {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    }
};

// ===== WISHLIST API =====
const wishlistAPI = {
    async getWishlist() {
        const response = await fetch(`${API_URL}/wishlist`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async addToWishlist(bookId, quantity = 1) {
        const response = await fetch(`${API_URL}/wishlist`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ book_id: bookId, quantity })
        });
        return handleResponse(response);
    },

    async updateWishlistItem(bookId, quantity) {
        const response = await fetch(`${API_URL}/wishlist/${bookId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ quantity })
        });
        return handleResponse(response);
    },

    async removeFromWishlist(bookId) {
        const response = await fetch(`${API_URL}/wishlist/${bookId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    },

    async clearWishlist() {
        const response = await fetch(`${API_URL}/wishlist`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    }
};

// ===== BORROWS API =====
const borrowsAPI = {
    async getBorrows(page = 1, pageSize = 10, status = '', search = '') {
        let url = `${API_URL}/borrows?page=${page}&page_size=${pageSize}`;
        if (status) url += `&status_filter=${encodeURIComponent(status)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;

        const response = await fetch(url, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async getBorrow(requestId) {
        const response = await fetch(`${API_URL}/borrows/${requestId}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async getReminders(daysAhead = 3, limit = 10) {
        const response = await fetch(`${API_URL}/borrows/reminders?days_ahead=${daysAhead}&limit=${limit}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async createBorrow(note = '', items = null, dueDate = null) {
        const body = { note };
        if (items) body.items = items;
        if (dueDate) body.due_date = dueDate;

        const response = await fetch(`${API_URL}/borrows`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(response);
    },

    async updateBorrow(requestId, note, items, dueDate = null) {
        const body = { note, items };
        if (dueDate) body.due_date = dueDate;

        const response = await fetch(`${API_URL}/borrows/${requestId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(response);
    },

    async approveBorrow(requestId, adminNote = '') {
        const response = await fetch(`${API_URL}/borrows/${requestId}/approve`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ admin_note: adminNote })
        });
        return handleResponse(response);
    },

    async rejectBorrow(requestId, adminNote, requireEdit = false) {
        const response = await fetch(`${API_URL}/borrows/${requestId}/reject`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ admin_note: adminNote, require_edit: requireEdit })
        });
        return handleResponse(response);
    },

    async returnBooks(requestId) {
        const response = await fetch(`${API_URL}/borrows/${requestId}/return`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async deleteBorrow(requestId) {
        const response = await fetch(`${API_URL}/borrows/${requestId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    }
};

// ===== RENEWAL API =====
const renewalAPI = {
    async requestRenewal(borrowId, requestedDays, reason) {
        const response = await fetch(`${API_URL}/borrows/${borrowId}/renew`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ requested_days: requestedDays, reason })
        });
        return handleResponse(response);
    },

    async getPendingRenewals() {
        const response = await fetch(`${API_URL}/borrows/renewals`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async approveRenewal(renewalId) {
        const response = await fetch(`${API_URL}/borrows/renewals/${renewalId}/approve`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async rejectRenewal(renewalId, adminNote) {
        const response = await fetch(`${API_URL}/borrows/renewals/${renewalId}/reject?admin_note=${encodeURIComponent(adminNote)}`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    }
};

// ===== WAITLIST API =====
const waitlistAPI = {
    async join(bookId, quantity = 1) {
        const response = await fetch(`${API_URL}/borrows/waitlist`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ book_id: bookId, quantity })
        });
        return handleResponse(response);
    },

    async getMyWaitlist() {
        const response = await fetch(`${API_URL}/borrows/waitlist`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async cancel(waitlistId) {
        const response = await fetch(`${API_URL}/borrows/waitlist/${waitlistId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    },

    async getAllWaitlist() {
        const response = await fetch(`${API_URL}/borrows/admin/waitlist`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    }
};

// ===== REVIEWS API =====
const reviewsAPI = {
    async getReviews(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}/reviews`, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    },

    async getSummary(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}/reviews/summary`, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    },

    async getMyReview(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}/reviews/me`, {
            headers: getHeaders()
        });
        if (response.status === 404) return null;
        return handleResponse(response);
    },

    async createOrUpdate(bookId, rating, comment) {
        const response = await fetch(`${API_URL}/books/${bookId}/reviews`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ rating, comment })
        });
        return handleResponse(response);
    },

    async deleteMyReview(bookId) {
        const response = await fetch(`${API_URL}/books/${bookId}/reviews/me`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        return true;
    }
};

// ===== ADMIN STATS API =====
const adminStatsAPI = {
    async getOverview(periodDays = 30) {
        const response = await fetch(`${API_URL}/admin/stats/overview?period_days=${periodDays}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async getBookStats(periodDays = 30, lowStockThreshold = 2, topLimit = 10) {
        const response = await fetch(
            `${API_URL}/admin/stats/books?period_days=${periodDays}&low_stock_threshold=${lowStockThreshold}&top_limit=${topLimit}`,
            {
                headers: getHeaders()
            }
        );
        return handleResponse(response);
    },

    async getUserStats(periodDays = 30, topLimit = 10) {
        const response = await fetch(`${API_URL}/admin/stats/users?period_days=${periodDays}&top_limit=${topLimit}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    }
};

// ===== CHATBOT API =====
const chatbotAPI = {
    async sendMessage(message, chatHistory = []) {
        const response = await fetch(`${API_URL}/chatbot/chat`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify({ message, chat_history: chatHistory })
        });
        return handleResponse(response);
    },

    async indexBooks() {
        const response = await fetch(`${API_URL}/chatbot/index`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    async getStatus() {
        const response = await fetch(`${API_URL}/chatbot/status`, {
            headers: getHeaders(false)
        });
        return handleResponse(response);
    }
};

// Export tất cả
window.authAPI = authAPI;
window.booksAPI = booksAPI;
window.usersAPI = usersAPI;
window.wishlistAPI = wishlistAPI;
window.borrowsAPI = borrowsAPI;
window.renewalAPI = renewalAPI;
window.waitlistAPI = waitlistAPI;
window.reviewsAPI = reviewsAPI;
window.adminStatsAPI = adminStatsAPI;
window.chatbotAPI = chatbotAPI;

