"""Client identification and management service."""

import re
from typing import Optional, List, Dict

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import DBClient, DBRecording
from src.models.client import Client, ClientCreate, ClientStatus
from src.services.summary_service import SummaryService
from src.utils.logger import get_logger

logger = get_logger(__name__)


class ClientService:
    """Service for identifying and managing clients."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.summary_service = SummaryService()

    async def identify_client(
        self,
        meeting_title: str,
        zoom_meeting_id: str,
        transcript_start: Optional[str] = None,
        participant_emails: Optional[List[str]] = None,
    ) -> Optional[DBClient]:
        """
        Identify the client for a meeting using multiple strategies.

        Strategy priority:
        1. Match by Zoom meeting ID (recurring meetings)
        2. Match by title pattern (【クライアント名】)
        3. Match by AI inference from transcript

        Returns:
            DBClient if identified, None otherwise
        """
        # Strategy 1: Match by Zoom meeting ID
        client = await self._match_by_meeting_id(zoom_meeting_id)
        if client:
            logger.info(f"Client identified by meeting ID: {client.name}")
            return client

        # Strategy 2: Match by title pattern
        client_name = self._extract_client_from_title(meeting_title)
        if client_name:
            client = await self._get_or_create_client(client_name, zoom_meeting_id)
            logger.info(f"Client identified by title: {client.name}")
            return client

        # Strategy 3: Match by title pattern matching
        client = await self._match_by_title_pattern(meeting_title)
        if client:
            # Add this meeting ID to client's known IDs
            await self._add_meeting_id_to_client(client, zoom_meeting_id)
            logger.info(f"Client identified by pattern: {client.name}")
            return client

        # Strategy 4: AI inference (if transcript available)
        if transcript_start:
            email_domains = self._extract_domains(participant_emails or [])
            inferred_name = await self.summary_service.identify_client(
                title=meeting_title,
                transcript_start=transcript_start,
                email_domains=email_domains,
            )

            if inferred_name and inferred_name != "不明":
                client = await self._get_or_create_client(inferred_name, zoom_meeting_id)
                logger.info(f"Client identified by AI: {client.name}")
                return client

        logger.info(f"Could not identify client for meeting: {meeting_title}")
        return None

    async def _match_by_meeting_id(self, zoom_meeting_id: str) -> Optional[DBClient]:
        """Find client by Zoom meeting ID."""
        result = await self.session.execute(
            select(DBClient)
        )
        clients = result.scalars().all()

        for client in clients:
            meeting_ids = client.get_zoom_meeting_ids()
            if zoom_meeting_id in meeting_ids:
                return client

        return None

    def _extract_client_from_title(self, title: str) -> Optional[str]:
        """Extract client name from 【】 in title."""
        # Match patterns like 【ABC社】 or 【XYZ株式会社】
        match = re.search(r"【(.+?)】", title)
        if match:
            return match.group(1).strip()

        # Also try brackets []
        match = re.search(r"\[(.+?)\]", title)
        if match:
            return match.group(1).strip()

        return None

    async def _match_by_title_pattern(self, title: str) -> Optional[DBClient]:
        """Match client by stored title patterns."""
        result = await self.session.execute(
            select(DBClient)
        )
        clients = result.scalars().all()

        title_lower = title.lower()
        for client in clients:
            patterns = client.get_title_patterns()
            for pattern in patterns:
                if pattern.lower() in title_lower:
                    return client

            # Also check if client name appears in title
            if client.name.lower() in title_lower:
                return client

        return None

    async def _get_or_create_client(
        self,
        name: str,
        zoom_meeting_id: str,
    ) -> DBClient:
        """Get existing client or create new one."""
        # Try to find existing client
        result = await self.session.execute(
            select(DBClient).where(DBClient.name == name)
        )
        client = result.scalar_one_or_none()

        if client:
            # Add meeting ID if not already present
            await self._add_meeting_id_to_client(client, zoom_meeting_id)
            return client

        # Create new client
        client = DBClient(
            name=name,
            zoom_meeting_ids=f'["{zoom_meeting_id}"]',
            title_patterns=f'["{name}"]',
        )
        self.session.add(client)
        await self.session.commit()
        await self.session.refresh(client)

        logger.info(f"Created new client: {name}")
        return client

    async def _add_meeting_id_to_client(
        self,
        client: DBClient,
        zoom_meeting_id: str,
    ):
        """Add a meeting ID to client's known IDs."""
        meeting_ids = client.get_zoom_meeting_ids()
        if zoom_meeting_id not in meeting_ids:
            meeting_ids.append(zoom_meeting_id)
            client.set_zoom_meeting_ids(meeting_ids)
            await self.session.commit()

    def _extract_domains(self, emails: List[str]) -> List[str]:
        """Extract unique domains from email addresses."""
        domains = set()
        for email in emails:
            if "@" in email:
                domain = email.split("@")[1]
                # Exclude common domains
                if domain not in ["gmail.com", "yahoo.co.jp", "outlook.com"]:
                    domains.add(domain)
        return list(domains)

    async def update_client_summary(
        self,
        client_id: int,
    ) -> str:
        """
        Update the cumulative summary for a client.

        Fetches all meetings for the client and generates a new summary.
        """
        # Get client
        result = await self.session.execute(
            select(DBClient).where(DBClient.id == client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Client not found: {client_id}")

        # Get all completed meetings for this client
        result = await self.session.execute(
            select(DBRecording)
            .where(DBRecording.client_id == client_id)
            .where(DBRecording.summary.isnot(None))
            .order_by(DBRecording.start_time)
        )
        meetings = result.scalars().all()

        if not meetings:
            return ""

        # Prepare meeting summaries
        meeting_summaries = [
            {
                "date": m.start_time.strftime("%Y-%m-%d"),
                "summary": m.summary,
            }
            for m in meetings
        ]

        # Generate cumulative summary
        cumulative = await self.summary_service.generate_cumulative_summary(
            meeting_summaries
        )

        # Update client
        client.cumulative_summary = cumulative
        client.meeting_count = len(meetings)
        if meetings:
            client.last_meeting_at = meetings[-1].start_time

        await self.session.commit()

        logger.info(f"Updated cumulative summary for client: {client.name}")
        return cumulative

    async def get_client_history(
        self,
        client_id: int,
    ) -> Dict:
        """Get full meeting history for a client."""
        result = await self.session.execute(
            select(DBClient).where(DBClient.id == client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Client not found: {client_id}")

        result = await self.session.execute(
            select(DBRecording)
            .where(DBRecording.client_id == client_id)
            .order_by(DBRecording.start_time.desc())
        )
        meetings = result.scalars().all()

        return {
            "client": client,
            "meetings": meetings,
            "cumulative_summary": client.cumulative_summary,
        }

    async def get_all_clients(self) -> List[DBClient]:
        """Get all clients."""
        result = await self.session.execute(
            select(DBClient).order_by(DBClient.name)
        )
        return result.scalars().all()

    async def create_client(self, data: ClientCreate) -> DBClient:
        """Create a new client."""
        client = DBClient(
            name=data.name,
            description=data.description,
            status=data.status,
        )

        if data.tags:
            client.set_tags(data.tags)
        if data.zoom_meeting_ids:
            client.set_zoom_meeting_ids(data.zoom_meeting_ids)
        if data.title_patterns:
            client.set_title_patterns(data.title_patterns)

        self.session.add(client)
        await self.session.commit()
        await self.session.refresh(client)

        return client
