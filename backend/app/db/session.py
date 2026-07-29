"""Database helpers: session factory, paths, and lightweight schema bootstrap."""

from __future__ import annotations

import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
DB_PATH = os.path.join(DATA_DIR, "reports.db")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _table_exists(table: str) -> bool:
    return inspect(engine).has_table(table)


def _columns(table: str) -> set[str]:
    if not _table_exists(table):
        return set()
    return {col["name"] for col in inspect(engine).get_columns(table)}


def bootstrap_schema() -> None:
    """
    Create missing tables and apply additive SQLite column upgrades.

    Existing report-only databases are upgraded in place without data loss.
    """
    from app.db import models  # noqa: F401 — register metadata
    from app.db.models import DocumentModel, ReportModel

    Base.metadata.create_all(bind=engine)

    report_cols = _columns("reports")
    with engine.begin() as conn:
        if "reports" in inspect(engine).get_table_names():
            if "created_at" not in report_cols:
                conn.execute(text("ALTER TABLE reports ADD COLUMN created_at DATETIME"))
            if "updated_at" not in report_cols:
                conn.execute(text("ALTER TABLE reports ADD COLUMN updated_at DATETIME"))

    # Backfill document rows for legacy report-only records
    session = SessionLocal()
    try:
        existing_docs = {d.doc_id for d in session.query(DocumentModel.doc_id).all()}
        for report in session.query(ReportModel).all():
            if report.doc_id in existing_docs:
                continue
            flags = (report.report_json or {}).get("flags") or []
            session.add(
                DocumentModel(
                    doc_id=report.doc_id,
                    filename="Legacy document",
                    status="completed",
                    flag_count=len(flags) if isinstance(flags, list) else 0,
                    overall_risk=(report.report_json or {}).get("overall_risk"),
                )
            )
        session.commit()
    finally:
        session.close()
