import asyncio
import logging
from app.events.queues import OutboundEvent

logger = logging.getLogger(__name__)


async def run_outbound_worker(queue: asyncio.Queue[OutboundEvent]) -> None:
    logger.info("Outbound worker started")
    while True:
        try:
            event = await queue.get()
            asyncio.create_task(_deliver(event))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Outbound worker error: {e}")


async def _deliver(event: OutboundEvent) -> None:
    from app.db.session import AsyncSessionLocal
    from app.models import Message, MessageStatus
    from sqlalchemy import select

    try:
        success = await _send_via_channel(event)
        status = MessageStatus.delivered if success else MessageStatus.failed

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Message).where(Message.id == event.message_id))
            msg = result.scalar_one_or_none()
            if msg:
                msg.status = status
                await db.commit()
    except Exception as e:
        logger.error(f"Delivery error for message {event.message_id}: {e}", exc_info=True)


async def _send_via_channel(event: OutboundEvent) -> bool:
    channel = event.channel
    try:
        if channel == "email":
            from app.integrations.email_client import send_email
            await send_email(
                to=event.identifier,
                subject=event.subject or "Re: NeoBank Support",
                body=event.content,
                in_reply_to=event.in_reply_to,
                references=event.references,
            )
        elif channel == "telegram":
            from app.integrations.telegram_client import send_telegram_message
            await send_telegram_message(chat_id=event.identifier, text=event.content)
        elif channel == "whatsapp":
            from app.integrations.whatsapp import send_whatsapp_message
            await send_whatsapp_message(to=event.identifier, text=event.content)
        elif channel == "instagram":
            from app.integrations.instagram import send_instagram_message
            await send_instagram_message(igsid=event.identifier, text=event.content)
        elif channel == "simulator":
            logger.info(f"[SIMULATOR] → {event.identifier}: {event.content}")
        else:
            logger.warning(f"Unknown channel: {channel}")
            return False
        return True
    except Exception as e:
        logger.error(f"Channel send error ({channel}): {e}")
        return False
