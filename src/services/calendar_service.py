"""Google Calendar API service for meeting integration."""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()

# Google Calendar API scopes
SCOPES = ["https://www.googleapis.com/auth/calendar"]


class CalendarService:
    """Service for interacting with Google Calendar."""

    def __init__(self):
        self.service = None
        self.calendar_id = settings.google_calendar_id

    def _get_service(self):
        """Get authenticated Calendar API service."""
        if not self.service:
            creds = Credentials.from_service_account_file(
                settings.google_application_credentials,
                scopes=SCOPES,
            )
            self.service = build("calendar", "v3", credentials=creds)

        return self.service

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def find_event_by_zoom_meeting(
        self,
        zoom_meeting_id: str,
        meeting_start_time: datetime,
        topic: str,
    ) -> Optional[Dict]:
        """
        Find a calendar event matching a Zoom meeting.

        Strategy:
        1. Search by Zoom meeting URL in event description
        2. Search by time window and title similarity

        Returns:
            Calendar event dict if found, None otherwise
        """

        def _find():
            service = self._get_service()

            # Time window: meeting start ± 15 minutes
            time_min = (meeting_start_time - timedelta(minutes=15)).isoformat() + "Z"
            time_max = (meeting_start_time + timedelta(minutes=15)).isoformat() + "Z"

            # Search for events in time window
            events_result = (
                service.events()
                .list(
                    calendarId=self.calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )

            events = events_result.get("items", [])

            for event in events:
                # Check if Zoom meeting ID is in description
                description = event.get("description", "")
                if zoom_meeting_id in description:
                    return event

                # Check title similarity
                event_summary = event.get("summary", "").lower()
                topic_lower = topic.lower()

                # Simple matching: check if significant words overlap
                if any(
                    word in event_summary
                    for word in topic_lower.split()
                    if len(word) > 2
                ):
                    return event

            return None

        return await asyncio.get_event_loop().run_in_executor(None, _find)

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def update_event_with_recording(
        self,
        event_id: str,
        youtube_url: Optional[str] = None,
        summary_text: Optional[str] = None,
        zoom_recording_url: Optional[str] = None,
    ) -> Dict:
        """
        Update a calendar event with recording information.

        Adds YouTube URL, summary, and recording link to the event description.
        """

        def _update():
            service = self._get_service()

            # Get current event
            event = (
                service.events()
                .get(calendarId=self.calendar_id, eventId=event_id)
                .execute()
            )

            # Build updated description
            current_desc = event.get("description", "")

            additions = []
            additions.append("\n\n" + "=" * 40)
            additions.append("📹 ミーティング録画情報")
            additions.append("=" * 40)

            if youtube_url:
                additions.append(f"\n🎬 YouTube: {youtube_url}")

            if zoom_recording_url:
                additions.append(f"\n📁 Zoom録画: {zoom_recording_url}")

            if summary_text:
                additions.append(f"\n\n📝 要約:\n{summary_text[:1000]}")

            new_desc = current_desc + "\n".join(additions)

            # Update event
            event["description"] = new_desc
            updated_event = (
                service.events()
                .update(
                    calendarId=self.calendar_id,
                    eventId=event_id,
                    body=event,
                )
                .execute()
            )

            return updated_event

        result = await asyncio.get_event_loop().run_in_executor(None, _update)
        logger.info(f"Updated calendar event: {event_id}")
        return result

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def get_upcoming_events_for_client(
        self,
        client_patterns: List[str],
        days_ahead: int = 7,
    ) -> List[Dict]:
        """
        Get upcoming calendar events matching client patterns.

        Used to send pre-meeting reminders with past meeting context.
        """

        def _get():
            service = self._get_service()

            now = datetime.utcnow()
            time_min = now.isoformat() + "Z"
            time_max = (now + timedelta(days=days_ahead)).isoformat() + "Z"

            events_result = (
                service.events()
                .list(
                    calendarId=self.calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )

            events = events_result.get("items", [])
            matching_events = []

            for event in events:
                summary = event.get("summary", "").lower()
                description = event.get("description", "").lower()

                for pattern in client_patterns:
                    pattern_lower = pattern.lower()
                    if pattern_lower in summary or pattern_lower in description:
                        matching_events.append(event)
                        break

            return matching_events

        return await asyncio.get_event_loop().run_in_executor(None, _get)

    async def extract_client_info_from_event(
        self,
        event: Dict,
    ) -> Dict:
        """
        Extract client-related information from a calendar event.

        Returns:
            Dict with 'client_name', 'attendee_emails', 'attendee_domains'
        """
        attendees = event.get("attendees", [])

        # Extract email domains (excluding common providers)
        common_domains = {"gmail.com", "yahoo.co.jp", "outlook.com", "hotmail.com"}
        attendee_emails = [a.get("email", "") for a in attendees]
        attendee_domains = []

        for email in attendee_emails:
            if "@" in email:
                domain = email.split("@")[1]
                if domain not in common_domains:
                    attendee_domains.append(domain)

        # Try to extract client name from event title
        summary = event.get("summary", "")
        import re

        client_match = re.search(r"【(.+?)】", summary)
        client_name = client_match.group(1) if client_match else None

        return {
            "client_name": client_name,
            "attendee_emails": attendee_emails,
            "attendee_domains": list(set(attendee_domains)),
            "event_summary": summary,
        }

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def create_reminder_event(
        self,
        title: str,
        start_time: datetime,
        description: str,
        duration_minutes: int = 15,
    ) -> str:
        """
        Create a reminder event before a meeting.

        Returns:
            Event ID
        """

        def _create():
            service = self._get_service()

            event = {
                "summary": f"📋 準備: {title}",
                "description": description,
                "start": {
                    "dateTime": start_time.isoformat(),
                    "timeZone": "Asia/Tokyo",
                },
                "end": {
                    "dateTime": (
                        start_time + timedelta(minutes=duration_minutes)
                    ).isoformat(),
                    "timeZone": "Asia/Tokyo",
                },
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "popup", "minutes": 10},
                    ],
                },
            }

            created_event = (
                service.events()
                .insert(calendarId=self.calendar_id, body=event)
                .execute()
            )

            return created_event["id"]

        event_id = await asyncio.get_event_loop().run_in_executor(None, _create)
        logger.info(f"Created reminder event: {event_id}")
        return event_id

    async def get_past_meeting_summary_for_reminder(
        self,
        client_name: str,
        client_service: "ClientService",
    ) -> Optional[str]:
        """
        Generate a reminder text with past meeting context.

        Used before upcoming meetings with the same client.
        """
        try:
            history = await client_service.get_client_history_by_name(client_name)

            if not history or not history.get("cumulative_summary"):
                return None

            summary = history["cumulative_summary"]
            last_meeting = history.get("last_meeting")

            reminder = []
            reminder.append(f"📊 {client_name} 過去ミーティングサマリー")
            reminder.append("=" * 40)

            if last_meeting:
                reminder.append(
                    f"最終ミーティング: {last_meeting.start_time.strftime('%Y-%m-%d')}"
                )

            reminder.append("\n" + summary)

            return "\n".join(reminder)

        except Exception as e:
            logger.error(f"Error generating reminder summary: {e}")
            return None
