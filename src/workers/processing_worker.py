"""Background worker for processing Zoom recordings."""

import asyncio
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import select

from src.config import get_settings
from src.database import db, DBRecording, DBClient
from src.models.recording import ProcessingStatus
from src.services.zoom_service import ZoomService
from src.services.youtube_service import YouTubeService
from src.services.transcription_service import TranscriptionService
from src.services.summary_service import SummaryService
from src.services.client_service import ClientService
from src.services.notion_service import NotionService
from src.services.sheets_service import SheetsService
from src.services.calendar_service import CalendarService
from src.services.notification_service import NotificationService
from src.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


async def process_recording(recording_id: int):
    """
    Process a single recording through the full pipeline.

    Steps:
    1. Download recording from Zoom
    2. Upload to YouTube
    3. Transcribe with Whisper
    4. Generate summary, decisions, action items
    5. Identify client
    6. Save to Notion and Sheets
    7. Update calendar event
    8. Update client cumulative summary
    9. Send notifications
    10. Cleanup
    """
    logger.info(f"Starting processing for recording: {recording_id}")

    # Initialize services
    zoom_service = ZoomService()
    youtube_service = YouTubeService()
    transcription_service = TranscriptionService()
    summary_service = SummaryService()
    notion_service = NotionService()
    sheets_service = SheetsService()
    calendar_service = CalendarService()
    notification_service = NotificationService()

    downloaded_file: Optional[Path] = None

    async for session in db.get_session():
        try:
            # Get recording
            result = await session.execute(
                select(DBRecording).where(DBRecording.id == recording_id)
            )
            recording = result.scalar_one_or_none()

            if not recording:
                logger.error(f"Recording not found: {recording_id}")
                return

            # Initialize client service with session
            client_service = ClientService(session)

            # ====================================
            # Step 1: Download from Zoom
            # ====================================
            await update_status(session, recording, ProcessingStatus.DOWNLOADING)

            downloaded_file = await zoom_service.download_recording(
                download_url=recording.recording_url,
                meeting_id=recording.zoom_meeting_id,
                file_type=recording.recording_type,
            )

            logger.info(f"Downloaded: {downloaded_file}")

            # ====================================
            # Step 2: Upload to YouTube
            # ====================================
            await update_status(session, recording, ProcessingStatus.UPLOADING_YOUTUBE)

            youtube_url = await youtube_service.upload_video(
                file_path=downloaded_file,
                title=recording.topic,
                description=f"Zoom録画: {recording.topic}\n開催日時: {recording.start_time.strftime('%Y-%m-%d %H:%M')}",
                tags=["Zoom", "ミーティング", "録画"],
                privacy_status="unlisted",
            )

            recording.youtube_url = youtube_url
            await session.commit()

            logger.info(f"Uploaded to YouTube: {youtube_url}")

            # ====================================
            # Step 3: Transcribe
            # ====================================
            await update_status(session, recording, ProcessingStatus.TRANSCRIBING)

            transcript = await transcription_service.transcribe(
                file_path=downloaded_file,
                language="ja",
            )

            recording.transcript = transcript
            await session.commit()

            logger.info(f"Transcription completed: {len(transcript)} chars")

            # ====================================
            # Step 4: Generate Summary
            # ====================================
            await update_status(session, recording, ProcessingStatus.SUMMARIZING)

            # Run summary, decisions, actions in parallel
            summary_task = summary_service.generate_summary(transcript)
            decisions_task = summary_service.extract_decisions(transcript)
            actions_task = summary_service.extract_action_items(transcript)

            summary, decisions, action_items = await asyncio.gather(
                summary_task, decisions_task, actions_task
            )

            recording.summary = summary
            recording.decisions = decisions
            recording.action_items = action_items
            await session.commit()

            logger.info("Summary generation completed")

            # ====================================
            # Step 5: Identify Client
            # ====================================
            client = await client_service.identify_client(
                meeting_title=recording.topic,
                zoom_meeting_id=recording.zoom_meeting_id,
                transcript_start=transcript[:2000] if transcript else None,
            )

            if client:
                recording.client_id = client.id
                await session.commit()
                logger.info(f"Client identified: {client.name}")
            else:
                # Send notification for manual identification
                await notification_service.send_client_identification_request(
                    topic=recording.topic,
                    recording_id=recording.id,
                )

            # ====================================
            # Step 6: Save to Notion and Sheets
            # ====================================
            await update_status(session, recording, ProcessingStatus.SAVING)

            # Get client Notion page ID if exists
            client_notion_id = None
            if client:
                client_notion_id = client.notion_page_id
                if not client_notion_id:
                    # Create client page in Notion
                    client_notion_id = await notion_service.create_client_page(
                        name=client.name,
                        description=client.description,
                    )
                    client.notion_page_id = client_notion_id
                    await session.commit()

            # Create meeting page in Notion
            notion_page_id = await notion_service.create_meeting_page(
                title=recording.topic,
                start_time=recording.start_time,
                youtube_url=youtube_url,
                zoom_url=recording.recording_url,
                transcript=transcript,
                summary=summary,
                decisions=decisions,
                action_items=action_items,
                client_page_id=client_notion_id,
            )

            recording.notion_page_id = notion_page_id
            await session.commit()

            # Save to Google Sheets (master)
            await sheets_service.append_meeting_record(
                meeting_id=recording.zoom_meeting_id,
                topic=recording.topic,
                start_time=recording.start_time,
                duration_minutes=recording.duration_minutes,
                youtube_url=youtube_url,
                zoom_url=recording.recording_url,
                summary=summary,
                decisions=decisions,
                action_items=action_items,
                client_name=client.name if client else None,
            )

            # Save to client sheet if client identified
            if client:
                await sheets_service.append_to_client_sheet(
                    client_name=client.name,
                    meeting_date=recording.start_time,
                    topic=recording.topic,
                    youtube_url=youtube_url,
                    summary=summary,
                    decisions=decisions,
                    action_items=action_items,
                )

            logger.info("Saved to Notion and Sheets")

            # ====================================
            # Step 7: Update Calendar Event
            # ====================================
            calendar_event = await calendar_service.find_event_by_zoom_meeting(
                zoom_meeting_id=recording.zoom_meeting_id,
                meeting_start_time=recording.start_time,
                topic=recording.topic,
            )

            if calendar_event:
                await calendar_service.update_event_with_recording(
                    event_id=calendar_event["id"],
                    youtube_url=youtube_url,
                    summary_text=summary,
                    zoom_recording_url=recording.recording_url,
                )
                recording.calendar_event_id = calendar_event["id"]
                await session.commit()
                logger.info(f"Updated calendar event: {calendar_event['id']}")

            # ====================================
            # Step 8: Update Client Cumulative Summary
            # ====================================
            if client:
                cumulative = await client_service.update_client_summary(client.id)

                # Update Notion client page
                if client.notion_page_id:
                    await notion_service.update_client_summary(
                        page_id=client.notion_page_id,
                        cumulative_summary=cumulative,
                        meeting_count=client.meeting_count,
                        last_meeting_date=recording.start_time,
                    )

                # Update Sheets client summary
                await sheets_service.update_client_summary(
                    client_name=client.name,
                    cumulative_summary=cumulative,
                    meeting_count=client.meeting_count,
                    last_meeting_date=recording.start_time,
                )

                logger.info(f"Updated cumulative summary for: {client.name}")

            # ====================================
            # Step 9: Send Notifications
            # ====================================
            await notification_service.send_processing_complete(
                topic=recording.topic,
                youtube_url=youtube_url,
                client_name=client.name if client else None,
                summary=summary,
            )

            # ====================================
            # Step 10: Mark Complete & Cleanup
            # ====================================
            recording.status = ProcessingStatus.COMPLETED
            recording.completed_at = datetime.utcnow()
            await session.commit()

            # Cleanup downloaded file
            if settings.auto_delete_after_processing and downloaded_file:
                zoom_service.cleanup_file(downloaded_file)

            logger.info(f"Processing completed for recording: {recording_id}")

        except Exception as e:
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            logger.error(f"Processing failed for recording {recording_id}: {error_msg}")

            # Update status to failed
            try:
                recording.status = ProcessingStatus.FAILED
                recording.error_message = error_msg[:2000]
                recording.retry_count += 1
                await session.commit()

                # Send error notification
                await notification_service.send_processing_error(
                    topic=recording.topic,
                    error_message=str(e),
                    recording_id=recording_id,
                )
            except Exception as update_error:
                logger.error(f"Failed to update error status: {update_error}")

            # Cleanup on error
            if downloaded_file and downloaded_file.exists():
                zoom_service.cleanup_file(downloaded_file)

            raise


async def update_status(
    session,
    recording: DBRecording,
    status: ProcessingStatus,
):
    """Update recording status."""
    recording.status = status
    recording.updated_at = datetime.utcnow()
    await session.commit()
    logger.debug(f"Status updated to: {status.value}")


async def retry_failed_recordings():
    """Retry processing for failed recordings with retry_count < 3."""
    async for session in db.get_session():
        result = await session.execute(
            select(DBRecording).where(
                DBRecording.status == ProcessingStatus.FAILED,
                DBRecording.retry_count < 3,
            )
        )
        recordings = result.scalars().all()

        for recording in recordings:
            logger.info(f"Retrying recording: {recording.id}")
            try:
                await process_recording(recording.id)
            except Exception as e:
                logger.error(f"Retry failed for {recording.id}: {e}")
