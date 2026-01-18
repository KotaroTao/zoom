"""Recording model for Zoom recordings."""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


class ProcessingStatus(str, Enum):
    """Status of recording processing."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    UPLOADING_YOUTUBE = "uploading_youtube"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"
    SAVING = "saving"
    COMPLETED = "completed"
    FAILED = "failed"


class RecordingBase(BaseModel):
    """Base recording model."""

    zoom_meeting_id: str
    zoom_meeting_uuid: str
    topic: str
    start_time: datetime
    duration_minutes: int
    host_email: str
    recording_url: Optional[str] = None
    recording_type: str = "MP4"


class RecordingCreate(RecordingBase):
    """Model for creating a new recording."""

    pass


class RecordingUpdate(BaseModel):
    """Model for updating a recording."""

    status: Optional[ProcessingStatus] = None
    youtube_url: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[str] = None
    client_id: Optional[int] = None
    error_message: Optional[str] = None
    calendar_event_id: Optional[str] = None
    notion_page_id: Optional[str] = None


class Recording(RecordingBase):
    """Full recording model with all fields."""

    id: int
    status: ProcessingStatus = ProcessingStatus.PENDING
    youtube_url: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[str] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    error_message: Optional[str] = None
    calendar_event_id: Optional[str] = None
    notion_page_id: Optional[str] = None
    retry_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecordingFile(BaseModel):
    """Zoom recording file information."""

    file_id: str
    file_type: str
    file_size: int
    download_url: str
    recording_start: datetime
    recording_end: datetime


class ZoomWebhookPayload(BaseModel):
    """Zoom webhook payload for recording completed event."""

    event: str
    event_ts: int
    payload: dict

    @property
    def account_id(self) -> str:
        return self.payload.get("account_id", "")

    @property
    def meeting_id(self) -> str:
        obj = self.payload.get("object", {})
        return str(obj.get("id", ""))

    @property
    def meeting_uuid(self) -> str:
        obj = self.payload.get("object", {})
        return obj.get("uuid", "")

    @property
    def topic(self) -> str:
        obj = self.payload.get("object", {})
        return obj.get("topic", "")

    @property
    def start_time(self) -> Optional[datetime]:
        obj = self.payload.get("object", {})
        start = obj.get("start_time")
        if start:
            return datetime.fromisoformat(start.replace("Z", "+00:00"))
        return None

    @property
    def duration(self) -> int:
        obj = self.payload.get("object", {})
        return obj.get("duration", 0)

    @property
    def host_email(self) -> str:
        obj = self.payload.get("object", {})
        return obj.get("host_email", "")

    @property
    def recording_files(self) -> List[RecordingFile]:
        obj = self.payload.get("object", {})
        files = obj.get("recording_files", [])
        result = []
        for f in files:
            if f.get("file_type") in ["MP4", "M4A"]:
                result.append(
                    RecordingFile(
                        file_id=f.get("id", ""),
                        file_type=f.get("file_type", ""),
                        file_size=f.get("file_size", 0),
                        download_url=f.get("download_url", ""),
                        recording_start=datetime.fromisoformat(
                            f.get("recording_start", "").replace("Z", "+00:00")
                        ),
                        recording_end=datetime.fromisoformat(
                            f.get("recording_end", "").replace("Z", "+00:00")
                        ),
                    )
                )
        return result

    def get_mp4_file(self) -> Optional[RecordingFile]:
        """Get the MP4 recording file."""
        for f in self.recording_files:
            if f.file_type == "MP4":
                return f
        return None

    def get_audio_file(self) -> Optional[RecordingFile]:
        """Get the audio recording file (M4A)."""
        for f in self.recording_files:
            if f.file_type == "M4A":
                return f
        return None
