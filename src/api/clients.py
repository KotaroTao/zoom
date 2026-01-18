"""Client management API endpoints."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db, DBClient, DBRecording
from src.models.client import ClientCreate, ClientStatus
from src.services.client_service import ClientService

router = APIRouter(prefix="/api/clients", tags=["clients"])


class ClientResponse(BaseModel):
    """Client response model."""

    id: int
    name: str
    description: Optional[str]
    status: str
    meeting_count: int
    last_meeting_at: Optional[datetime]
    cumulative_summary: Optional[str]
    created_at: datetime


class ClientDetailResponse(ClientResponse):
    """Detailed client response with meetings."""

    meetings: List[dict]
    notion_page_id: Optional[str]


class ClientCreateRequest(BaseModel):
    """Request model for creating a client."""

    name: str
    description: Optional[str] = None
    title_patterns: Optional[List[str]] = None
    zoom_meeting_ids: Optional[List[str]] = None


class ClientUpdateRequest(BaseModel):
    """Request model for updating a client."""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    title_patterns: Optional[List[str]] = None


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    """List all clients."""
    query = select(DBClient).order_by(DBClient.name)

    if status:
        query = query.where(DBClient.status == ClientStatus(status))

    result = await session.execute(query)
    clients = result.scalars().all()

    return [
        ClientResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            status=c.status.value,
            meeting_count=c.meeting_count,
            last_meeting_at=c.last_meeting_at,
            cumulative_summary=c.cumulative_summary,
            created_at=c.created_at,
        )
        for c in clients
    ]


@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client(
    client_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Get a specific client with meeting history."""
    result = await session.execute(
        select(DBClient).where(DBClient.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get meetings
    result = await session.execute(
        select(DBRecording)
        .where(DBRecording.client_id == client_id)
        .order_by(DBRecording.start_time.desc())
    )
    meetings = result.scalars().all()

    return ClientDetailResponse(
        id=client.id,
        name=client.name,
        description=client.description,
        status=client.status.value,
        meeting_count=client.meeting_count,
        last_meeting_at=client.last_meeting_at,
        cumulative_summary=client.cumulative_summary,
        created_at=client.created_at,
        notion_page_id=client.notion_page_id,
        meetings=[
            {
                "id": m.id,
                "topic": m.topic,
                "start_time": m.start_time.isoformat(),
                "youtube_url": m.youtube_url,
                "summary": m.summary,
                "decisions": m.decisions,
                "action_items": m.action_items,
            }
            for m in meetings
        ],
    )


@router.post("", response_model=ClientResponse)
async def create_client(
    request: ClientCreateRequest,
    session: AsyncSession = Depends(get_db),
):
    """Create a new client."""
    # Check if client already exists
    result = await session.execute(
        select(DBClient).where(DBClient.name == request.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Client already exists")

    client = DBClient(
        name=request.name,
        description=request.description,
    )

    if request.title_patterns:
        client.set_title_patterns(request.title_patterns)
    if request.zoom_meeting_ids:
        client.set_zoom_meeting_ids(request.zoom_meeting_ids)

    session.add(client)
    await session.commit()
    await session.refresh(client)

    return ClientResponse(
        id=client.id,
        name=client.name,
        description=client.description,
        status=client.status.value,
        meeting_count=client.meeting_count,
        last_meeting_at=client.last_meeting_at,
        cumulative_summary=client.cumulative_summary,
        created_at=client.created_at,
    )


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    request: ClientUpdateRequest,
    session: AsyncSession = Depends(get_db),
):
    """Update a client."""
    result = await session.execute(
        select(DBClient).where(DBClient.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if request.name:
        client.name = request.name
    if request.description is not None:
        client.description = request.description
    if request.status:
        client.status = ClientStatus(request.status)
    if request.title_patterns:
        client.set_title_patterns(request.title_patterns)

    client.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(client)

    return ClientResponse(
        id=client.id,
        name=client.name,
        description=client.description,
        status=client.status.value,
        meeting_count=client.meeting_count,
        last_meeting_at=client.last_meeting_at,
        cumulative_summary=client.cumulative_summary,
        created_at=client.created_at,
    )


@router.post("/{client_id}/refresh-summary")
async def refresh_client_summary(
    client_id: int,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """Refresh cumulative summary for a client."""
    result = await session.execute(
        select(DBClient).where(DBClient.id == client_id)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    async def refresh_summary():
        async for sess in get_db():
            client_service = ClientService(sess)
            await client_service.update_client_summary(client_id)

    background_tasks.add_task(refresh_summary)

    return {"status": "processing", "message": "Summary refresh started"}


@router.post("/{client_id}/assign-meeting/{meeting_id}")
async def assign_meeting_to_client(
    client_id: int,
    meeting_id: int,
    session: AsyncSession = Depends(get_db),
):
    """Manually assign a meeting to a client."""
    # Verify client exists
    result = await session.execute(
        select(DBClient).where(DBClient.id == client_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Verify meeting exists
    result = await session.execute(
        select(DBRecording).where(DBRecording.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Assign meeting
    meeting.client_id = client_id
    meeting.updated_at = datetime.utcnow()

    # Update client meeting count
    result = await session.execute(
        select(DBRecording).where(DBRecording.client_id == client_id)
    )
    meetings = result.scalars().all()
    client.meeting_count = len(meetings) + 1
    client.last_meeting_at = meeting.start_time

    # Add meeting ID to client's known IDs
    meeting_ids = client.get_zoom_meeting_ids()
    if meeting.zoom_meeting_id not in meeting_ids:
        meeting_ids.append(meeting.zoom_meeting_id)
        client.set_zoom_meeting_ids(meeting_ids)

    await session.commit()

    return {"status": "success", "message": f"Meeting assigned to {client.name}"}
