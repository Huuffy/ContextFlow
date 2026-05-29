import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Customer, ChannelIdentifier, ChannelType, Conversation, ConversationStatus
from app.events.queues import InboundEvent
import json

logger = logging.getLogger(__name__)

# In-memory cache: "channel:identifier" → (customer_id, conversation_id)
_cache: dict[str, tuple[str, str]] = {}


def _cache_key(channel: str, identifier: str) -> str:
    return f"{channel}:{identifier}"


def _normalize_identifier(channel: str, identifier: str) -> str:
    if channel == "whatsapp":
        # WhatsApp uses real phone numbers — normalize to +E.164
        id_ = identifier.strip().replace(" ", "").replace("-", "")
        if not id_.startswith("+") and id_.lstrip("0").isdigit():
            id_ = "+" + id_.lstrip("0")
        return id_
    if channel in ("telegram", "instagram"):
        # Telegram: numeric chat_id. Instagram: IGSID. Neither is a phone — keep as-is.
        return identifier.strip()
    if channel == "email":
        return identifier.strip().lower()
    return identifier.strip()


async def resolve_identity(event: InboundEvent, db: AsyncSession) -> tuple[str, str]:
    """Returns (customer_id, conversation_id). Creates new records if needed."""
    channel = event.channel
    identifier = _normalize_identifier(channel, event.identifier)
    cache_key = _cache_key(channel, identifier)

    if cache_key in _cache:
        return _cache[cache_key]

    customer_id = await _find_customer(channel, identifier, event, db)
    conversation_id = await _find_or_create_conversation(customer_id, channel, db)

    _cache[cache_key] = (customer_id, conversation_id)
    return customer_id, conversation_id


async def _find_customer(channel: str, identifier: str, event: InboundEvent, db: AsyncSession) -> str:
    # Step 1: Exact match on channel_identifiers
    result = await db.execute(
        select(ChannelIdentifier).where(
            ChannelIdentifier.channel == channel,
            ChannelIdentifier.identifier == identifier,
        )
    )
    ci = result.scalar_one_or_none()
    if ci:
        return ci.customer_id

    # Step 2: Cross-reference — email is the ONLY primary identifier across channels
    customer = None
    if channel == "email":
        result = await db.execute(select(Customer).where(Customer.email == identifier))
        customer = result.scalar_one_or_none()

    if customer:
        # Link this channel identifier
        ci = ChannelIdentifier(customer_id=customer.id, channel=channel, identifier=identifier)
        db.add(ci)
        return customer.id

    # Step 4: Create minimal customer profile
    display_name = event.raw.get("sender_name") or identifier
    customer = Customer(
        display_name=display_name,
        email=identifier if channel == "email" else None,
        phone=None,  # phone filled in later if customer provides it; email is primary
        metadata_json="{}",
    )
    db.add(customer)
    await db.flush()

    ci = ChannelIdentifier(customer_id=customer.id, channel=channel, identifier=identifier)
    db.add(ci)
    logger.info(f"Created new customer {customer.id} for {channel}:{identifier}")
    return customer.id


async def _find_or_create_conversation(customer_id: str, channel: str, db: AsyncSession) -> str:
    """Find open conversation for this customer, or create one."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.customer_id == customer_id,
            Conversation.status.in_([
                ConversationStatus.open,
                ConversationStatus.waiting,
                ConversationStatus.awaiting_acc_no,
            ]),
        ).order_by(Conversation.last_message_at.desc())
    )
    conv = result.scalars().first()
    if conv:
        # Update active channels
        channels = json.loads(conv.active_channels_json)
        if channel not in channels:
            channels.append(channel)
            conv.active_channels_json = json.dumps(channels)
        from datetime import datetime, timezone
        conv.last_message_at = datetime.now(timezone.utc)
        return conv.id

    from datetime import datetime, timezone
    conv = Conversation(
        customer_id=customer_id,
        status=ConversationStatus.open,
        active_channels_json=json.dumps([channel]),
        last_message_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    await db.flush()
    logger.info(f"Created new conversation {conv.id} for customer {customer_id}")
    return conv.id


def invalidate_cache(channel: str, identifier: str) -> None:
    _cache.pop(_cache_key(channel, identifier), None)
