from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ...config import settings
from .reminder_sender import run_due_reminder_job


class ReminderScheduler:
    def __init__(self) -> None:
        self._scheduler = BackgroundScheduler(timezone="UTC")
        self._started = False

    @property
    def is_started(self) -> bool:
        return self._started

    def start(self) -> None:
        if not settings.REMINDER_SCHEDULER_ENABLED or self._started:
            return

        self._scheduler.add_job(
            self._run_job_safely,
            trigger=IntervalTrigger(minutes=settings.REMINDER_SCHEDULER_INTERVAL_MINUTES),
            id="due-reminder-job",
            replace_existing=True,
        )
        self._scheduler.start()
        self._started = True

    def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False

    def run_now(self, dry_run: bool = False) -> dict:
        return run_due_reminder_job(days_ahead=settings.REMINDER_DAYS_AHEAD_DEFAULT, dry_run=dry_run)

    def _run_job_safely(self) -> None:
        run_due_reminder_job(days_ahead=settings.REMINDER_DAYS_AHEAD_DEFAULT, dry_run=False)


reminder_scheduler = ReminderScheduler()
