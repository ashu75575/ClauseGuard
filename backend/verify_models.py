import os
import traceback
import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure the root directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_classifier():
    print("\n--- Testing Classifier Model ---")
    try:
        from app.services.classifier import classify_chunk
        text = "In the event of a breach, this contract may be terminated immediately."
        print(f"Testing text: '{text}'")
        result = classify_chunk(text)
        print("Classifier result:", result)
        print("✅ Classifier is working properly.")
    except Exception as e:
        print("❌ Classifier failed with error:")
        traceback.print_exc()

def test_embedder():
    print("\n--- Testing Embedder Model ---")
    try:
        from app.services.embedder import embed_text
        text = "This is a test string to embed."
        vector = embed_text(text)
        print(f"Generated vector of length {len(vector)}")
        print("✅ Embedder is working properly.")
    except Exception as e:
        print("❌ Embedder failed with error:")
        traceback.print_exc()

def test_rag_model():
    print("\n--- Testing Groq (RAG) Model ---")
    try:
        from app.services.rag import answer_question
        
        if not os.environ.get("GROQ_API_KEY"):
            print("⚠️ GROQ_API_KEY environment variable is not set. The API call to Groq will be skipped.")
            
        result = answer_question("dummy_doc_id", "What is the penalty for early termination?")
        print("RAG answer:", result.get('answer', ''))
        print("✅ RAG logic executed properly.")
    except Exception as e:
        print("❌ RAG logic failed with error:")
        traceback.print_exc()

if __name__ == "__main__":
    print("Starting Model Verification...")
    test_embedder()
    test_classifier()
    test_rag_model()
    print("\nVerification Complete.")
