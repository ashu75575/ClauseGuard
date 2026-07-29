import os
from dotenv import load_dotenv
load_dotenv()

from app.services.embedder import embed_chunks
from app.services.vector_db import store_chunks
from app.services.rag import answer_question

def main():
    # 1. Setup Mock Document
    doc_id = "test_doc_rag_001"
    
    print(f"Setting up mock document: {doc_id}")
    
    mock_chunks = [
        {
            "chunk_id": "chunk_a",
            "text": "This contract may be terminated by either party with a 30-day written notice. You may cancel your subscription at any time without penalty.",
            "page": 1,
            "heading": "Termination Clause"
        },
        {
            "chunk_id": "chunk_b",
            "text": "The company's liability is strictly limited to the amount paid in the last 12 months.",
            "page": 2,
            "heading": "Limitation of Liability"
        },
        {
            "chunk_id": "chunk_c",
            "text": "Disputes shall be settled exclusively by binding arbitration in the state of Delaware.",
            "page": 3,
            "heading": "Dispute Resolution"
        }
    ]
    
    # 2. Embed and Store
    print("Embedding chunks...")
    embedded_chunks = embed_chunks(mock_chunks)
    
    print("Storing in Vector Store...")
    store_chunks(doc_id, embedded_chunks)
    
    print("\n--------------------------------------------------")
    print("Test Case 1: In-Context Question")
    print("--------------------------------------------------")
    q1 = "Can I cancel my subscription anytime?"
    print(f"Question: {q1}")
    
    # Needs GROQ_API_KEY environment variable. 
    # If not set, let's gracefully fail the test.
    if not os.environ.get("GROQ_API_KEY"):
        print("\n[!] GROQ_API_KEY not found in environment. Skipping actual Groq API call.")
        print("To run the full test, export GROQ_API_KEY='your_key' and run again.")
        return
        
    ans1 = answer_question(doc_id, q1)
    print(f"\nResponse: {ans1}")
    
    print("\n--------------------------------------------------")
    print("Test Case 2: Out-of-Context Question")
    print("--------------------------------------------------")
    q2 = "Does this contract cover health insurance benefits?"
    print(f"Question: {q2}")
    
    ans2 = answer_question(doc_id, q2)
    print(f"\nResponse: {ans2}")

if __name__ == "__main__":
    main()
