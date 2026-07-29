from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine

# Create the test db tables
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    print("Health check passed.")

def test_full_flow():
    # 1. Upload a simple text file
    file_content = b"This agreement is governed by the laws of California.\n\nThe company reserves the right to terminate your account at any time without notice.\n\nAll fees are non-refundable and will auto-renew."
    
    response = client.post(
        "/upload",
        files={"file": ("test_contract.txt", file_content, "text/plain")}
    )
    
    assert response.status_code == 200, f"Upload failed: {response.text}"
    report = response.json()
    assert "doc_id" in report
    assert "flags" in report
    
    doc_id = report["doc_id"]
    print(f"Upload successful. doc_id: {doc_id}")
    print(f"Number of flags: {len(report['flags'])}")
    
    # 2. Get report
    response2 = client.get(f"/report/{doc_id}")
    assert response2.status_code == 200
    report2 = response2.json()
    assert report2["doc_id"] == doc_id
    print("Report fetch successful.")
    
    # 3. Ask a question
    ask_payload = {
        "doc_id": doc_id,
        "question": "Can they terminate my account?"
    }
    response3 = client.post("/ask", json=ask_payload)
    assert response3.status_code == 200
    answer = response3.json()
    assert "answer" in answer
    assert "citations" in answer
    print("Ask question successful.")

if __name__ == "__main__":
    test_health()
    test_full_flow()
    print("All API tests passed!")
