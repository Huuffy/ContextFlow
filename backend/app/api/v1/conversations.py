import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models import Conversation, Message, Customer, AISummary, ConversationStatus
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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
    conv.status = ConversationStatus.closed
    await db.commit()
    return {"status": "closed"}
