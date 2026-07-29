from app.domain.playbooks import playbook_for_category
from app.services.report_builder import (
    _build_playbook,
    _filter_chunk_ids,
    _overall_risk_from_flags,
    _synthesize_report,
)
from app.services.exporter import build_docx, build_pdf
from app.services.rag import _clean_answer, _default_follow_ups, _question_category, _question_intent


def test_playbook_defaults():
    item = playbook_for_category("termination")
    assert "primary_ask" in item
    assert "suggested_language" in item


def test_overall_risk_and_chunk_filter():
    flags = [
        {"chunk_id": "a", "severity": "low"},
        {"chunk_id": "b", "severity": "high"},
    ]
    assert _overall_risk_from_flags(flags) == "high"
    assert _filter_chunk_ids(["a", "missing", 1], {"a", "b"}) == ["a"]


def test_assistant_routes_common_document_requests():
    assert _question_intent("Can you summarise the contract for me?") == "document_summary"
    assert _question_intent("What is the termination risk?") == "risk_analysis"
    assert _question_category("Can either party cancel this agreement?") == "termination"
    assert _question_intent("Is this legit?") == "clarification"
    assert _question_intent("Where can AI help me?") == "capability"
    assert _question_intent("What is the capital of France?") == "grounded_answer"
    assert _clean_answer("Notice is 7 days (Chunk ID: abc-123).") == "Notice is 7 days."


def test_assistant_suggests_topics_from_report():
    report = {
        "flags": [{"category": "termination"}, {"category": "payment"}],
        "suggested_questions": [],
    }
    suggestions = _default_follow_ups(report)
    assert any("termination" in item for item in suggestions)
    assert len(suggestions) <= 3


def test_deterministic_synthesis_without_llm(monkeypatch):
    monkeypatch.setattr("app.services.report_builder._get_llm_client", lambda: None)
    flags = [
        {
            "chunk_id": "c1",
            "category": "termination",
            "severity": "high",
            "explanation": "Can terminate without notice.",
            "text": "We may terminate at any time.",
            "confidence": 0.9,
            "heading": "Termination",
            "page": 1,
        }
    ]
    result = _synthesize_report(flags)
    assert result["overall_risk"] == "high"
    assert result["review_priorities"]
    assert result["suggested_questions"]
    playbook = _build_playbook(flags)
    assert playbook[0]["category"] == "termination"


def test_exporters():
    report = {
        "executive_summary": "Summary",
        "overall_risk": "medium",
        "review_priorities": [{"title": "T", "rationale": "R", "action": "A"}],
        "obligations": [{"status": "unconfirmed", "party": "customer", "action": "Pay"}],
        "negotiation_playbook": [
            {
                "category": "termination",
                "primary_ask": "Ask",
                "fallback": "Fallback",
            }
        ],
        "flags": [
            {
                "severity": "high",
                "category": "termination",
                "page": 1,
                "explanation": "Risky",
                "text": "Clause text",
            }
        ],
        "analyzed_at": "2026-01-01T00:00:00Z",
        "model": "test",
        "disclaimer": "Not legal advice",
    }
    pdf = build_pdf(report, "demo.txt")
    docx = build_docx(report, "demo.txt")
    assert pdf[:4] == b"%PDF"
    assert len(docx) > 100
