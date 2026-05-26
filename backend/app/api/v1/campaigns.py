import json
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import Campaign, CampaignStatus, Customer, ChannelIdentifier
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])


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


@router.post("/{campaign_id}/approve")
async def approve_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status != CampaignStatus.pending_approval:
        raise HTTPException(status_code=400, detail="Only pending campaigns can be approved")
    c.status = CampaignStatus.approved
    c.approved_by = None
    await db.commit()
    return {"status": "approved"}


@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = await _get_campaign(campaign_id, db)
    if c.status != CampaignStatus.approved:
        raise HTTPException(status_code=400, detail="Only approved campaigns can be dispatched")
    c.status = CampaignStatus.running
    await db.commit()
    # Fire background send task
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
    """Background task: send campaign message to all eligible customers."""
    from app.db.session import AsyncSessionLocal
    from app.api.v1.compliance import is_customer_blocked

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
            campaign = result.scalar_one_or_none()
            if not campaign:
                return

            target_channels: list[str] = json.loads(campaign.target_channels_json)

            # Get all customers
            customers_result = await db.execute(select(Customer))
            customers = customers_result.scalars().all()

            sent = 0
            delivered = 0

            for customer in customers:
                # DNC check
                if await is_customer_blocked(customer.id, db):
                    continue

                # Find channel identifier for each target channel
                for channel in target_channels:
                    ci_result = await db.execute(
                        select(ChannelIdentifier).where(
                            ChannelIdentifier.customer_id == customer.id,
                            ChannelIdentifier.channel == channel,
                        )
                    )
                    ci = ci_result.scalar_one_or_none()
                    if not ci:
                        continue

                    # Personalize message
                    name = customer.display_name.split()[0] if customer.display_name else "Customer"
                    text = campaign.content_template.replace("{{name}}", name)

                    # Deliver
                    ok = await _send_campaign_message(channel, ci.identifier, text,
                                                      campaign.name, customer.email)
                    sent += 1
                    if ok:
                        delivered += 1

                    # Small delay to avoid rate-limit bursts
                    await asyncio.sleep(0.05)

            # Mark completed
            campaign.sent_count = sent
            campaign.delivered_count = delivered
            campaign.status = CampaignStatus.completed
            await db.commit()
            logger.info(f"Campaign {campaign_id} completed: {sent} sent, {delivered} delivered")

    except Exception as e:
        logger.error(f"Campaign dispatch error for {campaign_id}: {e}", exc_info=True)
        # Try to mark as completed anyway so it doesn't stay "running"
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
                c = result.scalar_one_or_none()
                if c and c.status == CampaignStatus.running:
                    c.status = CampaignStatus.completed
                    await db.commit()
        except Exception:
            pass


async def _send_campaign_message(channel: str, identifier: str, text: str,
                                  campaign_name: str, customer_email: str | None) -> bool:
    try:
        if channel == "email":
            from app.integrations.email_client import send_email
            await send_email(
                to=identifier,
                subject=f"NeoBank: {campaign_name}",
                body=text,
            )
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
