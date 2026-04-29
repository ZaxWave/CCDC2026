from datetime import datetime, timezone


def utc_now() -> datetime:
    """Naive UTC for SQLAlchemy DateTime columns without timezone=True."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_iso() -> str:
    """Timezone-aware UTC ISO string for API responses and logs."""
    return datetime.now(timezone.utc).isoformat()
