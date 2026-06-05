import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models import (
    Conversation, Message, Customer, AISummary, ConversationStatus,
    ChannelIdentifier, MessageDirection,
)
from app.services.message_service import persist_system_message
from app.events.queues import outbound_queue, OutboundEvent
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

CLOSE_AUTO_REPLY = (
    "Thank you for contacting NeoBank Support! We hope you had a great experience. "
    "Your ticket has been closed. Feel free to reach out anytime — we're always here to help!"
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationOut(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    assigned_agent_id: Optional[str]
    status: str
    active_channels: list[str]
    topic: Optional[str]
    last_message_at: Optional[datetime]
    created_at: datetime
    one_liner: Optional[str] = None
    sentiment: Optional[str] = None
    unread_count: int = 0
    linked_account_number: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_type: str
    direction: str
    channel: str
    content: str
    status: str
    created_at: datetime


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    status: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Conversation).order_by(desc(Conversation.last_message_at))
    if status:
        query = query.where(Conversation.status == status)
    result = await db.execute(query)
    convs = result.scalars().all()

    out = []
    for conv in convs:
        # Get customer name
        cust_result = await db.execute(select(Customer).where(Customer.id == conv.customer_id))
        customer = cust_result.scalar_one_or_none()

        # Get latest AI summary one_liner
        sum_result = await db.execute(
            select(AISummary).where(AISummary.conversation_id == conv.id)
            .order_by(desc(AISummary.generated_at))
        )
        summary = sum_result.scalars().first()

        out.append(ConversationOut(
            id=conv.id,
            customer_id=conv.customer_id,
            customer_name=customer.display_name if customer else "Unknown",
            assigned_agent_id=conv.assigned_agent_id,
            status=conv.status.value,
            active_channels=json.loads(conv.active_channels_json),
            topic=conv.topic,
            last_message_at=conv.last_message_at,
            created_at=conv.created_at,
            one_liner=summary.one_liner if summary else None,
            sentiment=summary.sentiment.value if summary else None,
            linked_account_number=conv.linked_account_number,
        ))
    return out


@router.get("/{conv_id}", response_model=ConversationOut)
async def get_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    cust_result = await db.execute(select(Customer).where(Customer.id == conv.customer_id))
    customer = cust_result.scalar_one_or_none()

    sum_result = await db.execute(
        select(AISummary).where(AISummary.conversation_id == conv_id)
        .order_by(desc(AISummary.generated_at))
    )
    summary = sum_result.scalars().first()

    return ConversationOut(
        id=conv.id, customer_id=conv.customer_id,
        customer_name=customer.display_name if customer else "Unknown",
        assigned_agent_id=conv.assigned_agent_id,
        status=conv.status.value,
        active_channels=json.loads(conv.active_channels_json),
        topic=conv.topic, last_message_at=conv.last_message_at, created_at=conv.created_at,
        one_liner=summary.one_liner if summary else None,
        sentiment=summary.sentiment.value if summary else None,
        linked_account_number=conv.linked_account_number,
    )


@router.get("/{conv_id}/messages", response_model=list[MessageOut])
async def get_messages(conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
    )
    return [MessageOut(
        id=m.id, conversation_id=m.conversation_id,
        sender_type=m.sender_type.value, direction=m.direction.value,
        channel=m.channel, content=m.content, status=m.status.value,
        created_at=m.created_at,
    ) for m in result.scalars().all()]


@router.post("/{conv_id}/assign")
async def assign_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    conv.assigned_agent_id = "demo-agent"
    await db.commit()
    return {"status": "assigned", "agent_id": "demo-agent"}


@router.post("/{conv_id}/close")
async def close_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")

    # Send auto-reply to customer on their active channel before closing
    active_channels = json.loads(conv.active_channels_json or "[]")
    reply_channel = active_channels[0] if active_channels else None

    if reply_channel:
        ci_result = await db.execute(
            select(ChannelIdentifier).where(
                ChannelIdentifier.customer_id == conv.customer_id,
                ChannelIdentifier.channel == reply_channel,
            )
        )
        ci = ci_result.scalar_one_or_none()
        if not ci:
            # Fall back to any available identifier
            ci_result = await db.execute(
                select(ChannelIdentifier).where(ChannelIdentifier.customer_id == conv.customer_id)
            )
            ci = ci_result.scalars().first()
            if ci:
                reply_channel = ci.channel

        if ci:
            msg = await persist_system_message(
                content=CLOSE_AUTO_REPLY,
                channel=reply_channel,
                conversation_id=conv_id,
                db=db,
            )

            # Build email threading headers so the reply lands in the same Gmail thread
            email_subject = in_reply_to = references = None
            if reply_channel == "email":
                raw_subject = conv.topic or "NeoBank Support"
                email_subject = raw_subject if raw_subject.lower().startswith("re:") else f"Re: {raw_subject}"
                all_inbound = await db.execute(
                    select(Message)
                    .where(
                        Message.conversation_id == conv_id,
                        Message.channel == "email",
                        Message.direction == MessageDirection.inbound,
                    )
                    .order_by(Message.created_at.asc())
                )
                inbound_msgs = all_inbound.scalars().all()
                msg_ids = [m.external_id for m in inbound_msgs if m.external_id and "@" in m.external_id]
                if msg_ids:
                    in_reply_to = msg_ids[-1]
                    references = " ".join(msg_ids)

            await outbound_queue.put(OutboundEvent(
                channel=reply_channel,
                identifier=ci.identifier,
                content=CLOSE_AUTO_REPLY,
                message_id=msg.id,
                subject=email_subject,
                in_reply_to=in_reply_to,
                references=references,
            ))

            # Push auto-reply to the agent dashboard in real time
            from app.core.websocket import ws_manager
            await ws_manager.broadcast({
                "type": "message_new",
                "data": {
                    "message_id": msg.id,
                    "conversation_id": conv_id,
                    "customer_id": conv.customer_id,
                    "channel": reply_channel,
                    "content": CLOSE_AUTO_REPLY,
                    "sender_type": "system",
                    "direction": "outbound",
                },
            })

    conv.status = ConversationStatus.closed
    await db.commit()
    return {"status": "closed"}
