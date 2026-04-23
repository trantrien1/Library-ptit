from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from ..config import settings
from ..models.user import User
from ..schemas.notification import ReminderJobRunResponse
from ..services.notifications import reminder_scheduler, run_due_reminder_job
from ..utils.dependencies import get_current_admin

router = APIRouter(prefix="/api/admin/notifications", tags=["Admin Notifications"])


@router.post("/reminders/run", response_model=ReminderJobRunResponse)
async def run_due_reminders(
    days_ahead: int = Query(3, ge=1, le=30),
    dry_run: bool = Query(False),
    current_user: User = Depends(get_current_admin),
):
    """Admin trigger to run due-date reminder email cycle immediately."""
    del current_user

    result = run_due_reminder_job(days_ahead=days_ahead, dry_run=dry_run)
    return ReminderJobRunResponse(
        generated_at=datetime.now(timezone.utc),
        days_ahead=days_ahead,
        scanned_users=int(result.get("scanned_users", 0)),
        scanned_requests=int(result.get("scanned_requests", 0)),
        sent_emails=int(result.get("sent_emails", 0)),
        skipped_emails=int(result.get("skipped_emails", 0)),
        errors=int(result.get("errors", 0)),
        scheduler_enabled=bool(settings.REMINDER_SCHEDULER_ENABLED),
    )


@router.get("/reminders/status")
async def get_due_reminder_status(current_user: User = Depends(get_current_admin)):
    """Quick status endpoint for demo and monitoring."""
    del current_user

    return {
        "scheduler_enabled": settings.REMINDER_SCHEDULER_ENABLED,
        "days_ahead_default": settings.REMINDER_DAYS_AHEAD_DEFAULT,
        "interval_minutes": settings.REMINDER_SCHEDULER_INTERVAL_MINUTES,
        "smtp_configured": bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL),
        "scheduler_started": reminder_scheduler.is_started,
    }
