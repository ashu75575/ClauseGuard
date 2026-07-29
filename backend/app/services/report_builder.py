"""
Report Builder – Batch classify + explain in a single LLM call.

Instead of:
  1. Classify each chunk with zero-shot BART (~2s × 50 = 100s)
  2. Explain each flagged chunk with LLM (~4s × 15 = 60s)

We now:
  1. Send ALL chunks to the LLM in ONE call (~5-8s total)
  2. LLM returns category + severity + explanation for each
  3. Fall back to local classifier if the LLM is unavailable

This cuts report generation from ~160s to ~8-10s (~15-20× faster).
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional

from openai import OpenAI

from app.services.vector_db import get_chunks_by_doc, update_chunk_metadata
from app.services.classifier import classify_chunk, CATEGORIES as CLASSIFIER_CATEGORIES
from app.domain.playbooks import playbook_for_category

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"high": 1, "medium": 2, "low": 3}

# Categories the LLM should classify into — expanded from the original 6
RISK_CATEGORIES = [
    "auto_renewal",
    "liability",
    "arbitration",
    "data_sharing",
    "termination",
    "penalty",
    "indemnification",
    "intellectual_property",
    "confidentiality",
    "non_compete",
    "payment_terms",
    "force_majeure",
    "none",
]

# Maximum chunks per LLM batch call to stay within context limits
MAX_CHUNKS_PER_BATCH = 25

# --- Singleton LLM client ---
_llm_client: Optional[OpenAI] = None


def _get_llm_client() -> Optional[OpenAI]:
    """Returns a singleton Groq-compatible OpenAI client, or None if no key."""
    global _llm_client
    if _llm_client is not None:
        return _llm_client

    raw_key = os.environ.get("GROQ_API_KEY")
    api_key = raw_key.strip().strip('"').strip("'") if raw_key else None

    if not api_key:
        logger.warning("GROQ_API_KEY not set — LLM features disabled.")
        return None

    _llm_client = OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    return _llm_client


# ---- Batch classification + explanation via LLM ----

SYSTEM_PROMPT = """You are a legal risk analyst. You will receive a numbered list of contract clauses.

For EACH clause, determine:
1. **category**: one of: {categories}
   - Use "none" for standard/harmless boilerplate (e.g., governing law, definitions, standard obligations).
2. **severity**: "high", "medium", or "low"
   - HIGH: the clause is one-sided, punitive, or removes important rights (e.g., "sole discretion", "without notice", "waive all rights", "irrevocable").
   - MEDIUM: the clause imposes notable restrictions but is common in contracts (e.g., auto-renewal, standard data sharing).
   - LOW: minor or standard terms.
   - Clauses classified as "none" MUST have severity "low".
3. **explanation**: a 1–2 sentence plain-English explanation (under 40 words) of why this clause matters to a non-lawyer. If the category is "none", set explanation to an empty string "".

IMPORTANT RULES:
- Be conservative: only flag clauses that genuinely carry risk. Standard definitions, preamble text, and neutral obligations should be "none".
- Respond ONLY with a valid JSON array. No markdown, no commentary.
- Each element must have: "index" (int, 1-based matching the input), "category", "severity", "explanation".

