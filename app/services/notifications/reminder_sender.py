import smtplib
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from email.mime.text import MIMEText
from typing import Dict, List, Set, Tuple

from sqlalchemy.orm import joinedload

from ...config import settings
from ...database import SessionLocal
from ...models.borrow import BorrowItem, BorrowRequest, BorrowStatus
from ...models.user import User, UserRole

_sent_marker_day: date | None = None
_sent_keys: Set[Tuple[int, int, date]] = set()


def _format_email_subject(overdue_count: int, due_soon_count: int) -> str:
    if overdue_count > 0:
        return f"[Thu vien PTIT] Ban co {overdue_count} phieu muon qua han"
    return f"[Thu vien PTIT] Ban co {due_soon_count} phieu sap den han tra"


def _build_email_body(user_name: str, reminder_rows: List[BorrowRequest], today: date) -> str:
    lines = [
        f"Xin chao {user_name},",
        "",
        "He thong Thu vien PTIT gui ban thong bao han tra sach:",
        "",
    ]

    for row in reminder_rows:
        days_left = (row.due_date - today).days
        first_title = row.items[0].book.title if row.items and row.items[0].book else "Khong ro ten sach"
        total_books = sum(item.quantity for item in row.items)

        if days_left < 0:
            status_text = f"Qua han {abs(days_left)} ngay"
        elif days_left == 0:
            status_text = "Den han hom nay"
        else:
            status_text = f"Con {days_left} ngay den han"

        lines.append(
            f"- Phieu #{row.id}: {status_text}; Han tra {row.due_date.strftime('%d/%m/%Y')}; "
            f"Sach tieu bieu: {first_title}; Tong SL: {total_books}"
        )

    lines.extend([
        "",
        "Vui long sap xep tra sach dung han. Cam on ban.",
        "",
        "--",
        "Thu vien PTIT",
    ])

    return "\n".join(lines)


def _send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_PORT or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP is not fully configured")

    msg = MIMEText(body, _subtype="plain", _charset="utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    if settings.SMTP_USE_TLS:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        server.starttls()
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)

    try:
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
    finally:
        server.quit()


def _reset_daily_sent_cache(today: date) -> None:
    global _sent_marker_day, _sent_keys
    if _sent_marker_day != today:
        _sent_marker_day = today
        _sent_keys = set()


def run_due_reminder_job(days_ahead: int = 3, dry_run: bool = False) -> Dict[str, int | bool | str]:
    """Run one reminder scan/send cycle for approved borrows with upcoming due dates."""
    today = date.today()
    _reset_daily_sent_cache(today)

    db = SessionLocal()
    try:
        to_date = today + timedelta(days=days_ahead)

        rows = db.query(BorrowRequest).options(
            joinedload(BorrowRequest.user),
            joinedload(BorrowRequest.items).joinedload(BorrowItem.book)
        ).filter(
            BorrowRequest.status == BorrowStatus.approved,
            BorrowRequest.due_date.isnot(None),
            BorrowRequest.due_date <= to_date,
            BorrowRequest.user.has(User.role == UserRole.user),
            BorrowRequest.user.has(User.is_active.is_(True))
        ).order_by(BorrowRequest.user_id.asc(), BorrowRequest.due_date.asc()).all()

        grouped: Dict[int, List[BorrowRequest]] = defaultdict(list)
        for row in rows:
            grouped[row.user_id].append(row)

        sent_emails = 0
        skipped_emails = 0
        errors = 0

        for _, user_rows in grouped.items():
            user = user_rows[0].user
            if not user or not user.email:
                skipped_emails += 1
                continue

            unsent_rows = []
            for row in user_rows:
                cache_key = (user.id, row.id, today)
                if cache_key in _sent_keys:
                    continue
                unsent_rows.append(row)

            if not unsent_rows:
                skipped_emails += 1
                continue

            overdue_count = sum(1 for row in unsent_rows if (row.due_date - today).days < 0)
            due_soon_count = len(unsent_rows) - overdue_count

            subject = _format_email_subject(overdue_count, due_soon_count)
            body = _build_email_body(user.full_name or user.username, unsent_rows, today)

            if dry_run:
                for row in unsent_rows:
                    _sent_keys.add((user.id, row.id, today))
                sent_emails += 1
                continue

            try:
                _send_email(user.email, subject, body)
                for row in unsent_rows:
                    _sent_keys.add((user.id, row.id, today))
                sent_emails += 1
            except Exception:
                errors += 1

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "days_ahead": days_ahead,
            "scanned_users": len(grouped),
            "scanned_requests": len(rows),
            "sent_emails": sent_emails,
            "skipped_emails": skipped_emails,
            "errors": errors,
            "dry_run": dry_run,
        }
    finally:
        db.close()

