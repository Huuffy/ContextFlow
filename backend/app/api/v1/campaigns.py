import json
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import Campaign, CampaignStatus
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])

WHITELIST_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "whitelist.json"


def _read_whitelist() -> list[dict]:
    try:
        if WHITELIST_PATH.exists():
            return json.loads(WHITELIST_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


class CampaignCreate(BaseModel):
    name: str
    content_template: str
    target_channels: list[str] = ["whatsapp"]
    audience_filter: dict = {}
    scheduled_at: Optional[datetime] = None


class CampaignOut(BaseModel):
    id: str
    name: str
    status: str
    target_channels: list[str]
    audience_filter: dict
    content_template: str
    sent_count: int
    delivered_count: int
    scheduled_at: Optional[datetime]
    created_at: datetime


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return [_to_out(c) for c in result.scalars().all()]


@router.post("", response_model=CampaignOut)
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db)):
    c = Campaign(
        name=body.name, content_template=body.content_template,
        target_channels_json=json.dumps(body.target_channels),
        audience_filter_json=json.dumps(body.audience_filter),
        scheduled_at=body.scheduled_at, created_by=None,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _to_out(c)


@router.post("/{campaign_id}/submit-review")
async def submit_review(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status != CampaignStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft campaigns can be submitted for review")
    c.status = CampaignStatus.pending_approval
    await db.commit()
    return {"status": "submitted"}


class ApproveRequest(BaseModel):
    locked_emails: Optional[list[str]] = None


@router.get("/{campaign_id}/recipients")
async def get_recipients(campaign_id: str, db: AsyncSession = Depends(get_db)):
    """Return whitelist contacts annotated with DNC status."""
    from app.models import DNCEntry, IdentifierType
    contacts = _read_whitelist()

    dnc_result = await db.execute(
        select(DNCEntry.identifier).where(
            DNCEntry.identifier_type == IdentifierType.email,
            DNCEntry.is_active == True,
        )
    )
    dnc_emails = {row[0].lower() for row in dnc_result.all()}

    out = []
    for c in contacts:
        email = (c.get("email") or "").lower()
        if not email:
            continue
        channels = []
        if c.get("email"):    channels.append("email")
        if c.get("whatsapp"): channels.append("whatsapp")
        if c.get("telegram"): channels.append("telegram")
        out.append({
            "email":    email,
            "name":     c.get("name", ""),
            "channels": channels,
            "is_dnc":   email in dnc_emails,
        })
    return out


@router.post("/{campaign_id}/approve")
async def approve_campaign(campaign_id: str, body: ApproveRequest = ApproveRequest(),
                            db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status != CampaignStatus.pending_approval:
        raise HTTPException(status_code=400, detail="Only pending campaigns can be approved")
    c.status = CampaignStatus.approved
    c.approved_by = None
    # Lock approved recipient list into audience_filter
    if body.locked_emails is not None:
        af = json.loads(c.audience_filter_json)
        af["locked_emails"] = [e.lower().strip() for e in body.locked_emails]
        c.audience_filter_json = json.dumps(af)
    await db.commit()
    return {"status": "approved"}


class ScheduleRequest(BaseModel):
    scheduled_at: datetime  # ISO with tz offset, e.g. 2026-05-30T14:30:00+05:30


@router.post("/{campaign_id}/schedule")
async def schedule_campaign(campaign_id: str, body: ScheduleRequest, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status != CampaignStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved campaigns can be scheduled")
    c.status = CampaignStatus.scheduled
    # Always store as UTC-aware so scheduler comparisons work regardless of server timezone
    from datetime import timezone as _tz
    scheduled_utc = body.scheduled_at.astimezone(_tz.utc)
    c.scheduled_at = scheduled_utc
    await db.commit()
    from app.events.campaign_scheduler import log_event
    log_event("scheduled", c.id, c.name, c.scheduled_at)
    logger.info(f"Campaign {c.id} ({c.name}) scheduled for {c.scheduled_at.isoformat()}")
    return {"status": "scheduled", "scheduled_at": c.scheduled_at.isoformat()}


@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status not in (CampaignStatus.approved, CampaignStatus.scheduled):
        raise HTTPException(status_code=400, detail="Only approved or scheduled campaigns can be dispatched")
    c.status = CampaignStatus.running
    await db.commit()
    asyncio.create_task(_run_dispatch(campaign_id))
    return {"status": "running"}


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status in (CampaignStatus.running,):
        raise HTTPException(status_code=400, detail="Cannot cancel a running campaign")
    c.status = CampaignStatus.cancelled
    await db.commit()
    return {"status": "cancelled"}


async def _run_dispatch(campaign_id: str) -> None:
    """Background task: send campaign message to all contacts in whitelist.json."""
    from app.db.session import AsyncSessionLocal
    from app.models import DNCEntry, IdentifierType
    from sqlalchemy import select as _select

    try:
        contacts = _read_whitelist()
        if not contacts:
            logger.warning(f"Campaign {campaign_id}: whitelist is empty — no messages sent")

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
            campaign = result.scalar_one_or_none()
            if not campaign:
                return

            target_channels: list[str] = json.loads(campaign.target_channels_json)
            audience_filter: dict = json.loads(campaign.audience_filter_json)
            locked_emails: set[str] | None = (
                {e.lower() for e in audience_filter["locked_emails"]}
                if "locked_emails" in audience_filter else None
            )

            # Pre-load active DNC emails for fast lookup
            dnc_result = await db.execute(
                _select(DNCEntry.identifier).where(
                    DNCEntry.identifier_type == IdentifierType.email,
                    DNCEntry.is_active == True,
                )
            )
            dnc_emails = {row[0].lower() for row in dnc_result.all()}

            sent = 0
            delivered = 0

            for contact in contacts:
                email = (contact.get("email") or "").lower()
                if not email:
                    continue
                # Respect locked recipient list from approval step
                if locked_emails is not None and email not in locked_emails:
                    continue
                # DNC check
                if email in dnc_emails:
                    logger.info(f"Campaign {campaign_id}: skipping {email} (DNC)")
                    continue

                name = (contact.get("name") or email.split("@")[0]).split()[0]
                text = campaign.content_template.replace("{{name}}", name)
                text += "\n\n─\nTo stop receiving messages from NeoBank, reply with just: opt out"

                for channel in target_channels:
                    identifier: str | None = None
                    if channel == "email":
                        identifier = email
                    elif channel == "whatsapp":
                        identifier = contact.get("whatsapp")
                    elif channel == "telegram":
                        identifier = contact.get("telegram")
                    elif channel == "instagram":
                        identifier = contact.get("instagram")

                    if not identifier:
                        continue

                    ok = await _send_campaign_message(channel, identifier, text, campaign.name, email)
                    sent += 1
                    if ok:
                        delivered += 1

                    # Gmail free SMTP: 100/day hard cap, safe burst ~1/sec.
                    # 1s delay keeps us well under the velocity trigger without being slow.
                    if channel == "email":
                        await asyncio.sleep(1)
                    else:
                        await asyncio.sleep(0.05)

            campaign.sent_count = sent
            campaign.delivered_count = delivered
            campaign.status = CampaignStatus.completed
            await db.commit()
            logger.info(f"Campaign {campaign_id} completed: {sent} sent, {delivered} delivered")
            from app.events.campaign_scheduler import log_event
            log_event("completed", campaign_id, campaign.name, campaign.scheduled_at,
                      f"sent={sent} delivered={delivered}")

    except Exception as e:
        from app.integrations.email_client import EmailRateLimitError
        is_quota = isinstance(e, EmailRateLimitError)
        if is_quota:
            logger.warning(f"Campaign {campaign_id} paused — Gmail daily quota exhausted: {e}")
        else:
            logger.error(f"Campaign dispatch error for {campaign_id}: {e}", exc_info=True)
        try:
            from app.db.session import AsyncSessionLocal as _ASL
            async with _ASL() as db:
                result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
                c = result.scalar_one_or_none()
                if c and c.status == CampaignStatus.running:
                    # Quota exhaustion → completed (partial); other errors → completed with warning
                    c.status = CampaignStatus.completed
                    await db.commit()
        except Exception:
            pass


async def _send_campaign_message(channel: str, identifier: str, text: str,
                                  campaign_name: str, customer_email: str | None) -> bool:
    try:
        if channel == "email":
            from app.integrations.email_client import send_email, EmailRateLimitError
            try:
                await send_email(
                    to=identifier,
                    subject=f"NeoBank: {campaign_name}",
                    body=text,
                )
            except EmailRateLimitError:
                # Re-raise so _run_dispatch can stop the campaign and mark it for retry
                raise
        elif channel == "telegram":
            from app.integrations.telegram_client import send_telegram_message
            await send_telegram_message(chat_id=identifier, text=text)
        elif channel == "whatsapp":
            from app.integrations.whatsapp import send_whatsapp_message
            await send_whatsapp_message(to=identifier, text=text)
        elif channel == "instagram":
            from app.integrations.instagram import send_instagram_message
            await send_instagram_message(igsid=identifier, text=text)
        elif channel == "simulator":
            logger.info(f"[CAMPAIGN SIMULATOR] → {identifier}: {text[:60]}…")
        return True
    except Exception as e:
        logger.warning(f"Campaign send failed ({channel} → {identifier}): {e}")
        return False


async def _get_campaign(campaign_id: str, db: AsyncSession) -> Campaign:
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


def _to_out(c: Campaign) -> CampaignOut:
    return CampaignOut(
        id=c.id, name=c.name, status=c.status.value,
        target_channels=json.loads(c.target_channels_json),
        audience_filter=json.loads(c.audience_filter_json),
        content_template=c.content_template,
        sent_count=c.sent_count, delivered_count=c.delivered_count,
        scheduled_at=c.scheduled_at,
        created_at=c.created_at,
    )
