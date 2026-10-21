import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.database.session import engine, Base
from backend.app.database.init_db import init_db
from backend.app.services.prediction_service import get_active_model
from backend.app.api.endpoints import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("foodflow")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FoodFlow application...")
    # Initialize database tables and seed baseline data if needed
    init_db()
    # Preload and cache ML model
    try:
        get_active_model()
        logger.info("Machine learning prediction engine initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to preload ML model: {e}")
    yield
    logger.info("Shutting down FoodFlow application...")

app = FastAPI(
    title="FoodFlow API",
    description=(
        "AI-Based Food Demand Prediction, Waste Prevention & Intelligent Redistribution Platform API. "
        "Supports demand forecasting, preparation decision engine, inventory tracking, "
        "waste analytics, surplus recipient matching, and controlled retraining."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": str(exc),
            "path": request.url.path,
        }
    )

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "project": "FoodFlow",
        "tagline": "AI-Based Food Demand Prediction & Intelligent Redistribution Platform",
        "version": settings.VERSION,
        "mode": "Local Development" if settings.IS_LOCAL_MODE else "Azure Cloud",
        "docs_url": "/docs",
        "api_v1_prefix": settings.API_V1_STR,
        "status": "operational",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
