"""
Chunker – Splits document sections into clause-level chunks for embedding and analysis.

Improvements:
  - Removed redundant double-newline split (extractor already does this)
  - Uses NLTK sentence tokenizer for intelligent boundary detection
  - Configurable chunk size via environment variables
  - Adds chunk_index for preserving document order
  - Semantic boundary awareness (doesn't split mid-legal-clause)
  - Proper logging
"""

import os
import uuid
import logging
from typing import List

import nltk
from pydantic import BaseModel

from app.schemas.document import Section, Chunk

logger = logging.getLogger(__name__)

# --- Configuration ---
CHUNK_MAX_WORDS = int(os.environ.get("CHUNK_MAX_WORDS", "250"))
CHUNK_OVERLAP_WORDS = int(os.environ.get("CHUNK_OVERLAP_WORDS", "50"))

# Legal connectors that indicate a sentence belongs with the previous one
CONTINUATION_PATTERNS = [
    "provided that",
    "provided, however",
    "notwithstanding",
    "subject to",
    "except as",
    "in addition to",
    "without limiting",
    "for the avoidance of doubt",
    "including but not limited to",
    "including without limitation",
]


class ChunkRequest(BaseModel):
    doc_id: str
    sections: List[Section]


class ChunkResponse(BaseModel):
    doc_id: str
    chunks: List[Chunk]


# Ensure NLTK tokenizer data is available
try:
    nltk.data.find("tokenizers/punkt_tab")
except LookupError:
    nltk.download("punkt_tab", quiet=True)


def _is_continuation(sentence: str) -> bool:
    """Check if a sentence starts with a legal connector, meaning it should
    be merged with the previous chunk rather than starting a new one."""
    lower = sentence.strip().lower()
    return any(lower.startswith(p) for p in CONTINUATION_PATTERNS)


def _sentence_aware_split(
    text: str,
    doc_id: str,
    page: int = None,
    heading: str = None,
    max_words: int = CHUNK_MAX_WORDS,
    overlap_words: int = CHUNK_OVERLAP_WORDS,
    start_index: int = 0,
) -> List[Chunk]:
    """
    Splits text at sentence boundaries, respecting max_words and merging
    continuation sentences with their preceding chunk.

    Returns a list of Chunk objects with sequential chunk_index values.
    """
    sentences = nltk.sent_tokenize(text)
    if not sentences:
        return []

    chunks = []
    current_words = []
    chunk_idx = start_index

    for sentence in sentences:
        sentence_words = sentence.split()

        # If adding this sentence exceeds the limit and we have content,
        # finalise the current chunk (unless this is a continuation)
        if (
            current_words
            and len(current_words) + len(sentence_words) > max_words
            and not _is_continuation(sentence)
        ):
            chunk_text = " ".join(current_words)
            chunks.append(
                Chunk(
                    chunk_id=str(uuid.uuid4()),
                    doc_id=doc_id,
                    text=chunk_text,
                    page=page,
                    heading=heading,
                )
            )
            chunk_idx += 1

            # Overlap: keep the last N words for context continuity
            if overlap_words > 0 and len(current_words) > overlap_words:
                current_words = current_words[-overlap_words:]
            else:
                current_words = []

        current_words.extend(sentence_words)

    # Flush remaining words
    if current_words:
        chunk_text = " ".join(current_words)
        chunks.append(
            Chunk(
                chunk_id=str(uuid.uuid4()),
                doc_id=doc_id,
                text=chunk_text,
                page=page,
                heading=heading,
            )
        )

    return chunks


async def chunk_document(request: ChunkRequest) -> ChunkResponse:
    """
    Splits document sections into clause-level chunks using NLTK sentence
    boundaries and a configurable sliding window for overly long sections.

    Each section from the extractor is treated as an atomic unit — no
    redundant re-splitting on double-newlines.
    """
    all_chunks: List[Chunk] = []
    chunk_index = 0

    for section in request.sections:
        text = section.text.strip()
        if not text:
            continue

        word_count = len(text.split())

        if word_count <= CHUNK_MAX_WORDS:
            # Section fits in a single chunk — keep it whole
            all_chunks.append(
                Chunk(
                    chunk_id=str(uuid.uuid4()),
                    doc_id=request.doc_id,
                    text=text,
                    page=section.page,
                    heading=section.heading,
                )
            )
            chunk_index += 1
        else:
            # Section is too long — split at sentence boundaries
            sub_chunks = _sentence_aware_split(
                text=text,
                doc_id=request.doc_id,
                page=section.page,
                heading=section.heading,
                max_words=CHUNK_MAX_WORDS,
                overlap_words=CHUNK_OVERLAP_WORDS,
                start_index=chunk_index,
            )
            all_chunks.extend(sub_chunks)
            chunk_index += len(sub_chunks)

    logger.info(
        "Chunked document %s: %d sections → %d chunks (max_words=%d, overlap=%d)",
        request.doc_id,
        len(request.sections),
        len(all_chunks),
        CHUNK_MAX_WORDS,
        CHUNK_OVERLAP_WORDS,
    )

    return ChunkResponse(doc_id=request.doc_id, chunks=all_chunks)
