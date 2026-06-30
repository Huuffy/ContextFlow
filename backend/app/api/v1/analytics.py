import json
import calendar
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, timezone, timedelta
from app.db.session import get_db
from app.models import Conversation, Message, AISummary, ConversationStatus, DNCEntry, Agent, Customer
from app.core.security import get_current_agent

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

    # Last 12 months volume (conversations created per month)
    now = datetime.now(timezone.utc)
    volume_by_month = []
    for i in range(11, -1, -1):
        total_months = now.year * 12 + now.month - 1 - i
        year = total_months // 12
        month = total_months % 12 + 1
        month_start = datetime(year, month, 1, tzinfo=timezone.utc)
        last_day = calendar.monthrange(year, month)[1]
        month_end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        count = (await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.created_at >= month_start,
                Conversation.created_at <= month_end,
            )
        )).scalar() or 0
        volume_by_month.append({"month": month_start.strftime("%b '%y"), "count": count})

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
        "volume_by_month": volume_by_month,
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


@router.get("/agent-workload")
async def agent_workload(db: AsyncSession = Depends(get_db)):
    """Agent workload: assigned ticket counts + list of unassigned open/waiting tickets."""
    active_statuses = [ConversationStatus.open, ConversationStatus.waiting]

    # Per-agent ticket counts (open + waiting only)
    agents = (await db.execute(select(Agent).where(Agent.is_active == True))).scalars().all()
    agent_rows = []
    for agent in agents:
        count = (await db.execute(
            select(func.count(Conversation.id)).where(
                Conversation.assigned_agent_id == agent.id,
                Conversation.status.in_(active_statuses),
            )
        )).scalar() or 0
        agent_rows.append({
            "id": agent.id,
            "name": agent.full_name,
            "email": agent.email,
            "role": agent.role.value if hasattr(agent.role, "value") else str(agent.role),
            "active_tickets": count,
        })

    # Unassigned open/waiting conversations
    unassigned_convs = (await db.execute(
        select(Conversation).where(
            Conversation.assigned_agent_id == None,  # noqa: E711
            Conversation.status.in_(active_statuses),
        ).order_by(Conversation.created_at.asc())
    )).scalars().all()

    unassigned = []
    for conv in unassigned_convs:
        customer = (await db.execute(
            select(Customer).where(Customer.id == conv.customer_id)
        )).scalar_one_or_none()
        unassigned.append({
            "id": conv.id,
            "topic": conv.topic,
            "status": conv.status.value if hasattr(conv.status, "value") else str(conv.status),
            "customer_name": customer.display_name if customer else "Unknown",
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
        })

    return {
        "agents": sorted(agent_rows, key=lambda x: x["active_tickets"], reverse=True),
        "unassigned": unassigned,
    }
