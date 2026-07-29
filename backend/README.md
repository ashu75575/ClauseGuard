# ClauseGuard Backend

ClauseGuard is a powerful legal document analysis and risk detection API. It ingests contracts (PDF, DOCX, TXT), breaks them down into semantic clauses, generates vector embeddings, classifies risks using NLP (Zero-Shot / Fine-Tuned models), and provides plain-English explanations for non-lawyers using Large Language Models.

The backend is built with a professional **Domain-Driven Design (DDD)** architecture using **FastAPI**.

## 🏗️ Project Structure

The codebase is organized into modular services to separate routing, database schemas, data validation, and core business/ML logic.

```text
backend/
├── app/
│   ├── main.py                 # FastAPI application factory and CORS configuration
│   ├── api/                    # API Routing Layer
│   │   ├── dependencies.py     # FastAPI dependencies (e.g., Database Session)
│   │   └── routes.py           # API Endpoints (/upload, /ask, /report/{doc_id})
│   ├── db/                     # Database Layer
│   │   ├── session.py          # SQLAlchemy Engine & SessionLocal setup
│   │   └── models.py           # SQLite Table Definitions (ReportModel)
│   ├── schemas/                # Pydantic Models (Data Validation & Serialization)
│   │   ├── api.py              # Request/Response schemas (AskRequest, etc.)
│   │   └── document.py         # Internal representations (Section, Chunk)
│   └── services/               # Core Business and Machine Learning Logic
│       ├── extractor.py        # PDF / DOCX / TXT text extraction and heuristics
│       ├── chunker.py          # Clause-aware chunking and sliding window logic
│       ├── embedder.py         # SentenceTransformer (`all-MiniLM-L6-v2`) embeddings
│       ├── vector_db.py        # ChromaDB interaction for vector storage and RAG
│       ├── classifier.py       # Zero-shot (BART) / Fine-tuned DistilBERT risk classification
│       ├── report_builder.py   # Claude 3.5 Sonnet integrations for plain-English explanations
│       └── rag.py              # Retrieval-Augmented Generation for grounded QA
├── data/                       # Local persistent storage for SQLite and ChromaDB (auto-generated)
├── scripts/                    # Standalone Machine Learning Scripts
│   ├── prepare_dataset.py      # Prepares huggingface datasets into training CSVs
│   ├── train_classifier.py     # Fine-tunes a DistilBERT text classification model
│   └── sanity_check.py         # Verifies the semantic similarity logic of the embedder
├── tests/                      # Pytest automated test suite
└── requirements.txt            # Python dependencies
```

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9+
- `pip` and `virtualenv`

### 2. Installation
Navigate to the `backend` directory and set up a virtual environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

*(Note: The embedding model requires `numpy<2.0.0` due to ChromaDB compatibility).*

### 3. Environment Variables
Copy the provided template and add a Groq API key to enable LLM-powered
classification, RAG, and plain-English explanations. The application falls
back to local models when the key is not provided.

```bash
cp .env.example .env
# Then set GROQ_API_KEY in .env
```

### 4. Running the Server
Start the FastAPI development server:

```bash
uvicorn app.main:app --reload --port 8001
```
The API will be available at `http://localhost:8001`. You can view the automatic interactive API documentation at `http://localhost:8001/docs`.

## 🧪 Testing

The codebase includes a comprehensive suite of automated tests using `pytest`.

To run the tests:
```bash
source venv/bin/activate
PYTHONPATH=. pytest tests/
```

## 🧠 How the Pipeline Works (The `/upload` Endpoint)

When a document is posted to `/upload`, the orchestrator routes it through the following pipeline sequentially:

1. **Extraction (`services/extractor.py`)**: Uses `pdfplumber`, `python-docx`, or basic text parsing to pull raw text and detect headings. It includes an OCR fallback via `pytesseract` for scanned PDFs.
2. **Chunking (`services/chunker.py`)**: Slices the extracted sections into granular clauses. Extremely long blocks are sliced utilizing a specialized sliding window algorithm.
3. **Embedding (`services/embedder.py`)**: Converts every clause into a high-dimensional vector space using `sentence-transformers`.
4. **Vector Storage (`services/vector_db.py`)**: Persists the chunk vectors into a local `ChromaDB` instance to enable lightning-fast semantic search for the RAG QA endpoint.
5. **Classification (`services/classifier.py`)**: Evaluates every chunk against legal risk categories (e.g., `liability`, `termination`, `auto_renewal`). Uses a zero-shot `BART` model by default, but automatically switches to a fine-tuned `DistilBERT` model if you have run the training scripts.
6. **Report Generation (`services/report_builder.py`)**: Collects all flagged (risky) clauses and queries Anthropic's Claude to translate the dense legal jargon into 1-2 plain-English sentences.
7. **Caching (`db/`)**: The finalized report JSON is saved permanently to a local SQLite database, so subsequent requests for the same document via `/report/{doc_id}` return instantly without re-triggering the ML pipeline.
