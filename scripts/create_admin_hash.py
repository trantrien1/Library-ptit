"""
Script để tạo password hash cho tài khoản admin.
Chạy script này sau khi cài đặt packages: pip install passlib[bcrypt]

Usage:
    python scripts/create_admin_hash.py
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_hash(password: str) -> str:
    return pwd_context.hash(password)

if __name__ == "__main__":
    # Password mặc định cho admin
    admin_password = "admin123"
    hash_value = create_hash(admin_password)
    print(f"Password: {admin_password}")
    print(f"Hash: {hash_value}")
    print("\nCopy hash này vào file sql/init.sql nếu cần.")

