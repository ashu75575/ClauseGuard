"""Persistent chat message storage."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models import ChatMessageModel

MAX_HISTORY_PER_DOC = 5


def add_message(
    db: Session,
    *,
    doc_id: str,
    role: str,
    content: str,
    citations: Optional[List[Dict[str, Any]]] = None,
) -> ChatMessageModel:
    message = ChatMessageModel(
        doc_id=doc_id,
        role=role,
        content=content,
        citations_json=citations or [],
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def list_messages(db: Session, doc_id: str) -> List[ChatMessageModel]:
    return (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.doc_id == doc_id)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc())
        .all()
    )


def get_history_for_prompt(db: Session, doc_id: str, limit: int = MAX_HISTORY_PER_DOC) -> str:
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.doc_id == doc_id)
        .order_by(ChatMessageModel.created_at.desc(), ChatMessageModel.id.desc())
        .limit(limit * 2)
        .all()
    )
    if not messages:
        return ""

    chronological = list(reversed(messages))
    lines = ["Previous questions and answers about this document:"]
    pending_q: Optional[str] = None
    for msg in chronological:
        if msg.role == "user":
            pending_q = msg.content
        elif msg.role == "assistant" and pending_q:
            lines.append(f"Q: {pending_q}")
            lines.append(f"A: {msg.content}")
            pending_q = None
    lines.append("")
    return "\n".join(lines)


def clear_messages(db: Session, doc_id: str) -> int:
    deleted = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.doc_id == doc_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted
