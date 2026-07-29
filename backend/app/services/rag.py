"""RAG question answering grounded in document clauses with persistent chat history."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from app.db.models import ReportModel
from app.services.chat_store import add_message, get_history_for_prompt
from app.services.embedder import embed_text
from app.services.vector_db import get_chunks_by_doc, query_similar

logger = logging.getLogger(__name__)

TOP_K = 8
MAX_RETRIES = 3
MAX_CONTEXT_CHARS = 28000

CATEGORY_ALIASES = {
    "termination": ("terminate", "termination", "cancel", "cancellation", "notice period"),
    "payment": ("payment", "pay", "fee", "fees", "price", "invoice", "billing"),
    "liability": ("liability", "liable", "damages", "indemnity", "indemnification"),
    "confidentiality": ("confidential", "confidentiality", "non-disclosure", "nda"),
    "intellectual_property": ("intellectual property", "copyright", "trademark", "ownership", " ip "),
    "dispute_resolution": ("dispute", "arbitration", "court", "jurisdiction", "governing law"),
    "renewal": ("renew", "renewal", "auto-renew", "extension"),
    "data_privacy": ("privacy", "personal data", "data protection", "gdpr"),
}

SUMMARY_PATTERN = re.compile(
    r"\b(summar(?:y|ize|ise)|overview|key points|main points|what is this (?:document|contract|agreement) about)\b",
    re.IGNORECASE,
)
HELP_PATTERN = re.compile(
    r"\b(what can you do|how can you help|where can (?:ai|you) help|help me use)\b",
    re.IGNORECASE,
)

_llm_client: Optional[OpenAI] = None

SYSTEM_PROMPT = """You are ClauseGuard, a precise and conversational legal-document assistant.
You will receive a saved legal analysis, source clauses, recent conversation, and the user's question.

Rules:
1. Answer document-specific factual claims STRICTLY from the supplied analysis and source clauses.
2. For summaries, synthesize the supplied document content and clearly distinguish key terms, risks, and actions.
3. For risk questions, explain the practical effect, why it matters, and a sensible next step without pretending to be the user's lawyer.
4. If the document does not contain the requested fact, say that clearly. Do not invent it.
5. If the request is ambiguous, ask one focused clarifying question instead of refusing.
6. Cite only chunk_id values present in SOURCE CLAUSES. Put them in the citations array; do not print raw chunk IDs in the answer text.
   Every material document claim should be cited when source clauses are available.
7. Use the recent conversation to understand follow-ups. Do not repeat an earlier generic refusal.
8. Write in plain English with short paragraphs or bullets where useful.
9. Offer 2-3 useful follow-up questions grounded in topics that are actually available.

