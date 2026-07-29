from embeddings import embed_chunks, model
from sentence_transformers import util

def main():
    if model is None:
        print("Model failed to load, cannot run sanity check.")
        return
        
    chunks = [
        {"chunk_id": "1", "text": "The contract auto-renews for 1 year."},
        {"chunk_id": "2", "text": "This agreement will automatically extend for 12 months."},
        {"chunk_id": "3", "text": "The quick brown fox jumps over the lazy dog."},
        {"chunk_id": "4", "text": "Apples are delicious when baked into a pie."}
    ]
    
    print("Generating embeddings...")
    embedded_chunks = embed_chunks(chunks)
    
    vec1 = embedded_chunks[0]["vector"]
    vec2 = embedded_chunks[1]["vector"]
    vec3 = embedded_chunks[2]["vector"]
    vec4 = embedded_chunks[3]["vector"]
    
    # Calculate cosine similarities
    sim_1_2 = util.cos_sim(vec1, vec2).item()
    sim_1_3 = util.cos_sim(vec1, vec3).item()
    sim_3_4 = util.cos_sim(vec3, vec4).item()
    
    print(f"\nSimilarity between similar sentences (1 & 2): {sim_1_2:.4f}")
    print(f"Similarity between dissimilar sentences (1 & 3): {sim_1_3:.4f}")
    print(f"Similarity between random sentences (3 & 4): {sim_3_4:.4f}\n")
    
    # Assert similar sentences score higher
    assert sim_1_2 > sim_1_3, "Sanity check failed: Similar sentences scored lower than dissimilar ones."
    assert sim_1_2 > sim_3_4, "Sanity check failed: Similar sentences scored lower than random ones."
    
    print("Sanity check passed! Embeddings are semantically aware.")

if __name__ == "__main__":
    main()