Example output:
[
  {{"index": 1, "category": "termination", "severity": "high", "explanation": "They can end your account anytime without telling you first."}},
  {{"index": 2, "category": "none", "severity": "low", "explanation": ""}}
]"""


def _batch_classify_explain(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sends a batch of chunks to the LLM and gets back classification +
    severity + explanation for each, in a single API call.

    Returns a list of dicts with keys:
      chunk_id, text, page, heading, category, severity, confidence, explanation
    """
    client = _get_llm_client()
    if client is None:
        # Fallback: use local classifier, no explanations
        return _fallback_classify(chunks)

    # Build the numbered clause list
    clause_lines = []
    for i, chunk in enumerate(chunks, start=1):
        clause_lines.append(f"[{i}] {chunk['text']}")

    user_prompt = "\n\n".join(clause_lines)
    system = SYSTEM_PROMPT.format(categories=", ".join(RISK_CATEGORIES))

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,  # low temperature for consistent classification
        )

        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)

        # The LLM may wrap the array inside a key like {"results": [...]}
        if isinstance(parsed, dict):
            # Find the first list value
            for val in parsed.values():
                if isinstance(val, list):
                    parsed = val
                    break
            else:
                logger.error("LLM returned a dict with no list value: %s", raw[:200])
                return _fallback_classify(chunks)

        if not isinstance(parsed, list):
            logger.error("LLM response is not a list: %s", raw[:200])
            return _fallback_classify(chunks)

        # Map LLM results back to chunks
        results = []
        llm_map = {item["index"]: item for item in parsed if isinstance(item, dict) and "index" in item}

        for i, chunk in enumerate(chunks, start=1):
            llm_item = llm_map.get(i, {})
            category = llm_item.get("category", "none")
            severity = llm_item.get("severity", "low")
            explanation = llm_item.get("explanation", "")

            # Validate category
            if category not in RISK_CATEGORIES:
                category = "none"
                severity = "low"

            # Validate severity
            if severity not in ("high", "medium", "low"):
                severity = "medium"

            # Ensure "none" categories have low severity and empty explanation
            if category == "none":
                severity = "low"
                explanation = ""

            results.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "text": chunk["text"],
                    "page": chunk.get("page", "unknown"),
                    "heading": chunk.get("heading", "unknown"),
                    "category": category,
                    "severity": severity,
                    "confidence": 0.9,  # LLM-based, no numeric confidence
                    "explanation": explanation,
                }
            )

        return results

    except json.JSONDecodeError as e:
        logger.error("Failed to parse LLM JSON response: %s", e)
        return _fallback_classify(chunks)
    except Exception as e:
        logger.error("LLM batch classify+explain failed: %s", e)
        return _fallback_classify(chunks)


