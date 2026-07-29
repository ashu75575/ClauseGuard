import os
import shutil
import tempfile
import pytest
from app.services.vector_db import store_chunks, get_chunks_by_doc, query_similar

@pytest.fixture
def temp_db():
    # Create a temporary directory for Chroma DB
    test_dir = tempfile.mkdtemp()
    yield test_dir
    # Teardown: remove the directory after tests
    try:
        shutil.rmtree(test_dir)
    except Exception as e:
        print(f"Cleanup error: {e}")

def test_vector_store_isolation(temp_db):
    # Dummy chunks for doc_A and doc_B
    # The vectors are just dummy lists of floats (must be same dimensionality)
    doc_A_chunks = [
        {"chunk_id": "A1", "text": "This is apple.", "vector": [1.0, 0.0, 0.0]},
        {"chunk_id": "A2", "text": "This is orange.", "vector": [0.0, 1.0, 0.0]}
    ]
    
    doc_B_chunks = [
        {"chunk_id": "B1", "text": "This is totally an apple.", "vector": [0.9, 0.1, 0.0]},
        {"chunk_id": "B2", "text": "This is totally an orange.", "vector": [0.1, 0.9, 0.0]}
    ]
    
    # Store both sets of chunks
    store_chunks("doc_A", doc_A_chunks, db_path=temp_db)
    store_chunks("doc_B", doc_B_chunks, db_path=temp_db)
    
    # 1. Test get_chunks_by_doc
    retrieved_A = get_chunks_by_doc("doc_A", db_path=temp_db)
    assert len(retrieved_A) == 2
    assert all(c["doc_id"] == "doc_A" for c in retrieved_A)
    
    # 2. Test query_similar isolation
    # Query with a vector very close to B1 ([0.9, 0.1, 0.0]), but scope it strictly to doc_A
    query_vec = [0.95, 0.05, 0.0]
    results = query_similar("doc_A", query_vec, top_k=5, db_path=temp_db)
    
    # It should only return doc_A chunks, never doc_B chunks (like B1), 
    # even if B1's vector is much closer to query_vec.
    assert len(results) > 0
    for res in results:
        assert res["doc_id"] == "doc_A"
        assert not res["chunk_id"].startswith("B")
        
    # Same check for doc_B
    results_B = query_similar("doc_B", query_vec, top_k=5, db_path=temp_db)
    assert len(results_B) > 0
    for res in results_B:
        assert res["doc_id"] == "doc_B"
