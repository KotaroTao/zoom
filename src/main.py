"""
Zoom YouTube Automation - Main FastAPI Application.

This application automatically processes Zoom cloud recordings:
1. Receives webhook from Zoom when recording is complete
2. Downloads the recording
3. Uploads to YouTube (unlisted)
4. Transcribes using OpenAI Whisper
5. Generates summary using GPT
6. Records to Notion and Google Sheets
7. Updates Google Calendar event
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from src.config import get_settings
from src.database import db
from src.utils.logger import setup_logger, get_logger
from src.webhook import zoom_router
from src.api import dashboard_router, clients_router, meetings_router

settings = get_settings()

# Setup logging
logger = setup_logger(
    name="zoom_automation",
    level=settings.log_level,
    log_file=settings.log_file,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting Zoom YouTube Automation...")

    # Create necessary directories
    Path(settings.download_dir).mkdir(parents=True, exist_ok=True)
    Path("data").mkdir(parents=True, exist_ok=True)
    Path("logs").mkdir(parents=True, exist_ok=True)
    Path("credentials").mkdir(parents=True, exist_ok=True)

    # Initialize database
    await db.init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Zoom YouTube Automation",
    description="Automatically process Zoom recordings to YouTube with transcription and summary",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Include routers
app.include_router(zoom_router)
app.include_router(dashboard_router)
app.include_router(clients_router)
app.include_router(meetings_router)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Zoom YouTube Automation",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# Serve frontend static files if they exist
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
    )
