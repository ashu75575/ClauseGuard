from app.db.session import SessionLocal

def get_db():
    """
    FastAPI dependency that yields a database session and closes it after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
