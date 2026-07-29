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

from app.services.vector_db import get_chunks_by_doc
from app.services.classifier import classify_chunk, CATEGORIES as CLASSIFIER_CATEGORIES

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


# ---- Public API ----


def generate_report(doc_id: str) -> dict:
    """
    Fetches chunks from the vector store, classifies and explains them
    via a batched LLM call, filters out 'none' categories, and returns
    a severity-sorted risk report.
    """
    chunks = get_chunks_by_doc(doc_id)
    if not chunks:
        return {"doc_id": doc_id, "flags": []}

    # Process in batches to stay within context-window limits
    all_results: List[Dict[str, Any]] = []

    for start in range(0, len(chunks), MAX_CHUNKS_PER_BATCH):
        batch = chunks[start : start + MAX_CHUNKS_PER_BATCH]
        batch_results = _batch_classify_explain(batch)
        all_results.extend(batch_results)

    # Filter out harmless clauses
    flagged = [r for r in all_results if r["category"] != "none"]

    # Sort by severity (high → medium → low)
    flagged.sort(key=lambda x: SEVERITY_RANK.get(x["severity"], 99))

    return {"doc_id": doc_id, "flags": flagged}
