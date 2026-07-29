import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Use a persistent path for SQLite Database relative to this file
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "reports.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
