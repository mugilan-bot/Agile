import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
WORKSPACE_DATA_DIR = BASE_DIR / "data"

class Settings(BaseSettings):
    PROJECT_NAME: str = "FoodFlow"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_LOCAL_MODE: bool = os.getenv("IS_LOCAL_MODE", "true").lower() in ("true", "1")
    
    # Database - SQLite locally, configurable for Azure SQL or PostgreSQL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{BASE_DIR / 'foodflow.db'}"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "foodflow-super-secret-development-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Directories
    DATA_DIR: Path = WORKSPACE_DATA_DIR
    SAMPLE_DATA_DIR: Path = WORKSPACE_DATA_DIR / "sample"
    GENERATED_DATA_DIR: Path = WORKSPACE_DATA_DIR / "generated"
    PROCESSED_DATA_DIR: Path = WORKSPACE_DATA_DIR / "processed"
    MODELS_DIR: Path = BASE_DIR / "backend" / "app" / "ml" / "saved_models"
    
    # Business Logic Defaults
    DEFAULT_PREP_BUFFER: float = 0.10  # 10% safety buffer
    WASTE_ALERT_THRESHOLD_PCT: float = 8.0  # 8% threshold triggers waste alert
    MIN_RETRAIN_RECORDS: int = 500  # Minimum records required for retraining trigger
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure directories exist
settings.SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.GENERATED_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