def _fallback_classify(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fallback: use the local zero-shot classifier when the LLM is unavailable.
    No explanations are generated in this path.
    """
    logger.info("Using local classifier fallback for %d chunks.", len(chunks))
    results = []
    for chunk in chunks:
        classification = classify_chunk(chunk["text"])
        category = classification["category"]
        severity = classification["severity"]

        results.append(
            {
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "page": chunk.get("page", "unknown"),
                "heading": chunk.get("heading", "unknown"),
                "category": category,
                "severity": severity,
                "confidence": classification["confidence"],
                "explanation": f"[Local classifier] {category} clause detected."
                if category != "none"
                else "",
            }
        )
    return results


# ---- Structured synthesis ----

SYNTHESIS_PROMPT = """You are a legal risk analyst synthesizing flagged contract clauses into a structured review.

Return ONLY valid JSON with this schema:
{
  "executive_summary": "2-4 sentences in plain English",
  "overall_risk": "high|medium|low",
  "review_priorities": [
    {"title": "...", "rationale": "...", "action": "...", "severity": "high|medium|low", "category": "...", "source_chunk_ids": ["..."]}
  ],
  "obligations": [
    {
      "party": "customer|provider|both|unknown",
      "action": "...",
      "trigger": "...",
      "deadline": "absolute date or null if unknown",
      "period": "relative period like 30 days or null",
      "recurrence": "one-time|monthly|annual|unknown",
      "consequence": "...",
      "confidence": 0.0,
      "source_chunk_ids": ["..."]
    }
  ],
  "suggested_questions": ["...", "...", "..."]
}

Rules:
- Use ONLY the provided flagged clauses.
- Every source_chunk_ids value MUST be one of the provided chunk_ids.
- Prefer high-severity items in review_priorities (max 5).
- For ambiguous relative deadlines, put the relative wording in period and leave deadline null.
- Keep suggested_questions specific to this document (max 5).
"""


def _valid_chunk_ids(flags: List[Dict[str, Any]]) -> set:
    return {f["chunk_id"] for f in flags if f.get("chunk_id")}


def _filter_chunk_ids(ids: Any, valid: set) -> List[str]:
    if not isinstance(ids, list):
        return []
    return [cid for cid in ids if isinstance(cid, str) and cid in valid]


def _overall_risk_from_flags(flags: List[Dict[str, Any]]) -> str:
    if any(f.get("severity") == "high" for f in flags):
        return "high"
    if any(f.get("severity") == "medium" for f in flags):
        return "medium"
    return "low"


def _deterministic_priorities(flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    priorities = []
    for flag in flags[:5]:
        priorities.append(
            {
                "title": f"Review {flag.get('category', 'clause').replace('_', ' ')}",
                "rationale": flag.get("explanation") or "This clause carries material risk.",
                "action": "Negotiate clarifying language and confirm impact before signing.",
                "severity": flag.get("severity", "medium"),
                "category": flag.get("category"),
                "source_chunk_ids": [flag["chunk_id"]],
            }
        )
    return priorities


def _deterministic_obligations(flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    obligations = []
    for flag in flags:
        category = flag.get("category")
        if category not in {"payment_terms", "termination", "auto_renewal", "penalty", "confidentiality"}:
            continue
        obligations.append(
            {
                "party": "unknown",
                "action": flag.get("explanation") or f"Comply with {category.replace('_', ' ')} terms",
                "trigger": flag.get("heading") or "Contract term",
                "deadline": None,
                "period": None,
                "recurrence": "unknown",
                "consequence": "Potential breach or loss of rights if ignored.",
                "confidence": float(flag.get("confidence") or 0.5),
                "source_chunk_ids": [flag["chunk_id"]],
                "status": "unconfirmed",
            }
        )
    return obligations[:8]


def _build_playbook(flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    items = []
    for flag in flags:
        category = flag.get("category")
        if not category or category in seen:
            continue
        seen.add(category)
        defaults = playbook_for_category(category)
        items.append(
            {
                "category": category,
                "severity": flag.get("severity", "medium"),
                "primary_ask": defaults["primary_ask"],
                "fallback": defaults["fallback"],
                "rationale": defaults["rationale"],
                "suggested_language": defaults["suggested_language"],
                "source_chunk_ids": [flag["chunk_id"]],
            }
        )
        if len(items) >= 6:
            break
    return items


def _suggested_questions(flags: List[Dict[str, Any]]) -> List[str]:
    cats = sorted({f.get("category") for f in flags if f.get("category")})
    questions = [
        "What are the highest-risk clauses I should negotiate first?",
        "Summarize my termination and exit rights.",
        "What payment or renewal obligations could surprise me?",
    ]
    for cat in cats[:3]:
        questions.append(f"Explain the {cat.replace('_', ' ')} terms in plain English.")
    return questions[:5]


def _synthesize_report(flags: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Second-pass LLM synthesis with deterministic fallback."""
    valid = _valid_chunk_ids(flags)
    fallback = {
        "executive_summary": (
            f"This review flagged {len(flags)} clauses. "
            f"Overall risk appears {_overall_risk_from_flags(flags)}. "
            "Prioritize high-severity items and verify each finding against the source text."
            if flags
            else "No material risk clauses were flagged in this analysis."
        ),
        "overall_risk": _overall_risk_from_flags(flags),
        "review_priorities": _deterministic_priorities(flags),
        "obligations": _deterministic_obligations(flags),
        "suggested_questions": _suggested_questions(flags),
    }

    if not flags:
        return fallback

    client = _get_llm_client()
    if client is None:
        return fallback

    compact = []
    for flag in flags[:20]:
        compact.append(
            {
                "chunk_id": flag["chunk_id"],
                "page": flag.get("page"),
                "category": flag.get("category"),
                "severity": flag.get("severity"),
                "explanation": flag.get("explanation"),
                "text": (flag.get("text") or "")[:400],
            }
        )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYNTHESIS_PROMPT},
                {"role": "user", "content": json.dumps({"flags": compact})},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        parsed = json.loads(response.choices[0].message.content.strip())
        if not isinstance(parsed, dict):
            return fallback

        priorities = []
        for item in parsed.get("review_priorities") or []:
            if not isinstance(item, dict):
                continue
            source_ids = _filter_chunk_ids(item.get("source_chunk_ids"), valid)
            if not source_ids:
                continue
            priorities.append(
                {
                    "title": str(item.get("title") or "Priority finding"),
                    "rationale": str(item.get("rationale") or ""),
                    "action": str(item.get("action") or ""),
                    "severity": item.get("severity") if item.get("severity") in ("high", "medium", "low") else "medium",
                    "category": item.get("category"),
                    "source_chunk_ids": source_ids,
                }
            )

        obligations = []
        for item in parsed.get("obligations") or []:
            if not isinstance(item, dict) or not item.get("action"):
                continue
            source_ids = _filter_chunk_ids(item.get("source_chunk_ids"), valid)
            if not source_ids:
                continue
            obligations.append(
                {
                    "party": item.get("party") or "unknown",
                    "action": str(item.get("action")),
                    "trigger": item.get("trigger"),
                    "deadline": item.get("deadline"),
                    "period": item.get("period"),
                    "recurrence": item.get("recurrence") or "unknown",
                    "consequence": item.get("consequence"),
                    "confidence": float(item.get("confidence") or 0.6),
                    "source_chunk_ids": source_ids,
                    "status": "unconfirmed",
                }
            )

        questions = [
            str(q).strip()
            for q in (parsed.get("suggested_questions") or [])
            if isinstance(q, str) and q.strip()
        ][:5]

        overall = parsed.get("overall_risk")
        if overall not in ("high", "medium", "low"):
            overall = _overall_risk_from_flags(flags)

        return {
            "executive_summary": str(parsed.get("executive_summary") or fallback["executive_summary"]),
            "overall_risk": overall,
            "review_priorities": priorities or fallback["review_priorities"],
            "obligations": obligations or fallback["obligations"],
            "suggested_questions": questions or fallback["suggested_questions"],
        }
    except Exception as e:
        logger.error("Report synthesis failed: %s", e)
        return fallback


