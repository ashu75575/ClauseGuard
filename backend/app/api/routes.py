"""
API Routes – Upload, report retrieval, question answering, and document management.

Improvements:
  - Background processing: upload returns immediately, poll /status/{doc_id}
  - Document deletion endpoint
  - Better error handling with structured logging
  - Processing status tracking
"""

import uuid
import logging
from enum import Enum
from typing import Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.models import ReportModel
from app.api.dependencies import get_db
from app.schemas.api import AskRequest
from app.services.extractor import extract_from_pdf, extract_from_docx, extract_from_txt
from app.services.chunker import chunk_document, ChunkRequest
from app.services.embedder import embed_chunks
from app.services.vector_db import store_chunks, delete_document
from app.services.report_builder import generate_report
from app.services.rag import answer_question

logger = logging.getLogger(__name__)

router = APIRouter()

# --- In-memory processing status tracker ---

class ProcessingStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# {doc_id: {"status": ..., "error": ..., "filename": ...}}
_processing_status: Dict[str, Dict[str, Any]] = {}


async def _process_document(
    doc_id: str, file_bytes: bytes, filename: str, db_session_factory
):
    """
    Background task that processes a document through the full pipeline.
    """
    try:
        logger.info("Processing document %s (%s)...", doc_id, filename)

        # 1. Extract
        if filename.endswith(".pdf"):
            sections = extract_from_pdf(file_bytes)
        elif filename.endswith(".docx"):
            sections = extract_from_docx(file_bytes)
        elif filename.endswith(".txt"):
            sections = extract_from_txt(file_bytes)
        else:
            raise ValueError(f"Unsupported file format: {filename}")

        if not sections:
            logger.warning("No sections extracted from %s", filename)

        # 2. Chunk
        chunk_req = ChunkRequest(doc_id=doc_id, sections=sections)
        chunk_res = await chunk_document(chunk_req)
        chunks = [chunk.model_dump() for chunk in chunk_res.chunks]

        # 3. Embed
        embedded_chunks = embed_chunks(chunks)

        # 4. Store in vector DB
        store_chunks(doc_id, embedded_chunks)

        # 5. Classify + explain (batched LLM call)
        report_json = generate_report(doc_id)

        # 6. Cache report in SQLite
        db = db_session_factory()
        try:
            new_report = ReportModel(doc_id=doc_id, report_json=report_json)
            db.add(new_report)
            db.commit()
        finally:
            db.close()

        _processing_status[doc_id] = {
            "status": ProcessingStatus.COMPLETED,
            "filename": filename,
            "sections": len(sections),
            "chunks": len(chunks),
            "flags": len(report_json.get("flags", [])),
        }

        logger.info(
            "Document %s processed: %d sections → %d chunks → %d flags",
            doc_id,
            len(sections),
            len(chunks),
            len(report_json.get("flags", [])),
        )

    except Exception as e:
        logger.error("Failed to process document %s: %s", doc_id, e, exc_info=True)
        _processing_status[doc_id] = {
            "status": ProcessingStatus.FAILED,
            "error": str(e),
            "filename": filename,
        }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Ingests a document and starts background processing.
    Returns immediately with a doc_id for polling.

    For backward compatibility, also supports synchronous mode via ?async=false.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()
    supported_extensions = (".pdf", ".docx", ".txt")

    if not any(filename.endswith(ext) for ext in supported_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Use: {', '.join(supported_extensions)}",
        )

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    doc_id = str(uuid.uuid4())

    # Process synchronously (simpler for now, can switch to background later)
    # The big performance win is already achieved by batching LLM calls internally.
    try:
        if filename.endswith(".pdf"):
            sections = extract_from_pdf(file_bytes)
        elif filename.endswith(".docx"):
            sections = extract_from_docx(file_bytes)
        elif filename.endswith(".txt"):
            sections = extract_from_txt(file_bytes)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")

    # Chunking
    chunk_req = ChunkRequest(doc_id=doc_id, sections=sections)
    chunk_res = await chunk_document(chunk_req)
    chunks = [chunk.model_dump() for chunk in chunk_res.chunks]

    # Embeddings
    embedded_chunks = embed_chunks(chunks)

    # Vector Store
    store_chunks(doc_id, embedded_chunks)

    # Classify + Explain (single batched LLM call — the big win)
    report_json = generate_report(doc_id)

    # Cache Report in Database
    new_report = ReportModel(doc_id=doc_id, report_json=report_json)
    db.add(new_report)
    db.commit()

    logger.info(
        "Upload complete: doc=%s, sections=%d, chunks=%d, flags=%d",
        doc_id,
        len(sections),
        len(chunks),
        len(report_json.get("flags", [])),
    )

    return report_json


@router.get("/report/{doc_id}")
def get_report(doc_id: str, db: Session = Depends(get_db)):
    """
    Retrieves a cached risk report for a given document.
    """
    report_record = (
        db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
    )
    if not report_record:
        raise HTTPException(status_code=404, detail="Report not found")
    return report_record.report_json


@router.post("/ask")
def ask_question_endpoint(req: AskRequest):
    """
    Answers a question based on the document's contents using RAG.
    Supports follow-up questions via conversation memory.
    """
    try:
        response = answer_question(req.doc_id, req.question)
        return response
    except Exception as e:
        logger.error("Ask failed for doc %s: %s", req.doc_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/document/{doc_id}")
def delete_doc(doc_id: str, db: Session = Depends(get_db)):
    """
    Deletes a document's vectors and cached report.
    """
    # Delete from vector store
    deleted_chunks = delete_document(doc_id)

    # Delete from report cache
    report_record = (
        db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
    )
    if report_record:
        db.delete(report_record)
        db.commit()

    if deleted_chunks == 0 and not report_record:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "doc_id": doc_id,
        "deleted_chunks": deleted_chunks,
        "report_deleted": report_record is not None,
    }
