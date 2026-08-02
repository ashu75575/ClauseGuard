# ClauseGuard

ClauseGuard is a local-first legal document analysis workspace. Upload a contract
(PDF, DOCX, or TXT), get a structured risk report with cited clauses, ask
grounded questions about the fine print, track obligations, compare documents,
and export findings — all from a Next.js frontend backed by a FastAPI analysis
pipeline.

> ClauseGuard provides AI-assisted document review, not legal advice. Always
> verify generated findings against the cited source language.

## Features

### Document ingestion

- Upload **PDF**, **DOCX**, or **TXT** contracts via drag-and-drop
- Clause-aware extraction with heading detection and boilerplate cleanup
- Optional **OCR** for scanned PDFs (via Tesseract)
- Sentence-aware overlapping chunks stored in **ChromaDB** with MiniLM embeddings

### Risk analysis

- Classifies clauses into categories such as liability, termination,
  auto-renewal, indemnification, confidentiality, payment terms, and more
- Severity scoring (`high` / `medium` / `low`) with plain-English explanations
- Structured report including:
  - Executive summary and overall risk
  - Review priorities with source citations
  - Extracted obligations (party, action, deadline/period, consequence)
  - Negotiation playbook (primary ask, fallback, suggested language)
  - Suggested follow-up questions

### Document Q&A (RAG)

- Intent-aware retrieval-augmented chat grounded in the uploaded document
- Citation-backed answers with links back to source clauses
- Persistent conversation history per document
- Multi-document retrieval scope when needed

### Workspace tools

- Document library with risk badges and severity summaries
- Obligations timeline with status tracking
  (`unconfirmed` → `confirmed` → `completed` / `dismissed`)
- Side-by-side **clause comparison** across two contracts
- **PDF** and **DOCX** export of the full analysis report
- Dark/light theme support in the UI

### Resilience

- Groq-powered classification, synthesis, and grounded answers when configured
- Local-model and deterministic fallbacks when the LLM is unavailable
- Citation validation so answers only cite chunks present in retrieved evidence

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Recharts |
| Backend | FastAPI, SQLAlchemy, SQLite, Alembic |
| ML / retrieval | sentence-transformers (MiniLM), ChromaDB, Groq (Llama 3.3), optional local classifiers |
| Extraction | pdfplumber, python-docx, Tesseract OCR |

## Repository structure

```text
.
├── frontend/   # Next.js application (upload, dashboard, chat, compare, export)
└── backend/    # FastAPI API and document-analysis services
```

Deeper backend architecture, API reference, and data-model docs live in
[`backend/README.md`](backend/README.md).

## How it works

```text
Upload → Extract → Chunk → Embed → Classify → Synthesize report
                                              ↓
                         SQLite workspace  +  ChromaDB vectors
                                              ↓
                    Chat (RAG) · Compare · Obligations · Export
```

1. The frontend uploads a contract to `POST /upload`.
2. The backend extracts sections, builds overlapping chunks, and embeds them.
3. Chunks are classified for legal risk and synthesized into a structured report.
4. The workspace stores the report, obligations, and chat history in SQLite;
   vectors live in ChromaDB.
5. Users review findings, ask questions, update obligation status, compare
   documents, or export the report.

## Prerequisites

- Node.js 20 or newer
- Python 3.9 or newer (3.11 recommended)
- Tesseract OCR (optional, for scanned PDFs)
- A [Groq](https://groq.com) API key for full LLM-powered analysis and chat

Install Tesseract on macOS:

```bash
brew install tesseract
```

## Run locally

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

Add a `GROQ_API_KEY` to `backend/.env` to enable Groq-powered features.
Without it, the API falls back to local models where possible; full generative
document Q&A requires Groq.

Useful URLs:

- API: [http://localhost:8001](http://localhost:8001)
- OpenAPI docs: [http://localhost:8001/docs](http://localhost:8001/docs)
- Health: [http://localhost:8001/health](http://localhost:8001/health)

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Key backend settings in `backend/.env`:

```env
GROQ_API_KEY=                 # Required for full AI classification, reports, and chat
FRONTEND_URLS=http://localhost:3000
CHUNK_MAX_WORDS=250
CHUNK_OVERLAP_WORDS=50
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | API status and LLM configuration |
| `POST` | `/upload` | Upload and analyze a document |
| `GET` | `/documents` | List workspace documents |
| `GET` | `/documents/{doc_id}` | Document detail and report |
| `GET` | `/report/{doc_id}` | Structured risk report |
| `POST` | `/ask` | Grounded document Q&A |
| `GET` | `/chat/{doc_id}` | Persistent chat history |
| `PATCH` | `/obligations/{id}` | Update obligation status |
| `POST` | `/compare` | Compare clauses across documents |
| `GET` | `/export/{doc_id}` | Export report as PDF or DOCX |
| `DELETE` | `/document/{doc_id}` | Remove document and related data |

## Checks

```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend
cd backend
PYTHONPATH=. pytest tests/
```

## Notes

- Runtime data (`backend/data`: SQLite DB, uploads, ChromaDB) is local and
  Git-ignored. Deployments need persistent filesystem storage.
- Designed as a **single-user** local workspace — no authentication yet.
- Local environment files, dependencies, caches, databases, generated model
  artifacts, and build output are excluded from Git.
