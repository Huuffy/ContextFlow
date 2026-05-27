import json
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, timezone, timedelta
from app.db.session import get_db
from app.models import Conversation, Message, AISummary, ConversationStatus, DNCEntry

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0

    open_count = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == ConversationStatus.open)
    )).scalar() or 0

    waiting_count = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == ConversationStatus.waiting)
    )).scalar() or 0

    awaiting_count = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == ConversationStatus.awaiting_acc_no)
    )).scalar() or 0

    resolved_count = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == ConversationStatus.resolved)
    )).scalar() or 0

    closed_count = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.status == ConversationStatus.closed)
    )).scalar() or 0

    active_count = open_count + waiting_count + awaiting_count

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    resolved_today = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.status == ConversationStatus.resolved,
            Conversation.last_message_at >= today_start,
        )
    )).scalar() or 0

    resolved_this_week = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.status.in_([ConversationStatus.resolved, ConversationStatus.closed]),
            Conversation.last_message_at >= week_start,
        )
    )).scalar() or 0

    total_messages = (await db.execute(select(func.count(Message.id)))).scalar() or 0

    dnc_count = (await db.execute(
        select(func.count(DNCEntry.id)).where(DNCEntry.is_active == True)
    )).scalar() or 0

    # SLA breach: open/waiting tickets older than 24 hours
    sla_threshold = datetime.now(timezone.utc) - timedelta(hours=24)
    sla_breached = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.status.in_([ConversationStatus.open, ConversationStatus.waiting]),
            Conversation.created_at <= sla_threshold,
        )
    )).scalar() or 0

    channel_rows = (await db.execute(
        select(Message.channel, func.count(Message.id)).group_by(Message.channel)
    )).all()
    channel_breakdown = [{"channel": row[0], "count": row[1]} for row in channel_rows]

    # Last 14 days volume (conversations created per day)
    volume_by_day = []
    for i in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        count = (await db.execute(
            select(func.count(Conversation.id)).where(
                cast(Conversation.created_at, Date) == day
            )
        )).scalar() or 0
        volume_by_day.append({"date": str(day)[5:], "count": count})

    # Sentiment from AI summaries
    sentiment_rows = (await db.execute(
        select(AISummary.sentiment, func.count(AISummary.id)).group_by(AISummary.sentiment)
    )).all()
    sentiment_distribution = [{"sentiment": str(row[0].value) if hasattr(row[0], 'value') else str(row[0]), "count": row[1]} for row in sentiment_rows]

    # Status breakdown for donut chart
    status_breakdown = [
        {"status": "Open", "count": open_count, "color": "#0d9488"},
        {"status": "Awaiting Reply", "count": waiting_count, "color": "#f59e0b"},
        {"status": "Awaiting Acc No", "count": awaiting_count, "color": "#8b5cf6"},
        {"status": "Resolved", "count": resolved_count, "color": "#10b981"},
        {"status": "Closed", "count": closed_count, "color": "#9ca3af"},
    ]

    # Top complaint categories from key_issues_json
    all_summaries = (await db.execute(select(AISummary.key_issues_json))).scalars().all()
    issue_counts: dict[str, int] = {}
    for raw in all_summaries:
        if raw:
            try:
                issues = json.loads(raw)
                for issue in issues:
                    issue_counts[issue] = issue_counts.get(issue, 0) + 1
            except Exception:
                pass
    top_issues = sorted(
        [{"issue": k, "count": v} for k, v in issue_counts.items()],
        key=lambda x: x["count"], reverse=True
    )[:8]

    avg_response_minutes = await _calc_avg_response_minutes(db)
    resolution_rate = round((resolved_count / total * 100), 1) if total > 0 else 0.0

    return {
        "total_conversations": total,
        "active_conversations": active_count,
        "open_conversations": open_count,
        "waiting_conversations": waiting_count,
        "awaiting_acc_no": awaiting_count,
        "resolved_conversations": resolved_count,
        "closed_conversations": closed_count,
        "resolved_today": resolved_today,
        "resolved_this_week": resolved_this_week,
        "total_messages": total_messages,
        "dnc_count": dnc_count,
        "sla_breached": sla_breached,
        "resolution_rate": resolution_rate,
        "avg_response_minutes": avg_response_minutes,
        "channel_breakdown": channel_breakdown,
        "volume_by_day": volume_by_day,
        "sentiment_distribution": sentiment_distribution,
        "status_breakdown": status_breakdown,
        "top_issues": top_issues,
    }


async def _calc_avg_response_minutes(db: AsyncSession) -> float:
    conv_ids = (await db.execute(select(Conversation.id))).scalars().all()
    deltas = []
    for conv_id in conv_ids:
        first_in = (await db.execute(
            select(Message.created_at)
            .where(Message.conversation_id == conv_id, Message.direction == "inbound")
            .order_by(Message.created_at.asc()).limit(1)
        )).scalar_one_or_none()
        first_out = (await db.execute(
            select(Message.created_at)
            .where(Message.conversation_id == conv_id, Message.direction == "outbound")
            .order_by(Message.created_at.asc()).limit(1)
        )).scalar_one_or_none()
        if first_in and first_out and first_out > first_in:
            diff = (first_out - first_in).total_seconds() / 60
            deltas.append(diff)
    return round(sum(deltas) / len(deltas), 1) if deltas else 0.0
