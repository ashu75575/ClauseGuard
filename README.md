# ClauseGuard

ClauseGuard is a full-stack legal document analysis project. The Next.js
frontend and FastAPI backend live together in this repository.

## Repository structure

```text
.
├── frontend/   # Next.js application
└── backend/    # FastAPI API and document-analysis services
```

## Prerequisites

- Node.js 20 or newer
- Python 3.9 or newer
- Tesseract OCR (optional, for scanned PDFs)

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
Without it, the API falls back to local models. API documentation is available
at [http://localhost:8001/docs](http://localhost:8001/docs).

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

Local environment files, dependencies, caches, databases, generated model
artifacts, and build output are excluded from Git.
