from typing import Optional, List
from pydantic import BaseModel

class Section(BaseModel):
    """
    Represents an extracted logical block from a document.
    """
    section_id: str
    heading: Optional[str] = None
    text: str
    page: Optional[int] = None

class Chunk(BaseModel):
    """
    Represents a smaller, granular text chunk processed for embeddings.
    """
    chunk_id: str
    doc_id: str
    text: str
    page: Optional[int] = None
    heading: Optional[str] = None
