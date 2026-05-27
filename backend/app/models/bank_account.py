from sqlalchemy import String, Numeric, Date, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from datetime import date
from decimal import Decimal
from .base import Base, new_uuid


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    account_number: Mapped[str] = mapped_column(String, primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)
    account_type: Mapped[str] = mapped_column(String, default="savings")
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)

    transactions = relationship("AccountTransaction", back_populates="account", cascade="all, delete-orphan")


class AccountTransaction(Base):
    __tablename__ = "account_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    account_number: Mapped[str] = mapped_column(String, ForeignKey("bank_accounts.account_number"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    merchant_name: Mapped[str] = mapped_column(String, nullable=False)
    merchant_category: Mapped[str] = mapped_column(String, nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String, default="debit")  # credit / debit

    account = relationship("BankAccount", back_populates="transactions")
