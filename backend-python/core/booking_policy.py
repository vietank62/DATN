"""Business deadlines use the restaurant's Vietnam timezone."""
from datetime import datetime, timedelta, timezone

APP_TIME_ZONE = timezone(timedelta(hours=7))
CONFIRMATION_LEAD = timedelta(hours=2)
CUSTOMER_CANCEL_LEAD = timedelta(hours=1)
AUTO_COMPLETE_DELAY = timedelta(days=7)


def month_start(now=None):
    now = now or datetime.now(APP_TIME_ZONE)
    return now.astimezone(APP_TIME_ZONE).replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
