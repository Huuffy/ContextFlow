import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class InboundEvent:
    channel: str          # whatsapp, instagram, email, telegram, simulator
    identifier: str       # sender's channel-specific ID (phone, email, IGSID, tg_id)
    content: str
    media_url: str | None = None
    external_id: str | None = None   # platform message ID
    raw: dict = field(default_factory=dict)


@dataclass
class OutboundEvent:
    channel: str
    identifier: str       # recipient's channel-specific ID
    content: str
    message_id: str       # DB message ID to update status on delivery
    media_url: str | None = None
    subject: str | None = None        # email: reply subject line
    in_reply_to: str | None = None    # email: Message-ID of the email being replied to
    references: str | None = None     # email: full chain of Message-IDs for References header


inbound_queue: asyncio.Queue[InboundEvent] = asyncio.Queue()
outbound_queue: asyncio.Queue[OutboundEvent] = asyncio.Queue()
