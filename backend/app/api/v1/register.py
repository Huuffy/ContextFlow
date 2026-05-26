import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.session import get_db
from app.models import Customer, ChannelIdentifier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/register", tags=["register"])

# contextflow/whitelist.json — 5 parents up from this file
WHITELIST_PATH = Path(__file__).resolve().parent.parent.parent.parent.parent / "whitelist.json"

_LOCK = False  # simple in-process write guard (single-worker; sufficient for hackathon)


class RegisterRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    whatsapp: Optional[str] = None   # phone number, e.g. +919876543210
    telegram: Optional[str] = None   # chat_id (number) or @username


def _read_whitelist() -> list[dict]:
    try:
        if WHITELIST_PATH.exists():
            return json.loads(WHITELIST_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def _write_whitelist(contacts: list[dict]) -> None:
    WHITELIST_PATH.write_text(json.dumps(contacts, indent=2, ensure_ascii=False), encoding="utf-8")


@router.post("")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()

    # ── Dedup in whitelist ──────────────────────────────────────────────────
    contacts = _read_whitelist()
    existing = next((c for c in contacts if c.get("email") == email), None)
    if existing:
        # Update optional fields if now provided
        if body.name:      existing["name"]     = body.name
        if body.whatsapp:  existing["whatsapp"]  = _normalise_phone(body.whatsapp)
        if body.telegram:  existing["telegram"]  = body.telegram.strip()
        _write_whitelist(contacts)
    else:
        contacts.append({
            "name":          body.name or email.split("@")[0],
            "email":         email,
            "whatsapp":      _normalise_phone(body.whatsapp) if body.whatsapp else None,
            "telegram":      body.telegram.strip() if body.telegram else None,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        })
        _write_whitelist(contacts)
        logger.info(f"Registered contact: {email}")

    # ── Upsert in DB (customer + channel identifiers) ───────────────────────
    result = await db.execute(select(Customer).where(Customer.email == email))
    customer = result.scalar_one_or_none()

    if not customer:
        customer = Customer(
            display_name=body.name or email.split("@")[0],
            email=email,
        )
        db.add(customer)
        await db.flush()

    # Email identifier
    await _upsert_identifier(db, customer.id, "email", email)

    if body.whatsapp:
        phone = _normalise_phone(body.whatsapp)
        if phone:
            await _upsert_identifier(db, customer.id, "whatsapp", phone)

    if body.telegram:
        await _upsert_identifier(db, customer.id, "telegram", body.telegram.strip())

    await db.commit()
    return {"status": "registered", "email": email}


async def _upsert_identifier(db: AsyncSession, customer_id: str, channel: str, identifier: str) -> None:
    result = await db.execute(
        select(ChannelIdentifier).where(
            ChannelIdentifier.customer_id == customer_id,
            ChannelIdentifier.channel == channel,
        )
    )
    ci = result.scalar_one_or_none()
    if not ci:
        db.add(ChannelIdentifier(customer_id=customer_id, channel=channel, identifier=identifier))
    else:
        ci.identifier = identifier


def _normalise_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    # Strip spaces, dashes, parentheses; keep leading + for storage but strip for WA API
    cleaned = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    return cleaned.lstrip("+") if cleaned else None
