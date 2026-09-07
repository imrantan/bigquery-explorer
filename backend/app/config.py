import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

SERVICE_ACCOUNT_PATH = os.getenv("SERVICE_ACCOUNT_PATH", "").strip()
MAX_ROW_LIMIT = int(os.getenv("MAX_ROW_LIMIT", "200000"))
DEFAULT_ROW_LIMIT = int(os.getenv("DEFAULT_ROW_LIMIT", "5000"))
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

SAVED_TABLES_PATH = PROJECT_ROOT / "config" / "saved_tables.json"
