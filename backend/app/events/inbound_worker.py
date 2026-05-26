import asyncio
import logging
import re
from app.events.queues import InboundEvent, inbound_queue

logger = logging.getLogger(__name__)

# chat_id → customer_id for Telegram users waiting to provide their email
_awaiting_email: dict[str, str] = {}

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


async def run_inbound_worker(queue: asyncio.Queue[InboundEvent]) -> None:
    logger.info("Inbound worker started")
    while True:
        try:
            event = await queue.get()
            asyncio.create_task(_process(event))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Inbound worker error: {e}")


AUTO_REPLY_TEXT = (
    "Thank you for reaching out to NeoBank Support! "
    "Our team has received your message and will get back to you shortly.\n\n"
    "To opt out of this service, reply with just: opt out\n"
    "— NeoBank Support Team"
)

OPT_OUT_ACK = (
    "You have been successfully opted out. "
    "You will no longer receive marketing communications from NeoBank. "
    "If this was a mistake, please contact your branch. "
    "— NeoBank Support Team"
)


async def _process(event: InboundEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.services.identity_resolution import resolve_identity
    from app.services.message_service import persist_inbound_message, persist_system_message, is_first_message
    from app.core.websocket import ws_manager

    try:
        auto_reply_msg = None

        async with AsyncSessionLocal() as db:
            customer_id, conversation_id = await resolve_identity(event, db)

            # --- Opt-out detection: message is EXACTLY "opt out" (any channel) ---
            if event.content.strip().lower() == "opt out":
                await _handle_opt_out(event, customer_id, conversation_id, db)
                return

            # --- Cross-channel email linking (Telegram / Instagram / WhatsApp) ---
            if event.channel in ("telegram", "instagram", "whatsapp"):
                handled = await _handle_email_linking_flow(event, customer_id, conversation_id, db)
                if handled:
                    await db.commit()
                    return  # email reply consumed — don't persist as a normal message

            message = await persist_inbound_message(event, customer_id, conversation_id, db)

            # Ticket state machine: customer replied → re-open if waiting
            from app.models import Conversation, ConversationStatus
            from sqlalchemy import select as _select
            conv_result = await db.execute(_select(Conversation).where(Conversation.id == conversation_id))
            _conv = conv_result.scalar_one_or_none()
            if _conv and _conv.status == ConversationStatus.waiting:
                _conv.status = ConversationStatus.open

            # Auto-reply for email and telegram: first contact only, does NOT change status
            if event.channel in ("email", "telegram") and await is_first_message(conversation_id, db):
                auto_reply_msg = await persist_system_message(
                    AUTO_REPLY_TEXT, event.channel, conversation_id, db
                )

            await db.commit()

        asyncio.create_task(_embed_message(message.id, event.content, conversation_id, customer_id, event.channel))
        asyncio.create_task(_summarize(conversation_id))

        await ws_manager.broadcast({
            "type": "message_new",
            "data": {
                "message_id": message.id,
                "conversation_id": conversation_id,
                "customer_id": customer_id,
                "channel": event.channel,
                "content": event.content,
                "sender_type": "customer",
                "direction": "inbound",
            }
        })

        # Deliver auto-reply on the actual channel and broadcast to dashboard
        if auto_reply_msg:
            asyncio.create_task(_deliver_auto_reply(event.channel, event.identifier, AUTO_REPLY_TEXT, event.raw))
            await ws_manager.broadcast({
                "type": "message_new",
                "data": {
                    "message_id": auto_reply_msg.id,
                    "conversation_id": conversation_id,
                    "customer_id": customer_id,
                    "channel": event.channel,
                    "content": AUTO_REPLY_TEXT,
                    "sender_type": "system",
                    "direction": "outbound",
                }
            })

    except Exception as e:
        logger.error(f"Error processing inbound event: {e}", exc_info=True)


async def _handle_opt_out(event: InboundEvent, customer_id: str,
                           conversation_id: str, db) -> None:
    """Persist the opt-out message, add customer email to DNC, send ack, no status change."""
    from app.models import Customer, DNCEntry, IdentifierType
    from sqlalchemy import select as _select
    from app.services.message_service import persist_inbound_message, persist_system_message
    from app.core.websocket import ws_manager

    # Persist the "opt out" message so it's visible in the thread
    message = await persist_inbound_message(event, customer_id, conversation_id, db)

    # Find customer email and add to DNC
    cr = await db.execute(_select(Customer).where(Customer.id == customer_id))
    cust = cr.scalar_one_or_none()
    email_key = cust.email.lower() if cust and cust.email else None

    if email_key:
        existing = await db.execute(
            _select(DNCEntry).where(
                DNCEntry.identifier == email_key,
                DNCEntry.identifier_type == IdentifierType.email,
                DNCEntry.is_active == True,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(DNCEntry(identifier=email_key, identifier_type=IdentifierType.email, is_active=True))
            logger.info(f"Opt-out: added {email_key} to DNC list")

    # Persist ack as system message (no status change)
    ack_msg = await persist_system_message(OPT_OUT_ACK, event.channel, conversation_id, db)
    await db.commit()

    # Deliver ack on the channel
    asyncio.create_task(_deliver_auto_reply(event.channel, event.identifier, OPT_OUT_ACK, event.raw))

    # Broadcast both messages to dashboard
    await ws_manager.broadcast({
        "type": "message_new",
        "data": {
            "message_id": message.id,
            "conversation_id": conversation_id,
            "customer_id": customer_id,
            "channel": event.channel,
            "content": event.content,
            "sender_type": "customer",
            "direction": "inbound",
        }
    })
    await ws_manager.broadcast({
        "type": "message_new",
        "data": {
            "message_id": ack_msg.id,
            "conversation_id": conversation_id,
            "customer_id": customer_id,
            "channel": event.channel,
            "content": OPT_OUT_ACK,
            "sender_type": "system",
            "direction": "outbound",
        }
    })


async def _deliver_auto_reply(channel: str, identifier: str, text: str, raw: dict | None = None) -> None:
    try:
        if channel == "email":
            from app.integrations.email_client import send_email
            raw = raw or {}
            original_subject = raw.get("subject", "NeoBank Support")
            reply_subject = original_subject if original_subject.lower().startswith("re:") else f"Re: {original_subject}"
            in_reply_to = raw.get("message_id") or None
            await send_email(
                to=identifier,
                subject=reply_subject,
                body=text,
                in_reply_to=in_reply_to,
            )
        elif channel == "telegram":
            from app.integrations.telegram_client import send_telegram_message
            await send_telegram_message(identifier, text)
    except Exception as e:
        logger.error(f"Auto-reply delivery failed on {channel} to {identifier}: {e}")


async def _send_on_channel(channel: str, identifier: str, text: str) -> None:
    """Send a message back to the customer on whichever channel they used."""
    try:
        if channel == "telegram":
            from app.integrations.telegram_client import send_telegram_message
            await send_telegram_message(identifier, text)
        elif channel == "instagram":
            from app.integrations.instagram import send_instagram_message
            await send_instagram_message(identifier, text)
        elif channel == "whatsapp":
            from app.integrations.whatsapp import send_whatsapp_message
            await send_whatsapp_message(identifier, text)
    except Exception as e:
        logger.error(f"Failed to send linking prompt on {channel} to {identifier}: {e}")


async def _handle_email_linking_flow(event: InboundEvent, customer_id: str,
                                      conversation_id: str, db) -> bool:
    """
    For Telegram / Instagram / WhatsApp:
    - If the customer has no email and just sent a valid email address → link it.
    - If the customer has no email and this is their first message → ask for email.
    Returns True if the message was consumed as an email-linking reply.
    """
    from app.models import Customer
    from sqlalchemy import select

    identifier = event.identifier
    channel = event.channel
    content = event.content.strip()
    cache_key = f"{channel}:{identifier}"

    # Case 1: waiting for email reply
    if cache_key in _awaiting_email:
        if _EMAIL_RE.match(content.lower()):
            await _link_to_email(channel, identifier, customer_id, content.lower(), db)
            await _send_on_channel(channel, identifier,
                "Done! Your account is now linked. We can see your full support history.")
            del _awaiting_email[cache_key]
            return True
        else:
            await _send_on_channel(channel, identifier,
                "That doesn't look like a valid email. Please reply with your email address.")
            return True  # consume the bad attempt

    # Case 2: new customer with no email — ask once
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if customer and not customer.email:
        _awaiting_email[cache_key] = customer_id
        await _send_on_channel(channel, identifier,
            "Hi! To link your account and see your full support history, "
            "please reply with your email address.")
        # Fall through — still persist the original first message

    return False


async def _link_to_email(channel: str, identifier: str, current_customer_id: str,
                         email: str, db) -> None:
    """Link channel identifier to an existing email customer, or update current customer's email."""
    from app.models import Customer, ChannelIdentifier, Conversation
    from app.services.identity_resolution import invalidate_cache
    from sqlalchemy import select, update, delete

    result = await db.execute(select(Customer).where(Customer.email == email))
    existing = result.scalar_one_or_none()

    if existing and existing.id != current_customer_id:
        # Merge: reassign channel_identifier and all conversations to existing customer
        await db.execute(
            update(ChannelIdentifier)
            .where(ChannelIdentifier.channel == channel,
                   ChannelIdentifier.identifier == identifier)
            .values(customer_id=existing.id)
        )
        result = await db.execute(
            select(Conversation).where(Conversation.customer_id == current_customer_id)
        )
        for conv in result.scalars().all():
            conv.customer_id = existing.id

        await db.execute(delete(Customer).where(Customer.id == current_customer_id))
        invalidate_cache(channel, identifier)
        logger.info(f"Merged {channel}:{identifier} into existing customer {existing.id} ({email})")
    else:
        # No existing email customer — store email on current customer
        result = await db.execute(select(Customer).where(Customer.id == current_customer_id))
        customer = result.scalar_one_or_none()
        if customer:
            customer.email = email
            logger.info(f"Updated customer {current_customer_id} email to {email}")


async def _embed_message(message_id: str, content: str, conversation_id: str,
                          customer_id: str, channel: str) -> None:
    try:
        from app.ai.embedder import embed_async
        from app.db.lancedb_client import get_message_embeddings_table
        from datetime import datetime, timezone

        vector = await embed_async(content)
        table = get_message_embeddings_table()
        table.add([{
            "message_id": message_id,
            "conversation_id": conversation_id,
            "customer_id": customer_id,
            "content": content,
            "channel": channel,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "vector": vector,
        }])
    except Exception as e:
        logger.error(f"Embedding error for message {message_id}: {e}")


async def _summarize(conversation_id: str) -> None:
    try:
        from app.ai.summarizer import generate_summary
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await generate_summary(conversation_id, db)
    except Exception as e:
        logger.error(f"Summarization error for conversation {conversation_id}: {e}")
