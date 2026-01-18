"""YouTube Data API service for uploading videos."""

import os
import pickle
from pathlib import Path
from typing import Optional, List

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()

# YouTube API scopes
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


class YouTubeService:
    """Service for uploading videos to YouTube."""

    def __init__(self):
        self.credentials: Optional[Credentials] = None
        self.service = None

    def _get_credentials(self) -> Credentials:
        """Get or refresh YouTube API credentials."""
        creds = None
        token_path = Path(settings.youtube_token_file)

        # Load existing token
        if token_path.exists():
            with open(token_path, "rb") as token:
                creds = pickle.load(token)

        # Refresh or create new credentials
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                client_secret_path = Path(settings.youtube_client_secret_file)
                if not client_secret_path.exists():
                    raise FileNotFoundError(
                        f"YouTube client secret file not found: {client_secret_path}"
                    )

                flow = InstalledAppFlow.from_client_secrets_file(
                    str(client_secret_path), SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save credentials
            token_path.parent.mkdir(parents=True, exist_ok=True)
            with open(token_path, "wb") as token:
                pickle.dump(creds, token)

        return creds

    def _get_service(self):
        """Get YouTube API service instance."""
        if not self.service:
            self.credentials = self._get_credentials()
            self.service = build("youtube", "v3", credentials=self.credentials)
        return self.service

    async def upload_video(
        self,
        file_path: Path,
        title: str,
        description: str = "",
        tags: Optional[List[str]] = None,
        category_id: str = "22",  # "People & Blogs"
        privacy_status: str = "unlisted",
    ) -> str:
        """
        Upload a video to YouTube.

        Args:
            file_path: Path to the video file
            title: Video title
            description: Video description
            tags: List of tags
            category_id: YouTube category ID
            privacy_status: "public", "private", or "unlisted"

        Returns:
            YouTube video URL
        """
        import asyncio

        # Run in executor since Google API client is synchronous
        return await asyncio.get_event_loop().run_in_executor(
            None,
            self._upload_video_sync,
            file_path,
            title,
            description,
            tags or [],
            category_id,
            privacy_status,
        )

    def _upload_video_sync(
        self,
        file_path: Path,
        title: str,
        description: str,
        tags: List[str],
        category_id: str,
        privacy_status: str,
    ) -> str:
        """Synchronous video upload."""
        service = self._get_service()

        body = {
            "snippet": {
                "title": title[:100],  # YouTube title limit
                "description": description[:5000],  # YouTube description limit
                "tags": tags[:500],  # Tag limit
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }

        # Create media upload
        media = MediaFileUpload(
            str(file_path),
            mimetype="video/mp4",
            resumable=True,
            chunksize=1024 * 1024 * 10,  # 10MB chunks
        )

        logger.info(f"Starting YouTube upload: {title}")

        # Execute upload
        request = service.videos().insert(
            part=",".join(body.keys()),
            body=body,
            media_body=media,
        )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                logger.debug(f"Upload progress: {progress}%")

        video_id = response["id"]
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        logger.info(f"Successfully uploaded video: {video_url}")
        return video_url

    async def update_video(
        self,
        video_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> dict:
        """Update an existing video's metadata."""
        import asyncio

        return await asyncio.get_event_loop().run_in_executor(
            None,
            self._update_video_sync,
            video_id,
            title,
            description,
            tags,
        )

    def _update_video_sync(
        self,
        video_id: str,
        title: Optional[str],
        description: Optional[str],
        tags: Optional[List[str]],
    ) -> dict:
        """Synchronous video update."""
        service = self._get_service()

        # Get current video data
        video_response = (
            service.videos().list(part="snippet", id=video_id).execute()
        )

        if not video_response.get("items"):
            raise ValueError(f"Video not found: {video_id}")

        snippet = video_response["items"][0]["snippet"]

        # Update fields
        if title:
            snippet["title"] = title[:100]
        if description:
            snippet["description"] = description[:5000]
        if tags:
            snippet["tags"] = tags[:500]

        # Execute update
        request = service.videos().update(
            part="snippet",
            body={"id": video_id, "snippet": snippet},
        )
        response = request.execute()

        logger.info(f"Updated video: {video_id}")
        return response

    def generate_chapters(self, timestamps: List[dict]) -> str:
        """
        Generate YouTube chapters description from timestamps.

        Args:
            timestamps: List of {"time": "00:00", "title": "Chapter Title"}

        Returns:
            Formatted chapters string for description
        """
        chapters = []
        for ts in timestamps:
            chapters.append(f"{ts['time']} {ts['title']}")
        return "\n".join(chapters)
