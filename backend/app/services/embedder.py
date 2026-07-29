"""
Embedder – Generates vector embeddings for text using sentence-transformers.

Improvements:
  - Normalised embeddings (improves cosine similarity accuracy in ChromaDB)
  - Batch size control (prevents OOM on large documents)
  - Proper logging instead of print()
"""

import logging
from typing import List, Dict, Any

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Load model once at module level to keep it in memory
MODEL_NAME = "all-MiniLM-L6-v2"
BATCH_SIZE = 64  # prevents OOM on very large documents

logger.info("Loading embedding model: %s...", MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)
logger.info("Embedding model loaded successfully (dim=%d).", model.get_sentence_embedding_dimension())


def embed_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Computes vector embeddings for a list of chunks in batched format.
    The embeddings are injected into the chunk dictionaries.
    Uses normalised embeddings for better cosine similarity results.
    """
    if not chunks:
        return []

    texts = [chunk.get("text", "") for chunk in chunks]

    # Generate normalised embeddings in batches
    embeddings = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        convert_to_numpy=True,
        normalize_embeddings=True,  # unit-length vectors → better cosine similarity
        show_progress_bar=False,
    )

    for i, chunk in enumerate(chunks):
        chunk["vector"] = embeddings[i].tolist()

    return chunks


def embed_text(text: str) -> List[float]:
    """
    Computes the normalised vector embedding for a single text string.
    Used for query embedding in RAG.
    """
    return model.encode(
        text,
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).tolist()
