import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import Conversation, ConversationStatus, Customer, ChannelIdentifier, MessageStatus, Message, MessageDirection
from app.services.message_service import persist_outbound_message
from app.events.queues import outbound_queue, OutboundEvent
from pydantic import BaseModel

router = APIRouter(prefix="/messages", tags=["messages"])


class SendMessageRequest(BaseModel):
    conversation_id: str
    content: str
    channel: str  # which channel to send on


@router.post("/send")
async def send_message(body: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    # Fetch conversation + customer
    result = await db.execute(select(Conversation).where(Conversation.id == body.conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get customer's identifier for the target channel
    ci_result = await db.execute(
        select(ChannelIdentifier).where(
            ChannelIdentifier.customer_id == conv.customer_id,
            ChannelIdentifier.channel == body.channel,
        )
    )
    ci = ci_result.scalar_one_or_none()
    if not ci:
        # Use the first available channel
        ci_result = await db.execute(
            select(ChannelIdentifier).where(ChannelIdentifier.customer_id == conv.customer_id)
        )
        ci = ci_result.scalars().first()
    if not ci:
        raise HTTPException(status_code=400, detail="No channel identifier found for customer")

    # DNC check — block if customer's email is on the DNC list
    from app.api.v1.compliance import is_customer_blocked
    if await is_customer_blocked(conv.customer_id, db):
        raise HTTPException(status_code=403, detail="Customer is on the Do Not Contact list")

    # Persist outbound message
    msg = await persist_outbound_message(
        content=body.content,
        channel=body.channel,
        conversation_id=body.conversation_id,
        agent_id=None,
        db=db,
    )

    # Ticket state machine: agent replied → awaiting customer response
    if conv.status == ConversationStatus.open:
        conv.status = ConversationStatus.waiting

    await db.commit()

    # For email: build reply threading metadata
    email_subject: str | None = None
    in_reply_to: str | None = None
    references: str | None = None
    if body.channel == "email":
        # Use stored email subject so the reply lands in the same Gmail thread
        raw_subject = conv.topic or "NeoBank Support"
        email_subject = raw_subject if raw_subject.lower().startswith("re:") else f"Re: {raw_subject}"
        # Collect all inbound Message-IDs in chronological order for References header
        all_inbound = await db.execute(
            select(Message)
            .where(
                Message.conversation_id == body.conversation_id,
                Message.channel == "email",
                Message.direction == MessageDirection.inbound,
            )
            .order_by(Message.created_at.asc())
        )
        inbound_msgs = all_inbound.scalars().all()
        msg_ids = [m.external_id for m in inbound_msgs if m.external_id and "@" in m.external_id]
        if msg_ids:
            in_reply_to = msg_ids[-1]       # reply to the most recent inbound
            references = " ".join(msg_ids)  # full chain for References header

    # Enqueue for delivery
    await outbound_queue.put(OutboundEvent(
        channel=body.channel,
        identifier=ci.identifier,
        content=body.content,
        message_id=msg.id,
        subject=email_subject,
        in_reply_to=in_reply_to,
        references=references,
    ))

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_type": msg.sender_type.value,
        "direction": msg.direction.value,
        "channel": msg.channel,
        "content": msg.content,
        "status": msg.status.value,
        "created_at": msg.created_at.isoformat(),
    }
