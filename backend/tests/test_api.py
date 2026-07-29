from fastapi.testclient import TestClient
from app.main import app
from app.db.session import bootstrap_schema

bootstrap_schema()
client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "version" in payload


def test_documents_list_endpoint():
    response = client.get("/documents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_full_flow():
    file_content = (
        b"This agreement is governed by the laws of California.\n\n"
        b"The company reserves the right to terminate your account at any time without notice.\n\n"
        b"All fees are non-refundable and will auto-renew."
    )

    response = client.post(
        "/upload",
        files={"file": ("test_contract.txt", file_content, "text/plain")},
    )

    assert response.status_code == 200, f"Upload failed: {response.text}"
    report = response.json()
    assert "doc_id" in report
    assert "flags" in report
    assert "executive_summary" in report
    assert "overall_risk" in report
    assert "negotiation_playbook" in report
    assert "suggested_questions" in report

    doc_id = report["doc_id"]

    response2 = client.get(f"/report/{doc_id}")
    assert response2.status_code == 200
    report2 = response2.json()
    assert report2["doc_id"] == doc_id

    response_docs = client.get("/documents")
    assert response_docs.status_code == 200
    assert any(item["doc_id"] == doc_id for item in response_docs.json())

    ask_payload = {"doc_id": doc_id, "question": "Can they terminate my account?"}
    response3 = client.post("/ask", json=ask_payload)
    assert response3.status_code == 200
    answer = response3.json()
    assert "answer" in answer
    assert "citations" in answer

    chat = client.get(f"/chat/{doc_id}")
    assert chat.status_code == 200
    assert len(chat.json()) >= 2

    export_pdf = client.get(f"/export/{doc_id}?format=pdf")
    assert export_pdf.status_code == 200
    assert export_pdf.headers["content-type"].startswith("application/pdf")


if __name__ == "__main__":
    test_health()
    test_documents_list_endpoint()
    test_full_flow()
    print("All API tests passed!")
