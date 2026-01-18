"""Zoom API service for downloading recordings."""

import base64
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()


class ZoomService:
    """Service for interacting with Zoom API."""

    BASE_URL = "https://api.zoom.us/v2"
    OAUTH_URL = "https://zoom.us/oauth/token"

    def __init__(self):
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self.download_dir = Path(settings.download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)

    async def _get_access_token(self) -> str:
        """Get OAuth access token using Server-to-Server OAuth."""
        # Check if current token is still valid
        if (
            self._access_token
            and self._token_expires_at
            and datetime.utcnow() < self._token_expires_at
        ):
            return self._access_token

        # Request new token
        credentials = base64.b64encode(
            f"{settings.zoom_client_id}:{settings.zoom_client_secret}".encode()
        ).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.OAUTH_URL,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "account_credentials",
                    "account_id": settings.zoom_account_id,
                },
            )
            response.raise_for_status()
            data = response.json()

        self._access_token = data["access_token"]
        # Token expires in `expires_in` seconds, subtract 60s for safety
        expires_in = data.get("expires_in", 3600) - 60
        self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        logger.info("Successfully obtained Zoom access token")
        return self._access_token

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def download_recording(
        self,
        download_url: str,
        meeting_id: str,
        file_type: str = "MP4",
    ) -> Path:
        """
        Download a recording file from Zoom.

        Args:
            download_url: The download URL from Zoom webhook
            meeting_id: Meeting ID for naming the file
            file_type: File type (MP4, M4A, etc.)

        Returns:
            Path to the downloaded file
        """
        token = await self._get_access_token()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        extension = file_type.lower()
        filename = f"{meeting_id}_{timestamp}.{extension}"
        file_path = self.download_dir / filename

        logger.info(f"Downloading recording: {filename}")

        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
            # Add access token to download URL
            download_url_with_token = f"{download_url}?access_token={token}"

            async with client.stream("GET", download_url_with_token) as response:
                response.raise_for_status()

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(file_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
                        downloaded += len(chunk)

                        # Log progress every 10%
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            if downloaded % (total_size // 10 + 1) < 8192:
                                logger.debug(f"Download progress: {progress:.1f}%")

        logger.info(f"Successfully downloaded recording: {file_path}")
        return file_path

    async def get_meeting_details(self, meeting_id: str) -> dict:
        """Get details of a specific meeting."""
        token = await self._get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/meetings/{meeting_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.json()

    async def get_recording_settings(self, meeting_id: str) -> dict:
        """Get recording settings for a meeting."""
        token = await self._get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/meetings/{meeting_id}/recordings/settings",
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.json()

    def cleanup_file(self, file_path: Path) -> bool:
        """
        Delete a downloaded file.

        Args:
            file_path: Path to the file to delete

        Returns:
            True if deletion was successful
        """
        try:
            if file_path.exists():
                os.remove(file_path)
                logger.info(f"Cleaned up file: {file_path}")
                return True
        except Exception as e:
            logger.error(f"Failed to cleanup file {file_path}: {e}")
        return False
