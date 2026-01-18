"""Dashboard API endpoints."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, DBRecording, DBClient
from src.models.recording import ProcessingStatus

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    """Dashboard statistics."""

    total_meetings: int
    meetings_this_month: int
    total_clients: int
    active_clients: int
    pending_processing: int
    failed_processing: int


class ProcessingItem(BaseModel):
    """Currently processing item."""

    id: int
    topic: str
    status: str
    progress_percent: int
    started_at: Optional[datetime]


class RecentMeeting(BaseModel):
    """Recent meeting summary."""

    id: int
    topic: str
    start_time: datetime
    client_name: Optional[str]
    youtube_url: Optional[str]
    status: str


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(session: AsyncSession = Depends(get_db)):
    """Get dashboard statistics."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total meetings
    total_meetings = await session.scalar(
        select(func.count(DBRecording.id))
    )

    # Meetings this month
    meetings_this_month = await session.scalar(
        select(func.count(DBRecording.id)).where(
            DBRecording.start_time >= month_start
        )
    )

    # Total clients
    total_clients = await session.scalar(
        select(func.count(DBClient.id))
    )

    # Active clients (with meeting in last 30 days)
    active_clients = await session.scalar(
        select(func.count(DBClient.id)).where(
            DBClient.last_meeting_at >= now - timedelta(days=30)
        )
    )

    # Pending processing
    pending_processing = await session.scalar(
        select(func.count(DBRecording.id)).where(
            DBRecording.status.in_([
                ProcessingStatus.PENDING,
                ProcessingStatus.DOWNLOADING,
                ProcessingStatus.UPLOADING_YOUTUBE,
                ProcessingStatus.TRANSCRIBING,
                ProcessingStatus.SUMMARIZING,
                ProcessingStatus.SAVING,
            ])
        )
    )

    # Failed processing
    failed_processing = await session.scalar(
        select(func.count(DBRecording.id)).where(
            DBRecording.status == ProcessingStatus.FAILED
        )
    )

    return DashboardStats(
        total_meetings=total_meetings or 0,
        meetings_this_month=meetings_this_month or 0,
        total_clients=total_clients or 0,
        active_clients=active_clients or 0,
        pending_processing=pending_processing or 0,
        failed_processing=failed_processing or 0,
    )


@router.get("/processing", response_model=List[ProcessingItem])
async def get_processing_items(session: AsyncSession = Depends(get_db)):
    """Get currently processing items."""
    result = await session.execute(
        select(DBRecording).where(
            DBRecording.status.in_([
                ProcessingStatus.PENDING,
                ProcessingStatus.DOWNLOADING,
                ProcessingStatus.UPLOADING_YOUTUBE,
                ProcessingStatus.TRANSCRIBING,
                ProcessingStatus.SUMMARIZING,
                ProcessingStatus.SAVING,
            ])
        ).order_by(DBRecording.created_at.desc())
    )
    recordings = result.scalars().all()

    # Map status to progress percentage
    status_progress = {
        ProcessingStatus.PENDING: 0,
        ProcessingStatus.DOWNLOADING: 15,
        ProcessingStatus.UPLOADING_YOUTUBE: 35,
        ProcessingStatus.TRANSCRIBING: 55,
        ProcessingStatus.SUMMARIZING: 75,
        ProcessingStatus.SAVING: 90,
    }

    return [
        ProcessingItem(
            id=r.id,
            topic=r.topic,
            status=r.status.value,
            progress_percent=status_progress.get(r.status, 0),
            started_at=r.created_at,
        )
        for r in recordings
    ]


@router.get("/recent", response_model=List[RecentMeeting])
async def get_recent_meetings(
    limit: int = 10,
    session: AsyncSession = Depends(get_db),
):
    """Get recent meetings."""
    result = await session.execute(
        select(DBRecording, DBClient.name)
        .outerjoin(DBClient, DBRecording.client_id == DBClient.id)
        .order_by(DBRecording.start_time.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
        RecentMeeting(
            id=recording.id,
            topic=recording.topic,
            start_time=recording.start_time,
            client_name=client_name,
            youtube_url=recording.youtube_url,
            status=recording.status.value,
        )
        for recording, client_name in rows
    ]


@router.get("/action-items")
async def get_pending_action_items(
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
):
    """Get pending action items from recent meetings."""
    result = await session.execute(
        select(DBRecording, DBClient.name)
        .outerjoin(DBClient, DBRecording.client_id == DBClient.id)
        .where(DBRecording.action_items.isnot(None))
        .order_by(DBRecording.start_time.desc())
        .limit(limit)
    )
    rows = result.all()

    action_items = []
    for recording, client_name in rows:
        if recording.action_items:
            items = recording.action_items.split("\n")
            for item in items:
                item = item.strip()
                if item and not item.startswith("アクションアイテムなし"):
                    action_items.append({
                        "text": item,
                        "meeting_id": recording.id,
                        "meeting_topic": recording.topic,
                        "client_name": client_name,
                        "meeting_date": recording.start_time.isoformat(),
                    })

    return action_items[:limit]
