"""Cross-document clause comparison."""

from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Optional

from openai import OpenAI
import os

from app.db.models import ReportModel
from app.services.embedder import embed_text

logger = logging.getLogger(__name__)


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _flags_from_report(report_json: dict, categories: Optional[List[str]] = None) -> List[dict]:
    flags = list(report_json.get("flags") or [])
    if categories:
        allowed = set(categories)
        flags = [f for f in flags if f.get("category") in allowed]
    return flags


def _pair_clauses(left: List[dict], right: List[dict], threshold: float = 0.55) -> List[dict]:
    if not left or not right:
        return []

    left_vecs = [embed_text(f.get("text") or "") for f in left]
    right_vecs = [embed_text(f.get("text") or "") for f in right]
    used_right = set()
    pairs = []

    for i, lf in enumerate(left):
        best_j = None
        best_score = threshold
        for j, rf in enumerate(right):
            if j in used_right:
                continue
            # Prefer same category when available
            score = _cosine(left_vecs[i], right_vecs[j])
            if lf.get("category") and lf.get("category") == rf.get("category"):
                score += 0.05
            if score > best_score:
                best_score = score
                best_j = j
        if best_j is None:
            continue
        used_right.add(best_j)
        pairs.append({"left": lf, "right": right[best_j], "similarity": round(min(best_score, 1.0), 4)})
    return pairs


def _llm_diff(left: dict, right: dict) -> str:
    raw_key = os.environ.get("GROQ_API_KEY")
    api_key = raw_key.strip().strip('"').strip("'") if raw_key else None
    if not api_key:
        return (
            f"Both clauses address {left.get('category', 'similar topics')}. "
            f"Left severity={left.get('severity')}; right severity={right.get('severity')}."
        )

    try:
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Compare two contract clauses in 1-2 plain-English sentences. "
                        "Focus on material differences in rights, obligations, and risk. "
                        "Return JSON: {\"difference_summary\": \"...\"}"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "left": {
                                "category": left.get("category"),
                                "severity": left.get("severity"),
                                "text": (left.get("text") or "")[:700],
                            },
                            "right": {
                                "category": right.get("category"),
                                "severity": right.get("severity"),
                                "text": (right.get("text") or "")[:700],
                            },
                        }
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        parsed = json.loads(response.choices[0].message.content.strip())
        return str(parsed.get("difference_summary") or "Material wording differences exist.")
    except Exception as e:
        logger.error("Comparison LLM failed: %s", e)
        return (
            f"Aligned on {left.get('category', 'topic')}; "
            f"severity differs ({left.get('severity')} vs {right.get('severity')})."
        )


def compare_documents(db, doc_ids: List[str], categories: Optional[List[str]] = None) -> dict:
    if len(doc_ids) < 2:
        raise ValueError("At least two document IDs are required")

    left_id, right_id = doc_ids[0], doc_ids[1]
    left_report = db.query(ReportModel).filter(ReportModel.doc_id == left_id).first()
    right_report = db.query(ReportModel).filter(ReportModel.doc_id == right_id).first()
    if not left_report or not right_report:
        raise ValueError("One or more documents have no cached report")

    left_flags = _flags_from_report(left_report.report_json or {}, categories)
    right_flags = _flags_from_report(right_report.report_json or {}, categories)
    raw_pairs = _pair_clauses(left_flags, right_flags)

    pairs = []
    for item in raw_pairs[:12]:
        left = item["left"]
        right = item["right"]
        pairs.append(
            {
                "category": left.get("category") or right.get("category") or "unknown",
                "similarity": item["similarity"],
                "left": {
                    "doc_id": left_id,
                    "chunk_id": left.get("chunk_id"),
                    "page": left.get("page", "unknown"),
                    "category": left.get("category"),
                    "severity": left.get("severity"),
                    "text": left.get("text") or "",
                    "heading": left.get("heading"),
                },
                "right": {
                    "doc_id": right_id,
                    "chunk_id": right.get("chunk_id"),
                    "page": right.get("page", "unknown"),
                    "category": right.get("category"),
                    "severity": right.get("severity"),
                    "text": right.get("text") or "",
                    "heading": right.get("heading"),
                },
                "difference_summary": _llm_diff(left, right),
            }
        )

    high_diffs = sum(1 for p in pairs if p["left"].get("severity") != p["right"].get("severity"))
    summary = (
        f"Compared {left_id[:8]}… and {right_id[:8]}… across {len(pairs)} aligned clause pairs. "
        f"{high_diffs} pairs show severity differences."
        if pairs
        else "No closely aligned flagged clauses were found between these documents."
    )

    return {
        "doc_ids": [left_id, right_id],
        "pairs": pairs,
        "summary": summary,
        "disclaimer": "AI-assisted clause comparison for information only. Not legal advice.",
    }
