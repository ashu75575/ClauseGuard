"""
Test: Report generation pipeline with mocked classifier.
Updated to work with the refactored report_builder (batched LLM approach).
"""

import pytest
from unittest.mock import patch, MagicMock
from app.services.embedder import embed_chunks
from app.services.vector_db import store_chunks
from app.services.report_builder import generate_report


# Mock the batch classify+explain to return deterministic results
def mock_batch_classify_explain(chunks):
    """Simulates LLM batch response for testing."""
    results = []
    for chunk in chunks:
        text = chunk["text"]
        if "laws of the State" in text:
            results.append({
                "chunk_id": chunk["chunk_id"],
                "text": text,
                "page": chunk.get("page", "unknown"),
                "heading": chunk.get("heading", "unknown"),
                "category": "none",
                "severity": "low",
                "confidence": 0.99,
                "explanation": "",
            })
        elif "terminate your account" in text:
            results.append({
                "chunk_id": chunk["chunk_id"],
                "text": text,
                "page": chunk.get("page", "unknown"),
                "heading": chunk.get("heading", "unknown"),
                "category": "termination",
                "severity": "high",
                "confidence": 0.99,
                "explanation": "They can end your account anytime without telling you first.",
            })
        elif "auto-renew" in text:
            results.append({
                "chunk_id": chunk["chunk_id"],
                "text": text,
                "page": chunk.get("page", "unknown"),
                "heading": chunk.get("heading", "unknown"),
                "category": "auto_renewal",
                "severity": "medium",
                "confidence": 0.99,
                "explanation": "Your subscription renews automatically — you'll be charged again unless you cancel.",
            })
        else:
            results.append({
                "chunk_id": chunk["chunk_id"],
                "text": text,
                "page": chunk.get("page", "unknown"),
                "heading": chunk.get("heading", "unknown"),
                "category": "data_sharing",
                "severity": "low",
                "confidence": 0.99,
                "explanation": "They may share your personal info with marketing partners.",
            })
    return results


@patch("app.services.report_builder._batch_classify_explain", side_effect=mock_batch_classify_explain)
def test_generate_report(mock_classify):
    doc_id = "test_doc_report_001"

    # 4 chunks: 3 flagged, 1 fair
    mock_chunks = [
        {
            "chunk_id": "chunk_fair",
            "text": "This agreement is governed by the laws of the State of California.",
            "page": 1,
            "heading": "Governing Law",
        },
        {
            "chunk_id": "chunk_high_risk",
            "text": "The company reserves the right to terminate your account at our sole discretion, without notice, and for any reason.",
            "page": 1,
            "heading": "Termination",
        },
        {
            "chunk_id": "chunk_med_risk",
            "text": "All subscription fees are non-refundable and will auto-renew annually.",
            "page": 2,
            "heading": "Fees",
        },
        {
            "chunk_id": "chunk_low_risk",
            "text": "We may share your information with third-party marketing partners.",
            "page": 3,
            "heading": "Privacy",
        },
    ]

    # Embed and store
    embedded_chunks = embed_chunks(mock_chunks)
    store_chunks(doc_id, embedded_chunks)

    report = generate_report(doc_id)
    flags = report.get("flags", [])

    # Assertions
    assert len(flags) == 3, f"Expected 3 flagged clauses, got {len(flags)}"
    assert flags[0]["severity"] == "high", "First flag should be high severity"
    assert flags[1]["severity"] == "medium", "Second flag should be medium severity"
    assert flags[2]["severity"] == "low", "Third flag should be low severity"

    # Verify explanations are present for flagged clauses
    for flag in flags:
        assert flag["explanation"], f"Explanation missing for {flag['category']}"
        assert flag["category"] != "none", "None category should be filtered out"