Output your response as a valid JSON object with this schema:
{
  "status": "answered | not_found | needs_clarification",
  "answer_type": "document_summary | risk_analysis | grounded_answer | clarification | capability",
  "answer": "Your detailed answer...",
  "citations": [
    {"chunk_id": "...", "page": ...}
  ],
  "follow_ups": ["...", "..."]
}"""


def _get_llm_client() -> Optional[OpenAI]:
    global _llm_client
    if _llm_client is not None:
        return _llm_client

    raw_key = os.environ.get("GROQ_API_KEY")
    api_key = raw_key.strip().strip('"').strip("'") if raw_key else None
    if not api_key:
        logger.warning("GROQ_API_KEY not set — RAG answering disabled.")
        return None

    _llm_client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    return _llm_client


def _filter_by_relevance(chunks: List[dict]) -> List[dict]:
    """Keep useful dense matches without making a brittle score a hard gate."""
    ranked = sorted(chunks, key=lambda item: float(item.get("similarity", 0.0)), reverse=True)
    strong = [item for item in ranked if float(item.get("similarity", 0.0)) >= 0.18]
    return (strong or ranked[:4])[:5]


def _build_context(chunks: List[dict]) -> str:
    blocks = []
    used = 0
    for chunk in chunks:
        meta_parts = [
            f"CHUNK_ID: {chunk['chunk_id']}",
            f"DOC_ID: {chunk.get('doc_id', 'unknown')}",
            f"PAGE: {chunk.get('page', 'unknown')}",
            f"HEADING: {chunk.get('heading', 'unknown')}",
            f"CATEGORY: {chunk.get('category', 'unknown')}",
            f"SEVERITY: {chunk.get('severity', 'unknown')}",
            f"RELEVANCE: {chunk.get('similarity', 'N/A')}",
        ]
        header = " | ".join(meta_parts)
        block = f"--- {header} ---\n{chunk['text']}\n"
        if used + len(block) > MAX_CONTEXT_CHARS:
            break
        blocks.append(block)
        used += len(block)
    return "\n".join(blocks)


def _question_category(question: str) -> Optional[str]:
    padded = f" {question.lower()} "
    for category, aliases in CATEGORY_ALIASES.items():
        if any(alias in padded for alias in aliases):
            return category
    return None


def _question_intent(question: str) -> str:
    if HELP_PATTERN.search(question):
        return "capability"
    if SUMMARY_PATTERN.search(question):
        return "document_summary"
    if _question_category(question):
        return "risk_analysis"
    words = re.findall(r"[a-z0-9']+", question.lower())
    if len(words) <= 6 and any(term in words for term in ("this", "that", "it", "legit", "okay", "safe")):
        return "clarification"
    return "grounded_answer"


def _report_chunks(report: Dict[str, Any]) -> List[dict]:
    chunks = []
    for flag in report.get("flags") or []:
        if not isinstance(flag, dict) or not flag.get("chunk_id") or not flag.get("text"):
            continue
        chunks.append(
            {
                "chunk_id": flag["chunk_id"],
                "doc_id": report.get("doc_id"),
                "text": flag["text"],
                "page": flag.get("page", "unknown"),
                "heading": flag.get("heading"),
                "category": flag.get("category"),
                "severity": flag.get("severity"),
                "similarity": 1.0,
            }
        )
    return chunks


def _dedupe_chunks(chunks: List[dict]) -> List[dict]:
    seen = set()
    result = []
    for chunk in chunks:
        chunk_id = chunk.get("chunk_id")
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(chunk_id)
        result.append(chunk)
    return result


def _clean_answer(answer: Any) -> str:
    """Keep source identifiers in structured citations, not prose."""
    text = str(answer or "").strip()
    text = re.sub(r"\s*\((?:source\s+)?chunk(?:_id|\s+id)?\s*:\s*[^)]+\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\[(?:source\s+)?chunk(?:_id|\s+id)?\s*:\s*[^\]]+\]", "", text, flags=re.IGNORECASE)
    return text.strip()


def _report_context(report: Dict[str, Any]) -> str:
    priorities = report.get("review_priorities") or []
    obligations = report.get("obligations") or []
    playbook = report.get("negotiation_playbook") or []
    return json.dumps(
        {
            "executive_summary": report.get("executive_summary"),
            "overall_risk": report.get("overall_risk"),
            "review_priorities": priorities[:8],
            "obligations": obligations[:10],
            "negotiation_playbook": playbook[:8],
        },
        ensure_ascii=False,
        default=str,
    )


def _default_follow_ups(report: Dict[str, Any], category: Optional[str] = None) -> List[str]:
    suggested = [
        str(item).strip()
        for item in (report.get("suggested_questions") or [])
        if isinstance(item, str) and item.strip()
    ]
    if category:
        label = category.replace("_", " ")
        suggested = [
            f"What should I negotiate in the {label} clause?",
            f"Show me the source language for the {label} risk.",
        ] + suggested
    if not suggested:
        categories = [
            str(item.get("category")).replace("_", " ")
            for item in (report.get("flags") or [])
            if isinstance(item, dict) and item.get("category")
        ]
        suggested = [f"What are the key {category_name} risks?" for category_name in dict.fromkeys(categories)]
    return list(dict.fromkeys(suggested))[:3]


def _capability_response(report: Dict[str, Any]) -> dict:
    topics = [
        str(item.get("category")).replace("_", " ")
        for item in (report.get("flags") or [])
        if isinstance(item, dict) and item.get("category")
    ]
    topic_text = ", ".join(list(dict.fromkeys(topics))[:5])
    answer = (
        "I can summarize this agreement, explain risky clauses in plain English, identify obligations "
        "and deadlines, suggest negotiation positions, and answer follow-up questions with source citations."
    )
    if topic_text:
        answer += f"\n\nFor this document, useful areas to inspect include: {topic_text}."
    return {
        "status": "answered",
        "answer_type": "capability",
        "answer": answer,
        "citations": [],
        "follow_ups": _default_follow_ups(report),
    }


def _clarification_response(report: Dict[str, Any], question: str) -> dict:
    return {
        "status": "needs_clarification",
        "answer_type": "clarification",
        "answer": (
            f"I’m not sure what “{question.strip()}” refers to. "
            "Do you want me to assess a specific clause, the agreement’s overall risk, or whether a particular term is unusual?"
        ),
        "citations": [],
        "follow_ups": _default_follow_ups(report)
        or ["Summarize this agreement.", "What are the highest-risk clauses?"],
    }


def _call_llm_with_retry(system_prompt: str, user_prompt: str) -> dict:
    client = _get_llm_client()
    if client is None:
        return {"answer": "Error: GROQ_API_KEY not configured.", "citations": [], "follow_ups": []}

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("LLM returned invalid JSON (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            last_error = e
        except Exception as e:
            logger.error("LLM call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            last_error = e
            error_str = str(e).lower()
            if "401" in error_str or "invalid_api_key" in error_str or "authentication" in error_str:
                break

    return {
        "answer": f"Error generating answer after {MAX_RETRIES} attempts: {type(last_error).__name__}",
        "citations": [],
        "follow_ups": [],
    }


def _validate_citations(citations: Any, chunks: List[dict]) -> List[dict]:
    by_id = {c["chunk_id"]: c for c in chunks}
    valid = []
    if not isinstance(citations, list):
        return valid
    for item in citations:
        if not isinstance(item, dict):
            continue
        chunk_id = item.get("chunk_id")
        if chunk_id in by_id:
            valid.append(
                {
                    "chunk_id": chunk_id,
                    "page": by_id[chunk_id].get("page", item.get("page", "unknown")),
                }
            )
    return valid


def answer_question(
    doc_id: str,
    question: str,
    *,
    db: Optional[Session] = None,
    doc_ids: Optional[List[str]] = None,
) -> dict:
    """
    Route the request, combine persisted analysis with source clauses, and answer.
    When db is provided, conversation history is loaded/saved persistently.
    """
    scope_ids = doc_ids or [doc_id]
    report: Dict[str, Any] = {}
    if db is not None:
        report_row = db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
        if report_row and isinstance(report_row.report_json, dict):
            report = dict(report_row.report_json)
    report.setdefault("doc_id", doc_id)

    intent = _question_intent(question)
    category = _question_category(question)
    if intent == "capability":
        result = _capability_response(report)
    elif intent == "clarification":
        result = _clarification_response(report, question)
    else:
        history_context = get_history_for_prompt(db, doc_id) if db is not None else ""
        retrieval_query = question
        if len(question.split()) <= 8 and history_context:
            retrieval_query = f"{history_context[-1200:]}\nFollow-up question: {question}"

        dense_chunks: List[dict] = []
        try:
            question_vector = embed_text(retrieval_query)
            dense_chunks = query_similar(
                doc_id=scope_ids[0] if len(scope_ids) == 1 else None,
                query_vector=question_vector,
                top_k=TOP_K,
                doc_ids=scope_ids if len(scope_ids) > 1 else None,
                per_doc_limit=3 if len(scope_ids) > 1 else None,
            )
        except Exception as exc:
            logger.warning("Dense retrieval failed for %s; using report fallback: %s", doc_id, exc)

        flagged_chunks = _report_chunks(report)
        all_chunks: List[dict] = []
        if intent == "document_summary":
            try:
                for scope_id in scope_ids:
                    all_chunks.extend(get_chunks_by_doc(scope_id))
            except Exception as exc:
                logger.warning("Full-document retrieval failed for %s: %s", doc_id, exc)

        if category:
            category_chunks = [
                chunk
                for chunk in flagged_chunks
                if str(chunk.get("category") or "").lower() == category
            ]
        else:
            category_chunks = []

        if intent == "document_summary":
            evidence = _dedupe_chunks(all_chunks[:18] + flagged_chunks + _filter_by_relevance(dense_chunks))
        elif intent == "risk_analysis":
            evidence = _dedupe_chunks(category_chunks + _filter_by_relevance(dense_chunks) + flagged_chunks[:3])
        else:
            evidence = _dedupe_chunks(_filter_by_relevance(dense_chunks) + flagged_chunks[:3])

        if not evidence and report.get("executive_summary") and intent == "document_summary":
            result = {
                "status": "answered",
                "answer_type": "document_summary",
                "answer": str(report["executive_summary"]),
                "citations": [],
                "follow_ups": _default_follow_ups(report),
            }
        elif not evidence:
            result = {
                "status": "not_found",
                "answer_type": "grounded_answer",
                "answer": (
                    "I couldn’t find that information in the analyzed document. "
                    "If you name a clause or topic, I can check it more precisely."
                ),
                "citations": [],
                "follow_ups": _default_follow_ups(report),
            }
        else:
            user_prompt = (
                f"REQUEST TYPE: {intent}\n"
                f"SAVED LEGAL ANALYSIS:\n{_report_context(report)}\n\n"
            )
            if history_context:
                user_prompt += f"{history_context}\n"
            user_prompt += f"SOURCE CLAUSES:\n{_build_context(evidence)}\n\nUSER QUESTION: {question}"
            raw = _call_llm_with_retry(SYSTEM_PROMPT, user_prompt)
            allowed_statuses = {"answered", "not_found", "needs_clarification"}
            status = str(raw.get("status") or "answered")
            if status not in allowed_statuses:
                status = "answered"
            answer_type = str(raw.get("answer_type") or intent)
            allowed_answer_types = {
                "document_summary",
                "risk_analysis",
                "grounded_answer",
                "clarification",
                "capability",
            }
            if answer_type not in allowed_answer_types:
                answer_type = intent if intent in allowed_answer_types else "grounded_answer"
            if status == "needs_clarification":
                answer_type = "clarification"
            elif status == "not_found":
                answer_type = "grounded_answer"
            follow_ups = [
                str(item).strip()
                for item in (raw.get("follow_ups") or [])
                if isinstance(item, str) and item.strip()
            ][:3]
            result = {
                "status": status,
                "answer_type": answer_type,
                "answer": _clean_answer(raw.get("answer")),
                "citations": _validate_citations(raw.get("citations"), evidence),
                "follow_ups": follow_ups or _default_follow_ups(report, category),
            }
            if not result["answer"]:
                result["status"] = "not_found"
                result["answer"] = "I couldn’t produce a grounded answer from this document."

    message_id = None
    if db is not None:
        add_message(db, doc_id=doc_id, role="user", content=question)
        assistant = add_message(
            db,
            doc_id=doc_id,
            role="assistant",
            content=result["answer"],
            citations=result["citations"],
        )
        message_id = assistant.id

    result["message_id"] = message_id
    return result
