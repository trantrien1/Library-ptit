from datetime import datetime
from pydantic import BaseModel


class ReminderJobRunResponse(BaseModel):
    generated_at: datetime
    days_ahead: int
    scanned_users: int
    scanned_requests: int
    sent_emails: int
    skipped_emails: int
    errors: int
    scheduler_enabled: bool

