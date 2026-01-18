"""Meeting management API endpoints."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, DBRecording, DBClient
from src.models.recording import ProcessingStatus
from src.workers.processing_worker import process_recording

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


class MeetingResponse(BaseModel):
    """Meeting response model."""

    id: int
    zoom_meeting_id: str
    topic: str
    start_time: datetime
    duration_minutes: int
    status: str
    youtube_url: Optional[str]
    client_id: Optional[int]
    client_name: Optional[str]
    created_at: datetime


class MeetingDetailResponse(MeetingResponse):
    """Detailed meeting response."""

    transcript: Optional[str]
    summary: Optional[str]
    decisions: Optional[str]
    action_items: Optional[str]
    recording_url: Optional[str]
    notion_page_id: Optional[str]
    calendar_event_id: Optional[str]
    error_message: Optional[str]
    retry_count: int


@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_db),
):
    """List meetings with optional filters."""
    query = (
        select(DBRecording, DBClient.name)
        .outerjoin(DBClient, DBRecording.client_id == DBClient.id)
        .order_by(DBRecording.start_time.desc())
    )

    if client_id:
        query = query.where(DBRecording.client_id == client_id)
    if status:
        query = query.where(DBRecording.status == ProcessingStatus(status))

    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    rows = result.all()

    return [
        MeetingResponse(
            id=recording.id,
            zoom_meeting_id=recording.zoom_meeting_id,
            topic=recording.topic,
            start_time=recording.start_time,
            duration_minutes=recording.duration_minutes,
            status=recording.status.value,
            youtube_url=recording.youtube_url,
            client_id=recording.client_id,
            client_name=client_name,
            created_at=recording.created_at,
        )
        for recording, client_name in rows
    ]


@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting(
    meeting_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Get detailed meeting information."""
    result = await session.execute(
        select(DBRecording, DBClient.name)
        .outerjoin(DBClient, DBRecording.client_id == DBClient.id)
        .where(DBRecording.id == meeting_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Meeting not found")

    recording, client_name = row

    return MeetingDetailResponse(
        id=recording.id,
        zoom_meeting_id=recording.zoom_meeting_id,
        topic=recording.topic,
        start_time=recording.start_time,
        duration_minutes=recording.duration_minutes,
        status=recording.status.value,
        youtube_url=recording.youtube_url,
        client_id=recording.client_id,
        client_name=client_name,
        created_at=recording.created_at,
        transcript=recording.transcript,
        summary=recording.summary,
        decisions=recording.decisions,
        action_items=recording.action_items,
        recording_url=recording.recording_url,
        notion_page_id=recording.notion_page_id,
        calendar_event_id=recording.calendar_event_id,
        error_message=recording.error_message,
        retry_count=recording.retry_count,
    )


@router.post("/{meeting_id}/retry")
async def retry_meeting(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """Retry processing a failed meeting."""
    result = await session.execute(
        select(DBRecording).where(DBRecording.id == meeting_id)
    )
    recording = result.scalar_one_or_none()

    if not recording:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if recording.status != ProcessingStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Meeting is not in failed state (current: {recording.status.value})"
        )

    # Reset status
    recording.status = ProcessingStatus.PENDING
    recording.error_message = None
    recording.updated_at = datetime.utcnow()
    await session.commit()

    # Queue for processing
    background_tasks.add_task(process_recording, meeting_id)

    return {"status": "processing", "message": "Retry started"}


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Delete a meeting record."""
    result = await session.execute(
        select(DBRecording).where(DBRecording.id == meeting_id)
    )
    recording = result.scalar_one_or_none()

    if not recording:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await session.delete(recording)
    await session.commit()

    return {"status": "deleted", "message": f"Meeting {meeting_id} deleted"}


@router.get("/{meeting_id}/transcript")
async def get_transcript(
    meeting_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Get full transcript for a meeting."""
    result = await session.execute(
        select(DBRecording).where(DBRecording.id == meeting_id)
    )
    recording = result.scalar_one_or_none()

    if not recording:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return {
        "meeting_id": meeting_id,
        "topic": recording.topic,
        "transcript": recording.transcript,
    }


@router.get("/search")
async def search_meetings(
    q: str,
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
):
    """Search meetings by topic or transcript content."""
    result = await session.execute(
        select(DBRecording, DBClient.name)
        .outerjoin(DBClient, DBRecording.client_id == DBClient.id)
        .where(
            DBRecording.topic.ilike(f"%{q}%")
            | DBRecording.transcript.ilike(f"%{q}%")
            | DBRecording.summary.ilike(f"%{q}%")
        )
        .order_by(DBRecording.start_time.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
        {
            "id": recording.id,
            "topic": recording.topic,
            "start_time": recording.start_time.isoformat(),
            "client_name": client_name,
            "youtube_url": recording.youtube_url,
            "excerpt": _get_excerpt(recording, q),
        }
        for recording, client_name in rows
    ]


def _get_excerpt(recording: DBRecording, query: str, context: int = 100) -> str:
    """Get excerpt around query match."""
    text = recording.transcript or recording.summary or recording.topic
    text_lower = text.lower()
    query_lower = query.lower()

    pos = text_lower.find(query_lower)
    if pos == -1:
        return text[:200] + "..." if len(text) > 200 else text

    start = max(0, pos - context)
    end = min(len(text), pos + len(query) + context)

    excerpt = text[start:end]
    if start > 0:
        excerpt = "..." + excerpt
    if end < len(text):
        excerpt = excerpt + "..."

    return excerpt
