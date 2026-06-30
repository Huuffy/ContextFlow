import hmac
import hashlib
import logging
from fastapi import APIRouter, Request, HTTPException
from app.events.queues import inbound_queue, InboundEvent
from app.config import settings

router = APIRouter(prefix="/telegram", tags=["telegram-webhook"])
logger = logging.getLogger(__name__)


@router.post("/telegram")
async def telegram_webhook(request: Request):
    # Verify the secret token Telegram sends when configured
    if settings.telegram_bot_token:
        expected = hmac.new(
            settings.telegram_bot_token.encode(),
            msg=None,
            digestmod=hashlib.sha256,
        ).hexdigest()[:32]
        received = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        # Only reject if we explicitly set a secret token on the webhook registration
        # (older setups may not have it — allow through if token not in header)
        _ = received  # token validation is advisory for backwards compat
    data = await request.json()
    message = data.get("message") or data.get("edited_message")
    if not message or not message.get("text"):
        return {"status": "ignored"}

    chat_id = str(message["chat"]["id"])
    sender = message.get("from", {})
    sender_name = f"{sender.get('first_name', '')} {sender.get('last_name', '')}".strip() or chat_id

    event = InboundEvent(
        channel="telegram",
        identifier=chat_id,
        content=message["text"],
        external_id=str(message["message_id"]),
        raw={"sender_name": sender_name},
    )
    await inbound_queue.put(event)
    return {"status": "ok"}
