"""API routes for ClauseGuard legal workspace."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.db.models import ChatMessageModel, DocumentModel, ObligationModel, ReportModel
from app.db.session import UPLOAD_DIR
from app.schemas.api import (
    AskRequest,
    AskResponse,
    ChatMessageOut,
    Citation,
    CompareRequest,
    ComparisonResult,
    DocumentDetail,
    DocumentSummary,
    ObligationOut,
    ObligationUpdateRequest,
    StatusResponse,
    StructuredReport,
)
from app.services.chunker import ChunkRequest, chunk_document
from app.services.compare import compare_documents
from app.services.embedder import embed_chunks
from app.services.exporter import build_docx, build_pdf
from app.services.extractor import extract_from_docx, extract_from_pdf, extract_from_txt
from app.services.rag import answer_question
from app.services.report_builder import generate_report
from app.services.vector_db import delete_document, store_chunks

logger = logging.getLogger(__name__)
router = APIRouter()


def _severity_summary(flags: List[dict]) -> Dict[str, int]:
    summary = {"high": 0, "medium": 0, "low": 0}
    for flag in flags or []:
        sev = flag.get("severity")
        if sev in summary:
            summary[sev] += 1
    return summary


def _document_summary(doc: DocumentModel, report_json: Optional[dict] = None) -> DocumentSummary:
    flags = (report_json or {}).get("flags") if report_json else None
    if flags is None and doc.report:
        flags = (doc.report.report_json or {}).get("flags")
    return DocumentSummary(
        doc_id=doc.doc_id,
        filename=doc.filename,
        content_type=doc.content_type,
        status=doc.status,
        error=doc.error,
        section_count=doc.section_count or 0,
        chunk_count=doc.chunk_count or 0,
        flag_count=doc.flag_count or 0,
        overall_risk=doc.overall_risk,
        severity_summary=_severity_summary(flags or []),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _persist_obligations(db: Session, doc_id: str, obligations: List[dict]) -> List[dict]:
    db.query(ObligationModel).filter(ObligationModel.doc_id == doc_id).delete(synchronize_session=False)
    saved = []
    for item in obligations or []:
        row = ObligationModel(
            doc_id=doc_id,
            party=item.get("party"),
            action=item.get("action") or "",
            trigger=item.get("trigger"),
            deadline=item.get("deadline"),
            period=item.get("period"),
            recurrence=item.get("recurrence"),
            consequence=item.get("consequence"),
            confidence=item.get("confidence"),
            status=item.get("status") or "unconfirmed",
            source_chunk_ids=item.get("source_chunk_ids") or [],
        )
        db.add(row)
        db.flush()
        payload = dict(item)
        payload["id"] = row.id
        payload["doc_id"] = doc_id
        payload["status"] = row.status
        saved.append(payload)
    return saved


def _normalize_report(report_json: dict, obligations: Optional[List[ObligationModel]] = None) -> dict:
    data = dict(report_json or {})
    data.setdefault("flags", [])
    data.setdefault("executive_summary", "")
    data.setdefault("overall_risk", "low")
    data.setdefault("review_priorities", [])
    data.setdefault("negotiation_playbook", [])
    data.setdefault("suggested_questions", [])
    data.setdefault(
        "disclaimer",
        "AI-assisted legal review for information only. Not legal advice. "
        "Verify all findings against the source document before relying on them.",
    )
    if obligations is not None:
        data["obligations"] = [
            {
                "id": o.id,
                "doc_id": o.doc_id,
                "party": o.party,
                "action": o.action,
                "trigger": o.trigger,
                "deadline": o.deadline,
                "period": o.period,
                "recurrence": o.recurrence,
                "consequence": o.consequence,
                "confidence": o.confidence,
                "status": o.status,
                "source_chunk_ids": o.source_chunk_ids or [],
            }
            for o in obligations
        ]
    else:
        data.setdefault("obligations", [])
    return data


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename
    lower = filename.lower()
    supported = (".pdf", ".docx", ".txt")
    if not any(lower.endswith(ext) for ext in supported):
        raise HTTPException(status_code=400, detail=f"Unsupported file format. Use: {', '.join(supported)}")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    doc_id = str(uuid.uuid4())
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(lower)[1] or ".bin"
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}{ext}")
    with open(file_path, "wb") as handle:
        handle.write(file_bytes)

    now = datetime.utcnow()
    document = DocumentModel(
        doc_id=doc_id,
        filename=filename,
        content_type=file.content_type,
        status="processing",
        file_path=file_path,
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.commit()

    try:
        if lower.endswith(".pdf"):
            sections = extract_from_pdf(file_bytes)
        elif lower.endswith(".docx"):
            sections = extract_from_docx(file_bytes)
        else:
            sections = extract_from_txt(file_bytes)

        chunk_req = ChunkRequest(doc_id=doc_id, sections=sections)
        chunk_res = await chunk_document(chunk_req)
        chunks = [chunk.model_dump() for chunk in chunk_res.chunks]
        embedded_chunks = embed_chunks(chunks)
        store_chunks(doc_id, embedded_chunks)

        report_json = generate_report(doc_id)
        saved_obligations = _persist_obligations(db, doc_id, report_json.get("obligations") or [])
        report_json["obligations"] = saved_obligations

        report_row = ReportModel(doc_id=doc_id, report_json=report_json, created_at=now, updated_at=now)
        db.add(report_row)

        document.status = "completed"
        document.section_count = len(sections)
        document.chunk_count = len(chunks)
        document.flag_count = len(report_json.get("flags") or [])
        document.overall_risk = report_json.get("overall_risk")
        document.updated_at = datetime.utcnow()
        document.error = None
        db.commit()

        logger.info(
            "Upload complete: doc=%s flags=%d risk=%s",
            doc_id,
            document.flag_count,
            document.overall_risk,
        )
        return report_json
    except Exception as e:
        logger.error("Upload failed for %s: %s", doc_id, e, exc_info=True)
        document.status = "failed"
        document.error = str(e)
        document.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")


@router.get("/documents", response_model=List[DocumentSummary])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).order_by(DocumentModel.created_at.desc()).all()
    return [_document_summary(doc) for doc in docs]


@router.get("/documents/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    report_json = doc.report.report_json if doc.report else None
    summary = _document_summary(doc, report_json)
    report = None
    if report_json:
        report = StructuredReport(**_normalize_report(report_json, doc.obligations))
    return DocumentDetail(**summary.model_dump(), report=report)


@router.get("/status/{doc_id}", response_model=StatusResponse)
def get_status(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return StatusResponse(
        doc_id=doc.doc_id,
        status=doc.status,
        filename=doc.filename,
        error=doc.error,
        flags=doc.flag_count,
    )


@router.get("/report/{doc_id}")
def get_report(doc_id: str, db: Session = Depends(get_db)):
    report_record = db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
    if not report_record:
        raise HTTPException(status_code=404, detail="Report not found")
    obligations = (
        db.query(ObligationModel)
        .filter(ObligationModel.doc_id == doc_id)
        .order_by(ObligationModel.id.asc())
        .all()
    )
    payload = dict(report_record.report_json or {})
    # Upgrade legacy flag-only reports in place with deterministic structured fields
    if not payload.get("executive_summary") and payload.get("flags"):
        from app.services.report_builder import _build_playbook, _synthesize_report

        synthesis = _synthesize_report(payload.get("flags") or [])
        payload.update(synthesis)
        if not payload.get("negotiation_playbook"):
            payload["negotiation_playbook"] = _build_playbook(payload.get("flags") or [])
        if not obligations:
            saved = _persist_obligations(db, doc_id, payload.get("obligations") or [])
            payload["obligations"] = saved
            obligations = (
                db.query(ObligationModel)
                .filter(ObligationModel.doc_id == doc_id)
                .order_by(ObligationModel.id.asc())
                .all()
            )
        report_record.report_json = payload
        report_record.updated_at = datetime.utcnow()
        doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
        if doc:
            doc.overall_risk = payload.get("overall_risk")
            doc.flag_count = len(payload.get("flags") or [])
            doc.updated_at = datetime.utcnow()
        db.commit()
    return _normalize_report(payload, obligations)


@router.get("/chat/{doc_id}", response_model=List[ChatMessageOut])
def get_chat(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.doc_id == doc_id)
        .order_by(ChatMessageModel.created_at.asc(), ChatMessageModel.id.asc())
        .all()
    )
    return [
        ChatMessageOut(
            id=m.id,
            doc_id=m.doc_id,
            role=m.role,
            content=m.content,
            citations=[Citation(**c) for c in (m.citations_json or []) if isinstance(c, dict) and c.get("chunk_id")],
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/ask", response_model=AskResponse)
def ask_question_endpoint(req: AskRequest, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == req.doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        response = answer_question(req.doc_id, req.question, db=db, doc_ids=req.doc_ids)
        return AskResponse(
            status=response.get("status") or "answered",
            answer_type=response.get("answer_type") or "grounded_answer",
            answer=response.get("answer") or "",
            citations=[Citation(**c) for c in response.get("citations") or []],
            message_id=response.get("message_id"),
            follow_ups=response.get("follow_ups") or [],
        )
    except Exception as e:
        logger.error("Ask failed for doc %s: %s", req.doc_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/obligations/{obligation_id}", response_model=ObligationOut)
def update_obligation(obligation_id: int, req: ObligationUpdateRequest, db: Session = Depends(get_db)):
    row = db.query(ObligationModel).filter(ObligationModel.id == obligation_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Obligation not found")
    row.status = req.status
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return ObligationOut(
        id=row.id,
        doc_id=row.doc_id,
        party=row.party,
        action=row.action,
        trigger=row.trigger,
        deadline=row.deadline,
        period=row.period,
        recurrence=row.recurrence,
        consequence=row.consequence,
        confidence=row.confidence,
        status=row.status,  # type: ignore[arg-type]
        source_chunk_ids=row.source_chunk_ids or [],
    )


@router.post("/compare", response_model=ComparisonResult)
def compare_endpoint(req: CompareRequest, db: Session = Depends(get_db)):
    try:
        result = compare_documents(db, req.doc_ids, req.categories)
        return ComparisonResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Compare failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/{doc_id}")
def export_report(doc_id: str, format: str = Query("pdf", pattern="^(pdf|docx)$"), db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    report_record = db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
    if not doc or not report_record:
        raise HTTPException(status_code=404, detail="Document report not found")

    obligations = (
        db.query(ObligationModel)
        .filter(ObligationModel.doc_id == doc_id)
        .order_by(ObligationModel.id.asc())
        .all()
    )
    report = _normalize_report(report_record.report_json, obligations)

    if format == "pdf":
        payload = build_pdf(report, doc.filename)
        media = "application/pdf"
        filename = f"{doc.filename.rsplit('.', 1)[0]}_clauseguard.pdf"
    else:
        payload = build_docx(report, doc.filename)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{doc.filename.rsplit('.', 1)[0]}_clauseguard.docx"

    return Response(
        content=payload,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/document/{doc_id}")
def delete_doc(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.doc_id == doc_id).first()
    report_record = db.query(ReportModel).filter(ReportModel.doc_id == doc_id).first()
    deleted_chunks = delete_document(doc_id)

    file_path = doc.file_path if doc else None
    if doc:
        db.delete(doc)
        db.commit()
    elif report_record:
        db.delete(report_record)
        db.commit()
    else:
        if deleted_chunks == 0:
            raise HTTPException(status_code=404, detail="Document not found")

    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            logger.warning("Failed to remove upload file %s", file_path)

    return {
        "doc_id": doc_id,
        "deleted_chunks": deleted_chunks,
        "report_deleted": True,
    }
