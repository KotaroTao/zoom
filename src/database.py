"""Database configuration and models using SQLAlchemy."""

import json
from datetime import datetime
from typing import AsyncGenerator, Optional, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
    create_engine,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship

from src.models.recording import ProcessingStatus
from src.models.client import ClientStatus

Base = declarative_base()


class DBClient(Base):
    """SQLAlchemy model for clients."""

    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    status = Column(
        SQLEnum(ClientStatus), default=ClientStatus.ACTIVE, nullable=False
    )
    tags = Column(Text, nullable=True)  # JSON string
    cumulative_summary = Column(Text, nullable=True)
    zoom_meeting_ids = Column(Text, nullable=True)  # JSON array
    title_patterns = Column(Text, nullable=True)  # JSON array
    calendar_event_patterns = Column(Text, nullable=True)  # JSON array
    meeting_count = Column(Integer, default=0)
    last_meeting_at = Column(DateTime, nullable=True)
    notion_page_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    recordings = relationship("DBRecording", back_populates="client")

    def get_zoom_meeting_ids(self) -> List[str]:
        if self.zoom_meeting_ids:
            return json.loads(self.zoom_meeting_ids)
        return []

    def set_zoom_meeting_ids(self, ids: List[str]):
        self.zoom_meeting_ids = json.dumps(ids)

    def get_title_patterns(self) -> List[str]:
        if self.title_patterns:
            return json.loads(self.title_patterns)
        return []

    def set_title_patterns(self, patterns: List[str]):
        self.title_patterns = json.dumps(patterns)

    def get_tags(self) -> List[str]:
        if self.tags:
            return json.loads(self.tags)
        return []

    def set_tags(self, tags: List[str]):
        self.tags = json.dumps(tags)


class DBRecording(Base):
    """SQLAlchemy model for recordings."""

    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zoom_meeting_id = Column(String(255), nullable=False)
    zoom_meeting_uuid = Column(String(255), nullable=False, unique=True)
    topic = Column(String(500), nullable=False)
    start_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=0)
    host_email = Column(String(255), nullable=True)
    recording_url = Column(Text, nullable=True)
    recording_type = Column(String(50), default="MP4")

    # Processing status
    status = Column(
        SQLEnum(ProcessingStatus), default=ProcessingStatus.PENDING, nullable=False
    )
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)

    # Output fields
    youtube_url = Column(String(500), nullable=True)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)

    # External references
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    calendar_event_id = Column(String(255), nullable=True)
    notion_page_id = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationship
    client = relationship("DBClient", back_populates="recordings")


class Database:
    """Database connection manager."""

    def __init__(self, database_url: str = "sqlite+aiosqlite:///data/app.db"):
        self.database_url = database_url
        self.engine = create_async_engine(
            database_url,
            echo=False,
            future=True,
        )
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def init_db(self):
        """Initialize the database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get an async database session."""
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# Global database instance
db = Database()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async for session in db.get_session():
        yield session
