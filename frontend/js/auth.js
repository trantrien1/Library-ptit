// Auth utilities

// Kiểm tra đăng nhập
function isLoggedIn() {
    return localStorage.getItem('token') !== null;
}

// Lấy thông tin user
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Kiểm tra role
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

// Lưu thông tin đăng nhập
function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Xóa thông tin đăng nhập
function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Đăng xuất
function logout() {
    clearAuth();
    window.location.href = '/static/login.html';
}

// Redirect nếu chưa đăng nhập
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/static/login.html';
        return false;
    }
    return true;
}

// Redirect nếu không phải admin
function requireAdmin() {
    if (!requireAuth()) return false;
    if (!isAdmin()) {
        window.location.href = '/static/user/dashboard.html';
        return false;
    }
    return true;
}

// Redirect nếu đã đăng nhập
function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        const user = getCurrentUser();
        if (user.role === 'admin') {
            window.location.href = '/static/admin/dashboard.html';
        } else {
            window.location.href = '/static/user/dashboard.html';
        }
        return true;
    }
    return false;
}

// Cập nhật UI navbar user
function updateNavbarUser() {
    const user = getCurrentUser();
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement && user) {
        userNameElement.textContent = user.full_name || user.username;
    }
}

// Export
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;
window.saveAuth = saveAuth;
window.clearAuth = clearAuth;
window.logout = logout;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.redirectIfLoggedIn = redirectIfLoggedIn;
window.updateNavbarUser = updateNavbarUser;

