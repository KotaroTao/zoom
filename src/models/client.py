"""Client model for managing clients/customers."""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


class ClientStatus(str, Enum):
    """Status of client relationship."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class ClientBase(BaseModel):
    """Base client model."""

    name: str
    description: Optional[str] = None
    status: ClientStatus = ClientStatus.ACTIVE
    tags: Optional[List[str]] = None


class ClientCreate(ClientBase):
    """Model for creating a new client."""

    # Optional fields for auto-identification
    zoom_meeting_ids: Optional[List[str]] = None
    title_patterns: Optional[List[str]] = None
    calendar_event_patterns: Optional[List[str]] = None


class ClientUpdate(BaseModel):
    """Model for updating a client."""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ClientStatus] = None
    tags: Optional[List[str]] = None
    cumulative_summary: Optional[str] = None
    zoom_meeting_ids: Optional[List[str]] = None
    title_patterns: Optional[List[str]] = None
    calendar_event_patterns: Optional[List[str]] = None


class Client(ClientBase):
    """Full client model with all fields."""

    id: int
    cumulative_summary: Optional[str] = None
    zoom_meeting_ids: List[str] = Field(default_factory=list)
    title_patterns: List[str] = Field(default_factory=list)
    calendar_event_patterns: List[str] = Field(default_factory=list)
    meeting_count: int = 0
    last_meeting_at: Optional[datetime] = None
    notion_page_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class ClientSummary(BaseModel):
    """Summary of a client for dashboard display."""

    id: int
    name: str
    status: ClientStatus
    meeting_count: int
    last_meeting_at: Optional[datetime]
    recent_decisions: Optional[List[str]] = None
    pending_actions: Optional[List[str]] = None


class ClientMeetingHistory(BaseModel):
    """Client with full meeting history."""

    client: Client
    meetings: List["Recording"] = Field(default_factory=list)
    cumulative_summary: Optional[str] = None
    key_milestones: Optional[List[str]] = None
    open_issues: Optional[List[str]] = None
    next_actions: Optional[List[str]] = None


# Forward reference update
from src.models.recording import Recording

ClientMeetingHistory.model_rebuild()
