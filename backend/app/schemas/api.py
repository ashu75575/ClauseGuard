from typing import List
from pydantic import BaseModel
from app.schemas.document import Section

class IngestResponse(BaseModel):
    """
    Response model for document ingestion requests.
    """
    doc_id: str
    sections: List[Section]

class AskRequest(BaseModel):
    """
    Request model for the QA endpoint.
    """
    doc_id: str
    question: str
