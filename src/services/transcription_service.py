"""Transcription service using OpenAI Whisper."""

import asyncio
from pathlib import Path
from typing import Optional

from openai import OpenAI

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()


class TranscriptionService:
    """Service for transcribing audio using OpenAI Whisper."""

    # Maximum file size for Whisper API (25MB)
    MAX_FILE_SIZE = 25 * 1024 * 1024

    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_whisper_model

    @async_retry(max_attempts=3, initial_delay=5.0)
    async def transcribe(
        self,
        file_path: Path,
        language: str = "ja",
        prompt: Optional[str] = None,
    ) -> str:
        """
        Transcribe an audio/video file to text.

        Args:
            file_path: Path to the audio/video file
            language: Language code (default: Japanese)
            prompt: Optional prompt to guide transcription

        Returns:
            Transcribed text
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size

        # Check if file needs to be split
        if file_size > self.MAX_FILE_SIZE:
            logger.info(f"File size ({file_size} bytes) exceeds limit, extracting audio")
            audio_path = await self._extract_audio(file_path)
            file_to_transcribe = audio_path
        else:
            file_to_transcribe = file_path

        logger.info(f"Starting transcription: {file_path.name}")

        # Run transcription in executor (synchronous API)
        transcript = await asyncio.get_event_loop().run_in_executor(
            None,
            self._transcribe_sync,
            file_to_transcribe,
            language,
            prompt,
        )

        # Cleanup extracted audio if created
        if file_size > self.MAX_FILE_SIZE and audio_path.exists():
            audio_path.unlink()

        logger.info(f"Transcription completed: {len(transcript)} characters")
        return transcript

    def _transcribe_sync(
        self,
        file_path: Path,
        language: str,
        prompt: Optional[str],
    ) -> str:
        """Synchronous transcription using Whisper API."""
        with open(file_path, "rb") as audio_file:
            params = {
                "model": self.model,
                "file": audio_file,
                "language": language,
                "response_format": "text",
            }
            if prompt:
                params["prompt"] = prompt

            response = self.client.audio.transcriptions.create(**params)

        return response

    async def _extract_audio(self, video_path: Path) -> Path:
        """
        Extract audio from video file using pydub.

        Args:
            video_path: Path to video file

        Returns:
            Path to extracted audio file
        """
        from pydub import AudioSegment

        output_path = video_path.with_suffix(".mp3")

        def extract():
            audio = AudioSegment.from_file(str(video_path))
            # Export as MP3 with reduced bitrate for smaller file size
            audio.export(
                str(output_path),
                format="mp3",
                bitrate="64k",
            )

        await asyncio.get_event_loop().run_in_executor(None, extract)
        logger.info(f"Extracted audio: {output_path}")

        return output_path

    async def transcribe_with_timestamps(
        self,
        file_path: Path,
        language: str = "ja",
    ) -> dict:
        """
        Transcribe with word-level timestamps.

        Returns:
            Dict with 'text' and 'segments' containing timestamps
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        logger.info(f"Starting transcription with timestamps: {file_path.name}")

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._transcribe_with_timestamps_sync,
            file_path,
            language,
        )

        return result

    def _transcribe_with_timestamps_sync(
        self,
        file_path: Path,
        language: str,
    ) -> dict:
        """Synchronous transcription with timestamps."""
        with open(file_path, "rb") as audio_file:
            response = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        return {
            "text": response.text,
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                }
                for seg in response.segments
            ],
        }
