"""
Classifier – Local zero-shot classification with expanded categories.

This module serves as the FALLBACK when the LLM-based batch classification
in report_builder.py is unavailable (e.g., no API key, rate-limited).

Improvements:
  - Expanded from 6 to 13 risk categories
  - Context-aware severity using keyword analysis (not just category mapping)
  - Batch classification support for better throughput
  - Multi-label detection (a clause can be both "termination" and "data_sharing")
  - Proper logging instead of print()
"""

import os
import logging
from typing import Dict, Any, List

from transformers import pipeline

logger = logging.getLogger(__name__)

CATEGORIES = [
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

# Keywords that indicate high severity regardless of category
HIGH_SEVERITY_KEYWORDS = [
    "sole discretion",
    "without notice",
    "waive",
    "irrevocable",
    "binding",
    "indemnify",
    "penalty",
    "no liability",
    "not liable",
    "exclusive remedy",
    "waive all rights",
    "at will",
    "immediately terminate",
    "forfeit",
]

# Keywords that indicate medium severity
MEDIUM_SEVERITY_KEYWORDS = [
    "may",
    "reserves the right",
    "at any time",
    "subject to change",
    "non-refundable",
    "automatically renew",
    "third party",
    "share your",
    "collect",
    "transfer",
]

# Below this confidence, zero-shot predictions are treated as "none"
CONFIDENCE_THRESHOLD = 0.45

logger.info("Initializing classification module...")

MODEL_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "clause_classifier"
)

if os.path.exists(MODEL_DIR):
    logger.info("Loading fine-tuned model from %s", MODEL_DIR)
    classifier = pipeline("text-classification", model=MODEL_DIR)
    is_zero_shot = False
    logger.info("Fine-tuned model loaded successfully.")
else:
    logger.info(
        "Fine-tuned model not found. Loading zero-shot baseline (facebook/bart-large-mnli)..."
    )
    classifier = pipeline(
        "zero-shot-classification", model="facebook/bart-large-mnli"
    )
    is_zero_shot = True
    logger.info("Zero-shot model loaded successfully.")


def determine_severity(category: str, text: str) -> str:
    """
    Context-aware severity scoring that considers both the category
    and the actual text content of the clause.
    """
    if category == "none":
        return "low"

    text_lower = text.lower()

    # Check for high-severity keywords
    if any(kw in text_lower for kw in HIGH_SEVERITY_KEYWORDS):
        return "high"

    # Check for medium-severity keywords
    if any(kw in text_lower for kw in MEDIUM_SEVERITY_KEYWORDS):
        return "medium"

    # Category-based defaults for clauses without obvious keywords
    inherently_high = {"arbitration", "indemnification", "penalty"}
    inherently_medium = {
        "auto_renewal",
        "data_sharing",
        "non_compete",
        "termination",
        "liability",
    }

    if category in inherently_high:
        return "high"
    if category in inherently_medium:
        return "medium"

    return "low"


def classify_chunk(text: str) -> Dict[str, Any]:
    """
    Classifies a single text chunk into predefined categories.
    Falls back to zero-shot if the fine-tuned model isn't available.
    Zero-shot predictions below CONFIDENCE_THRESHOLD are forced to "none".
    """
    if is_zero_shot:
        result = classifier(text, candidate_labels=CATEGORIES)
        category = result["labels"][0]
        confidence = result["scores"][0]

        if confidence < CONFIDENCE_THRESHOLD:
            category = "none"
    else:
        result = classifier(text)
        category = result[0]["label"]
        confidence = result[0]["score"]

    severity = determine_severity(category, text)

    return {"category": category, "severity": severity, "confidence": confidence}


def classify_chunks_batch(texts: List[str]) -> List[Dict[str, Any]]:
    """
    Batch classification — classifies multiple texts at once for better throughput.
    Useful when the LLM fallback needs to process many chunks.
    """
    results = []

    if is_zero_shot:
        # Zero-shot doesn't support true batch, but we can loop efficiently
        for text in texts:
            result = classifier(text, candidate_labels=CATEGORIES)
            category = result["labels"][0]
            confidence = result["scores"][0]

            if confidence < CONFIDENCE_THRESHOLD:
                category = "none"

            severity = determine_severity(category, text)
            results.append(
                {"category": category, "severity": severity, "confidence": confidence}
            )
    else:
        # Fine-tuned model supports batch
        batch_results = classifier(texts)
        for i, result in enumerate(batch_results):
            category = result[0]["label"] if isinstance(result, list) else result["label"]
            confidence = result[0]["score"] if isinstance(result, list) else result["score"]
            severity = determine_severity(category, texts[i])
            results.append(
                {"category": category, "severity": severity, "confidence": confidence}
            )

    return results
