"""
Vector Store – ChromaDB wrapper with singleton client and optimised queries.

Improvements:
  - Singleton PersistentClient (no open/close per call)
  - Explicit cosine distance metric
  - get_chunks_by_doc skips embedding fetch (saves memory)
  - Similarity score conversion (distance → 0-1 similarity)
  - Document deletion support
  - Proper logging
"""

import os
import logging
from typing import List, Dict, Any, Optional

import chromadb

logger = logging.getLogger(__name__)

# Persistent client path relative to this file
CHROMA_DB_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "chroma_db"
)
os.makedirs(os.path.dirname(CHROMA_DB_PATH), exist_ok=True)

# --- Singleton client & collection ---
_client: Optional[chromadb.PersistentClient] = None
_collection = None


def _get_collection(db_path: Optional[str] = None):
    """Returns a ChromaDB collection.

    When *db_path* is ``None`` the module-level singleton client is used
    (initialised on first call).  When a custom *db_path* is supplied a
    fresh ``PersistentClient`` is created – this keeps tests isolated from
    production data.
    """
    if db_path is not None:
        client = chromadb.PersistentClient(path=db_path)
        return client.get_or_create_collection(
            name="clauseguard_chunks",
            metadata={"hnsw:space": "cosine"},
        )

    global _client, _collection
    if _collection is not None:
        return _collection

    _client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    _collection = _client.get_or_create_collection(
        name="clauseguard_chunks",
        metadata={"hnsw:space": "cosine"},  # explicit cosine distance
    )
    logger.info(
        "ChromaDB collection initialised at %s (%d records)",
        CHROMA_DB_PATH,
        _collection.count(),
    )
    return _collection


def store_chunks(
    doc_id: str, chunks: List[dict], *, db_path: Optional[str] = None
) -> None:
    """
    Stores a list of embedded chunks into ChromaDB under the given doc_id.
    Chunks without vectors are silently skipped.
    """
    collection = _get_collection(db_path)

    ids = []
    embeddings = []
    documents = []
    metadatas = []

    for chunk in chunks:
        if "vector" not in chunk or not chunk["vector"]:
            continue

        chunk_id = chunk["chunk_id"]
        ids.append(chunk_id)
        embeddings.append(chunk["vector"])
        documents.append(chunk.get("text", ""))

        meta = {
            "doc_id": doc_id,
            "page": chunk.get("page") or 0,
            "heading": chunk.get("heading") or "",
        }
        metadatas.append(meta)

    if ids:
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        logger.info("Stored %d chunks for doc %s", len(ids), doc_id)


def get_chunks_by_doc(
    doc_id: str, *, db_path: Optional[str] = None
) -> List[dict]:
    """
    Retrieves all chunks associated with a specific doc_id.
    Does NOT fetch embeddings (saves memory — they're only needed for similarity search).
    """
    collection = _get_collection(db_path)

    results = collection.get(
        where={"doc_id": doc_id},
        include=["metadatas", "documents"],  # no "embeddings" — saves memory
    )

    chunks = []
    if not results or not results["ids"]:
        return chunks

    for i in range(len(results["ids"])):
        meta = results["metadatas"][i] or {}
        chunks.append(
            {
                "chunk_id": results["ids"][i],
                "doc_id": meta.get("doc_id"),
                "text": results["documents"][i],
                "page": meta.get("page"),
                "heading": meta.get("heading"),
                "category": meta.get("category"),
                "severity": meta.get("severity"),
            }
        )
    return chunks


def query_similar(
    doc_id: Optional[str] = None,
    query_vector: Optional[List[float]] = None,
    top_k: int = 8,
    *,
    doc_ids: Optional[List[str]] = None,
    per_doc_limit: Optional[int] = None,
    db_path: Optional[str] = None,
) -> List[dict]:
    """
    Queries for similar chunks.

    Prefer `doc_ids` for multi-document retrieval. Falls back to a single `doc_id`.
    When `per_doc_limit` is set, results are balanced across documents.
    """
    if query_vector is None:
        raise ValueError("query_vector is required")

    collection = _get_collection(db_path)
    ids = [d for d in (doc_ids or ([doc_id] if doc_id else [])) if d]
    where = None
    if len(ids) == 1:
        where = {"doc_id": ids[0]}
    elif len(ids) > 1:
        where = {"doc_id": {"$in": ids}}

    fetch_k = top_k
    if per_doc_limit and ids:
        fetch_k = max(top_k, per_doc_limit * len(ids) * 2)

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=fetch_k,
        where=where,
        include=["metadatas", "documents", "distances"],
    )

    chunks = []
    if not results or not results["ids"] or not results["ids"][0]:
        return chunks

    for i in range(len(results["ids"][0])):
        meta = results["metadatas"][0][i] or {}
        distance = results["distances"][0][i]
        chunks.append(
            {
                "chunk_id": results["ids"][0][i],
                "doc_id": meta.get("doc_id"),
                "text": results["documents"][0][i],
                "page": meta.get("page"),
                "heading": meta.get("heading"),
                "category": meta.get("category"),
                "severity": meta.get("severity"),
                "distance": distance,
                "similarity": round(1.0 - distance, 4),
            }
        )

    if per_doc_limit and ids:
        balanced: List[dict] = []
        counts: Dict[str, int] = {d: 0 for d in ids}
        for chunk in chunks:
            did = chunk.get("doc_id")
            if did in counts and counts[did] < per_doc_limit:
                balanced.append(chunk)
                counts[did] += 1
            if len(balanced) >= top_k:
                break
        return balanced

    return chunks[:top_k]


def update_chunk_metadata(
    chunk_id: str,
    metadata: Dict[str, Any],
    *,
    db_path: Optional[str] = None,
) -> None:
    """Merge classification metadata into an existing chunk."""
    collection = _get_collection(db_path)
    existing = collection.get(ids=[chunk_id], include=["metadatas"])
    if not existing or not existing["ids"]:
        return
    current = existing["metadatas"][0] or {}
    merged = {**current, **{k: v for k, v in metadata.items() if v is not None}}
    # Chroma metadata values must be scalar
    clean = {}
    for key, value in merged.items():
        if isinstance(value, (str, int, float, bool)):
            clean[key] = value
        elif value is None:
            continue
        else:
            clean[key] = str(value)
    collection.update(ids=[chunk_id], metadatas=[clean])


def delete_document(doc_id: str, *, db_path: Optional[str] = None) -> int:
    """
    Deletes all chunks belonging to a document.
    Returns the number of chunks deleted.
    """
    collection = _get_collection(db_path)

    # Get IDs first so we can report count
    existing = collection.get(where={"doc_id": doc_id}, include=[])
    count = len(existing["ids"]) if existing and existing["ids"] else 0

    if count > 0:
        collection.delete(where={"doc_id": doc_id})
        logger.info("Deleted %d chunks for doc %s", count, doc_id)

    return count


def get_document_count(*, db_path: Optional[str] = None) -> int:
    """Returns the total number of chunks in the collection."""
    collection = _get_collection(db_path)
    return collection.count()

