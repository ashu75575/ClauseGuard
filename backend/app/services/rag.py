"""
RAG (Retrieval-Augmented Generation) – Question answering grounded in document clauses.

Improvements over the original:
  - Singleton LLM client (no per-request connection overhead)
  - Relevance threshold filtering (discard low-similarity chunks before LLM)
  - Enriched context with classification metadata
  - Retry with exponential backoff (handles transient Groq API errors)
  - Conversation memory for follow-up questions per document
  - Proper structured logging
"""

import os
import json
import logging
from typing import Dict, List, Optional
from collections import defaultdict

from openai import OpenAI

from app.services.vector_db import query_similar
from app.services.embedder import embed_text

logger = logging.getLogger(__name__)

# --- Configuration ---
TOP_K = 8  # retrieve more, then filter by relevance
RELEVANCE_THRESHOLD = 0.30  # minimum cosine similarity (1 - distance)
MIN_CHUNKS_FOR_ANSWER = 1  # require at least this many relevant chunks
MAX_HISTORY_PER_DOC = 5  # keep last N Q&A pairs for conversation context
MAX_RETRIES = 3

# --- Singleton LLM client ---
_llm_client: Optional[OpenAI] = None


def _get_llm_client() -> Optional[OpenAI]:
    """Returns a singleton Groq-compatible OpenAI client."""
    global _llm_client
    if _llm_client is not None:
        return _llm_client

    raw_key = os.environ.get("GROQ_API_KEY")
    api_key = raw_key.strip().strip('"').strip("'") if raw_key else None

    if not api_key:
        logger.warning("GROQ_API_KEY not set — RAG answering disabled.")
        return None

    _llm_client = OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    return _llm_client


# --- Conversation memory (in-process, per document) ---
_conversation_history: Dict[str, List[dict]] = defaultdict(list)


def _add_to_history(doc_id: str, question: str, answer: str):
    """Store a Q&A pair for follow-up context."""
    history = _conversation_history[doc_id]
    history.append({"question": question, "answer": answer})
    # Trim to max length
    if len(history) > MAX_HISTORY_PER_DOC:
        _conversation_history[doc_id] = history[-MAX_HISTORY_PER_DOC:]


def _get_history_context(doc_id: str) -> str:
    """Format previous Q&A pairs for the prompt."""
    history = _conversation_history.get(doc_id, [])
    if not history:
        return ""

    lines = ["Previous questions and answers about this document:"]
    for qa in history:
        lines.append(f"Q: {qa['question']}")
        lines.append(f"A: {qa['answer']}")
    lines.append("")  # blank line separator
    return "\n".join(lines)


# --- Core RAG logic ---

SYSTEM_PROMPT = """You are a highly precise legal assistant.
You will be provided with specific clauses from a contract (with their chunk_id, page, and risk classification labeled) and a question.

Rules:
1. Answer the question STRICTLY using ONLY the provided clauses.
2. If the answer is not contained within the provided clauses, say: "Not found in this document."
3. Do NOT invent or infer information outside of what is provided.
4. Cite the chunk_id(s) you used to formulate your answer.
5. Write in plain English that a non-lawyer can understand.

Output your response as a valid JSON object with this schema:
{
  "answer": "Your detailed answer...",
  "citations": [
    {"chunk_id": "...", "page": ...}
  ]
}"""


def _filter_by_relevance(chunks: List[dict]) -> List[dict]:
    """
    Filter out chunks with low cosine similarity to the query.
    ChromaDB returns distance (1 - similarity), so we convert.
    """
    filtered = []
    for chunk in chunks:
        distance = chunk.get("distance", 1.0)
        similarity = 1.0 - distance
        chunk["similarity"] = round(similarity, 4)

        if similarity >= RELEVANCE_THRESHOLD:
            filtered.append(chunk)
        else:
            logger.debug(
                "Chunk %s filtered out (similarity=%.3f < threshold=%.3f)",
                chunk.get("chunk_id", "?"),
                similarity,
                RELEVANCE_THRESHOLD,
            )

    return filtered


def _build_context(chunks: List[dict], doc_id: str) -> str:
    """Build enriched context blocks with classification metadata."""
    blocks = []
    for chunk in chunks:
        # Include similarity score and any stored classification
        meta_parts = [
            f"CHUNK_ID: {chunk['chunk_id']}",
            f"PAGE: {chunk.get('page', 'unknown')}",
            f"HEADING: {chunk.get('heading', 'unknown')}",
            f"RELEVANCE: {chunk.get('similarity', 'N/A')}",
        ]
        header = " | ".join(meta_parts)
        blocks.append(f"--- {header} ---\n{chunk['text']}\n")

    return "\n".join(blocks)


def _call_llm_with_retry(system_prompt: str, user_prompt: str) -> dict:
    """Call the LLM with simple retry logic for transient errors."""
    client = _get_llm_client()
    if client is None:
        return {"answer": "Error: GROQ_API_KEY not configured.", "citations": []}

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            raw = response.choices[0].message.content.strip()
            return json.loads(raw)

        except json.JSONDecodeError as e:
            logger.error("LLM returned invalid JSON (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            last_error = e
        except Exception as e:
            logger.error("LLM call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            last_error = e

            # Don't retry on auth errors — they won't resolve themselves
            error_str = str(e).lower()
            if "401" in error_str or "invalid_api_key" in error_str or "authentication" in error_str:
                break

    return {
        "answer": f"Error generating answer after {MAX_RETRIES} attempts: {type(last_error).__name__}",
        "citations": [],
    }


def answer_question(doc_id: str, question: str) -> dict:
    """
    Retrieves the most relevant chunks from the vector database,
    filters by relevance, and generates a grounded answer using Groq/LLaMA.
    Supports follow-up questions via conversation memory.
    """
    # 1. Embed the question
    question_vector = embed_text(question)

    # 2. Retrieve candidate chunks (more than we need, then filter)
    top_chunks = query_similar(doc_id, question_vector, top_k=TOP_K)

    if not top_chunks:
        return {
            "answer": "No relevant clauses found in this document to answer the question.",
            "citations": [],
        }

    # 3. Filter by relevance threshold
    relevant_chunks = _filter_by_relevance(top_chunks)

    if len(relevant_chunks) < MIN_CHUNKS_FOR_ANSWER:
        return {
            "answer": "No sufficiently relevant clauses found in this document to answer the question.",
            "citations": [],
        }

    # 4. Keep top 5 most relevant after filtering
    relevant_chunks = relevant_chunks[:5]

    # 5. Build enriched context
    context_str = _build_context(relevant_chunks, doc_id)

    # 6. Include conversation history for follow-ups
    history_context = _get_history_context(doc_id)

    user_prompt = ""
    if history_context:
        user_prompt += history_context + "\n"
    user_prompt += f"Context Clauses:\n{context_str}\n\nQuestion: {question}"

    # 7. Call LLM with retry
    result = _call_llm_with_retry(SYSTEM_PROMPT, user_prompt)

    # 8. Store in conversation memory
    answer_text = result.get("answer", "")
    if answer_text and not answer_text.startswith("Error"):
        _add_to_history(doc_id, question, answer_text)

    return result
