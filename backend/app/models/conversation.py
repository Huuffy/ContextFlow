from sqlalchemy import String, Enum as SAEnum, Integer, DateTime, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from datetime import datetime, timezone
from .base import Base, TimestampMixin, new_uuid, utcnow
import enum


class ConversationStatus(str, enum.Enum):
    open = "open"
    waiting = "waiting"
    awaiting_acc_no = "awaiting_acc_no"
    resolved = "resolved"
    closed = "closed"


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    assigned_agent_id: Mapped[str | None] = mapped_column(String, ForeignKey("agents.id"), nullable=True)
    status: Mapped[ConversationStatus] = mapped_column(SAEnum(ConversationStatus), default=ConversationStatus.open)
    active_channels_json: Mapped[str] = mapped_column(String, default="[]")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    topic: Mapped[str | None] = mapped_column(String, nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    linked_account_number: Mapped[str | None] = mapped_column(String, nullable=True)

    customer = relationship("Customer", back_populates="conversations")
    assigned_agent = relationship("Agent", back_populates="conversations", foreign_keys=[assigned_agent_id])
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    ai_summaries = relationship("AISummary", back_populates="conversation", cascade="all, delete-orphan")