# ---- Public API ----


def generate_report(doc_id: str) -> dict:
    """
    Classify clauses, synthesize a structured legal report, and enrich vector metadata.
    """
    from datetime import datetime

    chunks = get_chunks_by_doc(doc_id)
    if not chunks:
        return {
            "doc_id": doc_id,
            "flags": [],
            "executive_summary": "No content was available to analyze.",
            "overall_risk": "low",
            "review_priorities": [],
            "obligations": [],
            "negotiation_playbook": [],
            "suggested_questions": [],
            "analyzed_at": datetime.utcnow().isoformat() + "Z",
            "model": "none",
            "disclaimer": (
                "AI-assisted legal review for information only. Not legal advice. "
                "Verify all findings against the source document before relying on them."
            ),
        }

    all_results: List[Dict[str, Any]] = []
    for start in range(0, len(chunks), MAX_CHUNKS_PER_BATCH):
        batch = chunks[start : start + MAX_CHUNKS_PER_BATCH]
        all_results.extend(_batch_classify_explain(batch))

    flagged = [r for r in all_results if r["category"] != "none"]
    flagged.sort(key=lambda x: SEVERITY_RANK.get(x["severity"], 99))

    # Write classification into Chroma metadata for RAG enrichment
    try:
        for item in all_results:
            update_chunk_metadata(
                item["chunk_id"],
                {
                    "category": item.get("category") or "none",
                    "severity": item.get("severity") or "low",
                },
            )
    except Exception as e:
        logger.warning("Failed to enrich chunk metadata: %s", e)

    synthesis = _synthesize_report(flagged)
    playbook = _build_playbook(flagged)
    model_name = "llama-3.3-70b-versatile" if _get_llm_client() else "local-classifier"

    return {
        "doc_id": doc_id,
        "flags": flagged,
        "executive_summary": synthesis["executive_summary"],
        "overall_risk": synthesis["overall_risk"],
        "review_priorities": synthesis["review_priorities"],
        "obligations": synthesis["obligations"],
        "negotiation_playbook": playbook,
        "suggested_questions": synthesis["suggested_questions"],
        "analyzed_at": datetime.utcnow().isoformat() + "Z",
        "model": model_name,
        "disclaimer": (
            "AI-assisted legal review for information only. Not legal advice. "
            "Verify all findings against the source document before relying on them."
        ),
    }
