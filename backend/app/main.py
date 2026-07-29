import os
import logging

from dotenv import load_dotenv

load_dotenv()

# --- Logging configuration ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.db.session import bootstrap_schema

app = FastAPI(title="ClauseGuard API", version="0.3.0")

# Configure CORS for local development
frontend_urls = os.environ.get(
    "FRONTEND_URLS",
    "http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[url.strip() for url in frontend_urls],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def validate_config():
    """
    Validates required environment variables at startup.
    Logs warnings for missing keys instead of silently failing per-request.
    """
    bootstrap_schema()

    groq_key = os.environ.get("GROQ_API_KEY", "").strip().strip('"').strip("'")
    if not groq_key:
        logger.warning(
            "⚠️  GROQ_API_KEY not found in environment. "
            "LLM-based classification and RAG will fall back to local models."
        )
    else:
        # Mask the key for logging (show first 8 + last 4 chars)
        masked = groq_key[:8] + "..." + groq_key[-4:] if len(groq_key) > 12 else "***"
        logger.info("✅ GROQ_API_KEY loaded (%s)", masked)

    logger.info("ClauseGuard API v0.3.0 ready.")


@app.get("/health")
def health_check():
    """
    Health check endpoint for the API.
    """
    groq_configured = bool(os.environ.get("GROQ_API_KEY", "").strip())
    return {
        "status": "ok",
        "version": "0.3.0",
        "llm_configured": groq_configured,
    }


# Include the main routing layer
app.include_router(router)
