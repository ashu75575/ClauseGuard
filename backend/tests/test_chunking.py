import pytest
from app.services.chunker import chunk_document, ChunkRequest, sliding_window_fallback
from app.schemas.document import Section

@pytest.mark.asyncio
async def test_chunk_document_basic():
    text = "First clause.\n\nSecond clause."
    sections = [Section(section_id="sec1", text=text, page=1)]
    req = ChunkRequest(doc_id="doc1", sections=sections)
    
    res = await chunk_document(req)
    chunks = res.chunks
    
    assert len(chunks) == 2
    assert chunks[0].text == "First clause."
    assert chunks[1].text == "Second clause."

def test_sliding_window_max_words():
    # 155 words total
    sentence = "word " * 155
    text = sentence.strip()
    
    chunks = sliding_window_fallback(text, doc_id="doc1", page=1, heading=None, max_words=150, overlap=20)
    
    # Must be split into multiple chunks
    assert len(chunks) == 2
    assert len(chunks[0].text.split()) == 150
    assert len(chunks[1].text.split()) == 25 # (155 - 150 + 20 overlap)
