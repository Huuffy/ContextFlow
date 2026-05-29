import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

# JSON Lines file — one event per line, append-only (fast write, no full reparse)
_LOG_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "campaign_events.jsonl"


def log_event(event: str, campaign_id: str, campaign_name: str,
              scheduled_at: datetime | None = None, note: str = "") -> None:
    """Append a single JSON event line. O(1) write — never reads the file."""
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S"),
        "event": event,
        "id": campaign_id,
        "name": campaign_name,
        "scheduled_at": scheduled_at.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S") if scheduled_at else None,
        "note": note,
    }
    with _LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


async def run_campaign_scheduler() -> None:
    """Checks every 60s for scheduled campaigns that are due. Fires immediately on startup
    so campaigns that crossed their deadline while the backend was down are sent right away."""
    logger.info("Campaign scheduler started — polling every 60s")
    while True:
        try:
            await _check_and_dispatch()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Campaign scheduler error: {e}", exc_info=True)
        await asyncio.sleep(60)


async def _check_and_dispatch() -> None:
    from app.db.session import AsyncSessionLocal
    from app.models import Campaign, CampaignStatus
    from sqlalchemy import select
    from app.api.v1.campaigns import _run_dispatch

    now_utc = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Campaign).where(
                Campaign.status == CampaignStatus.scheduled,
                Campaign.scheduled_at <= now_utc,
            )
        )
        due = result.scalars().all()

        if due:
            logger.info(f"Campaign scheduler: {len(due)} campaign(s) due to fire")

        for campaign in due:
            ist_time = (
                campaign.scheduled_at.astimezone(IST).strftime("%Y-%m-%d %H:%M IST")
                if campaign.scheduled_at else "—"
            )
            delay_s = int((now_utc - campaign.scheduled_at).total_seconds()) if campaign.scheduled_at else 0
            logger.info(f"Firing campaign {campaign.id} ({campaign.name}) — due at {ist_time}, {delay_s}s late")

            campaign.status = CampaignStatus.running
            await db.commit()

            log_event("fired", campaign.id, campaign.name, campaign.scheduled_at,
                      f"{delay_s}s after scheduled time")
            asyncio.create_task(_run_dispatch(campaign.id))
