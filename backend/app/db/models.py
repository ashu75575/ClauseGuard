from sqlalchemy import Column, String, JSON
from app.db.session import Base, engine

class ReportModel(Base):
    """
    SQLAlchemy Model representing a cached risk report.
    """
    __tablename__ = "reports"
    
    doc_id = Column(String, primary_key=True, index=True)
    report_json = Column(JSON, nullable=False)

# Ensure tables are created when this module is loaded
Base.metadata.create_all(bind=engine)
