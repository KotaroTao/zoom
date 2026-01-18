"""Zoom Webhook handler for recording completed events."""

import hashlib
import hmac
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.database import get_db, DBRecording
from src.models.recording import ProcessingStatus, ZoomWebhookPayload
from src.utils.logger import get_logger
from src.workers.processing_worker import process_recording

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = get_logger(__name__)
settings = get_settings()


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    timestamp: str,
) -> bool:
    """
    Verify Zoom webhook signature.

    Args:
        payload: Raw request body
        signature: x-zm-signature header value
        timestamp: x-zm-request-timestamp header value

    Returns:
        True if signature is valid
    """
    message = f"v0:{timestamp}:{payload.decode('utf-8')}"
    expected_signature = hmac.new(
        settings.zoom_webhook_secret_token.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(f"v0={expected_signature}", signature)


@router.post("/zoom")
async def handle_zoom_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_zm_signature: Optional[str] = Header(None),
    x_zm_request_timestamp: Optional[str] = Header(None),
):
    """
    Handle incoming Zoom webhooks.

    Supports:
    - endpoint.url_validation: Zoom endpoint verification
    - recording.completed: Recording completed event
    """
    body = await request.body()

    # Verify signature (skip for URL validation)
    if x_zm_signature and x_zm_request_timestamp:
        if not verify_webhook_signature(body, x_zm_signature, x_zm_request_timestamp):
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    event = data.get("event", "")

    logger.info(f"Received Zoom webhook event: {event}")

    # Handle URL validation challenge
    if event == "endpoint.url_validation":
        plain_token = data.get("payload", {}).get("plainToken", "")
        encrypted_token = hmac.new(
            settings.zoom_webhook_secret_token.encode(),
            plain_token.encode(),
            hashlib.sha256,
        ).hexdigest()

        logger.info("Responding to Zoom URL validation challenge")
        return {
            "plainToken": plain_token,
            "encryptedToken": encrypted_token,
        }

    # Handle recording completed event
    if event == "recording.completed":
        webhook_payload = ZoomWebhookPayload(**data)
        await handle_recording_completed(webhook_payload, background_tasks)
        return {"status": "processing"}

    # Log unhandled events
    logger.debug(f"Unhandled webhook event: {event}")
    return {"status": "ignored"}


async def handle_recording_completed(
    payload: ZoomWebhookPayload,
    background_tasks: BackgroundTasks,
):
    """
    Handle recording.completed webhook event.

    Creates a database record and queues the recording for processing.
    """
    from src.database import db

    # Get MP4 file for video upload
    mp4_file = payload.get_mp4_file()
    if not mp4_file:
        logger.warning(f"No MP4 file found for meeting {payload.meeting_id}")
        return

    async for session in db.get_session():
        # Check for duplicate
        existing = await session.execute(
            select(DBRecording).where(
                DBRecording.zoom_meeting_uuid == payload.meeting_uuid
            )
        )
        if existing.scalar_one_or_none():
            logger.info(f"Recording already exists: {payload.meeting_uuid}")
            return

        # Create new recording record
        recording = DBRecording(
            zoom_meeting_id=payload.meeting_id,
            zoom_meeting_uuid=payload.meeting_uuid,
            topic=payload.topic,
            start_time=payload.start_time or datetime.utcnow(),
            duration_minutes=payload.duration,
            host_email=payload.host_email,
            recording_url=mp4_file.download_url,
            recording_type=mp4_file.file_type,
            status=ProcessingStatus.PENDING,
        )

        session.add(recording)
        await session.commit()
        await session.refresh(recording)

        logger.info(
            f"Created recording record: {recording.id} for meeting {payload.topic}"
        )

        # Queue for background processing
        background_tasks.add_task(process_recording, recording.id)

        return recording
