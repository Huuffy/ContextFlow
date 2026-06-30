from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.session import get_db
from app.models import Customer, ChannelIdentifier, Transaction, UploadedDocument, Agent
from app.core.security import get_current_agent
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerOut(BaseModel):
    id: str
    display_name: str
    email: Optional[str]
    phone: Optional[str]
    created_at: datetime
    channels: list[dict] = []


class TransactionOut(BaseModel):
    id: str
    amount: float
    merchant_name: str
    merchant_category: str
    transaction_date: date


@router.get("", response_model=list[CustomerOut])
async def search_customers(
    search: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer)
    if search:
        query = query.where(
            or_(
                Customer.display_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
        )
    result = await db.execute(query.limit(50))
    customers = result.scalars().all()

    out = []
    for c in customers:
        ci_result = await db.execute(select(ChannelIdentifier).where(ChannelIdentifier.customer_id == c.id))
        channels = [{"channel": ci.channel.value, "identifier": ci.identifier} for ci in ci_result.scalars().all()]
        out.append(CustomerOut(id=c.id, display_name=c.display_name, email=c.email,
                               phone=c.phone, created_at=c.created_at, channels=channels))
    return out


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    ci_result = await db.execute(select(ChannelIdentifier).where(ChannelIdentifier.customer_id == c.id))
    channels = [{"channel": ci.channel.value, "identifier": ci.identifier} for ci in ci_result.scalars().all()]
    return CustomerOut(id=c.id, display_name=c.display_name, email=c.email,
                       phone=c.phone, created_at=c.created_at, channels=channels)


@router.get("/{customer_id}/transactions", response_model=list[TransactionOut])
async def get_transactions(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transaction).where(Transaction.customer_id == customer_id)
        .order_by(Transaction.transaction_date.desc()).limit(20)
    )
    return [TransactionOut(id=t.id, amount=float(t.amount), merchant_name=t.merchant_name,
                           merchant_category=t.merchant_category, transaction_date=t.transaction_date)
            for t in result.scalars().all()]


@router.get("/{customer_id}/identifiers")
async def get_identifiers(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChannelIdentifier).where(ChannelIdentifier.customer_id == customer_id))
    return [{"channel": ci.channel.value, "identifier": ci.identifier} for ci in result.scalars().all()]


@router.get("/{customer_id}/documents")
async def get_documents(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedDocument).where(UploadedDocument.customer_id == customer_id))
    return [
        {
            "id": d.id, "filename": d.filename, "file_type": d.file_type.value,
            "processed": d.processed, "chunk_count": d.chunk_count, "created_at": d.created_at.isoformat(),
        }
        for d in result.scalars().all()
    ]
