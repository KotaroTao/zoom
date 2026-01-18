"""Dashboard API routes."""

from src.api.dashboard import router as dashboard_router
from src.api.clients import router as clients_router
from src.api.meetings import router as meetings_router

__all__ = ["dashboard_router", "clients_router", "meetings_router"]
