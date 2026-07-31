from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


Severity = Literal["high", "medium", "low"]
ObligationStatus = Literal["unconfirmed", "confirmed", "completed", "dismissed"]


class IngestResponse(BaseModel):
    doc_id: str
    sections: List[Any] = Field(default_factory=list)


class AskRequest(BaseModel):
    doc_id: str
    question: str
    doc_ids: Optional[List[str]] = None


class Citation(BaseModel):
    chunk_id: str
    page: Union[int, str] = "unknown"


class ClauseFlag(BaseModel):
    chunk_id: str
    text: str
    page: Union[int, str] = "unknown"
    heading: Optional[str] = None
    category: str
    severity: Severity
    confidence: float = 0.0
    explanation: str = ""


class ReviewPriority(BaseModel):
    title: str
    rationale: str
    action: str
    severity: Severity = "medium"
    category: Optional[str] = None
    source_chunk_ids: List[str] = Field(default_factory=list)


class NegotiationItem(BaseModel):
    category: str
    severity: Severity
    primary_ask: str
    fallback: str
    rationale: str
    suggested_language: str
    source_chunk_ids: List[str] = Field(default_factory=list)


class ObligationOut(BaseModel):
    id: Optional[int] = None
    doc_id: Optional[str] = None
    party: Optional[str] = None
    action: str
    trigger: Optional[str] = None
    deadline: Optional[str] = None
    period: Optional[str] = None
    recurrence: Optional[str] = None
    consequence: Optional[str] = None
    confidence: Optional[float] = None
    status: ObligationStatus = "unconfirmed"
    source_chunk_ids: List[str] = Field(default_factory=list)


class CategoryBreakdownItem(BaseModel):
    category: str
    count: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class PartyBreakdownItem(BaseModel):
    party: str
    count: int = 0


class DashboardStats(BaseModel):
    flag_count: int = 0
    priority_count: int = 0
    obligation_count: int = 0
    playbook_count: int = 0
    section_count: int = 0
    chunk_count: int = 0
    avg_confidence: Optional[float] = None
    severity_summary: Dict[str, int] = Field(
        default_factory=lambda: {"high": 0, "medium": 0, "low": 0}
    )
    obligation_status: Dict[str, int] = Field(
        default_factory=lambda: {
            "unconfirmed": 0,
            "confirmed": 0,
            "completed": 0,
            "dismissed": 0,
        }
    )
    category_breakdown: List[CategoryBreakdownItem] = Field(default_factory=list)
    parties: List[PartyBreakdownItem] = Field(default_factory=list)


class StructuredReport(BaseModel):
    doc_id: str
    flags: List[ClauseFlag] = Field(default_factory=list)
    executive_summary: str = ""
    overall_risk: Severity = "low"
    review_priorities: List[ReviewPriority] = Field(default_factory=list)
    obligations: List[ObligationOut] = Field(default_factory=list)
    negotiation_playbook: List[NegotiationItem] = Field(default_factory=list)
    suggested_questions: List[str] = Field(default_factory=list)
    analyzed_at: Optional[str] = None
    model: Optional[str] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    section_count: int = 0
    chunk_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    dashboard: Optional[DashboardStats] = None
    disclaimer: str = (
        "AI-assisted legal review for information only. Not legal advice. "
        "Verify all findings against the source document before relying on them."
    )


class DocumentSummary(BaseModel):
    doc_id: str
    filename: str
    content_type: Optional[str] = None
    status: str
    error: Optional[str] = None
    section_count: int = 0
    chunk_count: int = 0
    flag_count: int = 0
    overall_risk: Optional[str] = None
    severity_summary: Dict[str, int] = Field(default_factory=lambda: {"high": 0, "medium": 0, "low": 0})
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DocumentDetail(DocumentSummary):
    report: Optional[StructuredReport] = None


class ChatMessageOut(BaseModel):
    id: int
    doc_id: str
    role: str
    content: str
    citations: List[Citation] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class AskResponse(BaseModel):
    status: Literal["answered", "not_found", "needs_clarification"] = "answered"
    answer_type: Literal[
        "document_summary",
        "risk_analysis",
        "grounded_answer",
        "clarification",
        "capability",
    ] = "grounded_answer"
    answer: str
    citations: List[Citation] = Field(default_factory=list)
    message_id: Optional[int] = None
    follow_ups: List[str] = Field(default_factory=list)


class ObligationUpdateRequest(BaseModel):
    status: ObligationStatus


class CompareRequest(BaseModel):
    doc_ids: List[str] = Field(min_length=2)
    categories: Optional[List[str]] = None


class ComparedClause(BaseModel):
    doc_id: str
    chunk_id: str
    page: Union[int, str] = "unknown"
    category: Optional[str] = None
    severity: Optional[Severity] = None
    text: str
    heading: Optional[str] = None


class ComparisonPair(BaseModel):
    category: str
    similarity: float
    left: ComparedClause
    right: ComparedClause
    difference_summary: str


class ComparisonResult(BaseModel):
    doc_ids: List[str]
    pairs: List[ComparisonPair] = Field(default_factory=list)
    summary: str = ""
    disclaimer: str = (
        "AI-assisted clause comparison for information only. Not legal advice."
    )


class StatusResponse(BaseModel):
    doc_id: str
    status: str
    filename: Optional[str] = None
    error: Optional[str] = None
    flags: Optional[int] = None
