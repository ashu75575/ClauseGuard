"""SQLAlchemy models for the ClauseGuard legal workspace."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base, engine


def _utcnow() -> datetime:
    return datetime.utcnow()


class DocumentModel(Base):
    __tablename__ = "documents"

    doc_id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    status = Column(String, nullable=False, default="completed")  # processing|completed|failed
    error = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    section_count = Column(Integer, nullable=False, default=0)
    chunk_count = Column(Integer, nullable=False, default=0)
    flag_count = Column(Integer, nullable=False, default=0)
    overall_risk = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    report = relationship("ReportModel", back_populates="document", uselist=False, cascade="all, delete-orphan")
    messages = relationship("ChatMessageModel", back_populates="document", cascade="all, delete-orphan")
    obligations = relationship("ObligationModel", back_populates="document", cascade="all, delete-orphan")


class ReportModel(Base):
    __tablename__ = "reports"

    doc_id = Column(String, ForeignKey("documents.doc_id", ondelete="CASCADE"), primary_key=True, index=True)
    report_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    document = relationship("DocumentModel", back_populates="report")


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String, ForeignKey("documents.doc_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user|assistant|system
    content = Column(Text, nullable=False)
    citations_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    document = relationship("DocumentModel", back_populates="messages")


class ObligationModel(Base):
    __tablename__ = "obligations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    doc_id = Column(String, ForeignKey("documents.doc_id", ondelete="CASCADE"), nullable=False, index=True)
    party = Column(String, nullable=True)
    action = Column(Text, nullable=False)
    trigger = Column(Text, nullable=True)
    deadline = Column(String, nullable=True)
    period = Column(String, nullable=True)
    recurrence = Column(String, nullable=True)
    consequence = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="unconfirmed")  # unconfirmed|confirmed|completed|dismissed
    source_chunk_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    document = relationship("DocumentModel", back_populates="obligations")


def init_db() -> None:
    """Create tables if they do not exist (safe for fresh installs)."""
    Base.metadata.create_all(bind=engine)
