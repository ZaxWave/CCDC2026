# src/backend/app/db/database.py
import os
import warnings
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 加载 src/backend/.env（相对本文件向上两层：db/ → app/ → backend/）
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path)

# Read DATABASE_URL from environment with secure fallback handling
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Development fallback to SQLite
    SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"
    warnings.warn(
        "⚠️ DATABASE WARNING: Using SQLite development database. "
        "Set DATABASE_URL environment variable for production (e.g., PostgreSQL).",
        RuntimeWarning
    )

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
