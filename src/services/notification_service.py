"""Notification service for Slack and other channels."""

import asyncio
from datetime import datetime
from typing import Optional, List, Dict

from slack_sdk.webhook.async_client import AsyncWebhookClient

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()


class NotificationService:
    """Service for sending notifications via Slack."""

    def __init__(self):
        self.enabled = settings.slack_enabled and settings.slack_webhook_url
        if self.enabled:
            self.client = AsyncWebhookClient(settings.slack_webhook_url)
        else:
            self.client = None

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def send_processing_complete(
        self,
        topic: str,
        youtube_url: str,
        client_name: Optional[str] = None,
        summary: Optional[str] = None,
    ):
        """Send notification when recording processing is complete."""
        if not self.enabled:
            logger.debug("Slack notifications disabled")
            return

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✅ 録画処理完了",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*ミーティング:*\n{topic}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*クライアント:*\n{client_name or '未識別'}",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*YouTube:* <{youtube_url}|動画を見る>",
                },
            },
        ]

        if summary:
            # Truncate summary for Slack
            truncated = summary[:500] + "..." if len(summary) > 500 else summary
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*要約:*\n{truncated}",
                },
            })

        await self.client.send(blocks=blocks)
        logger.info(f"Sent completion notification for: {topic}")

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def send_processing_error(
        self,
        topic: str,
        error_message: str,
        recording_id: int,
    ):
        """Send notification when processing fails."""
        if not self.enabled:
            return

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "❌ 録画処理エラー",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*ミーティング:*\n{topic}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*録画ID:*\n{recording_id}",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*エラー:*\n```{error_message[:500]}```",
                },
            },
        ]

        await self.client.send(blocks=blocks)
        logger.info(f"Sent error notification for: {topic}")

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def send_client_identification_request(
        self,
        topic: str,
        recording_id: int,
        suggested_clients: Optional[List[str]] = None,
    ):
        """Send notification requesting client identification."""
        if not self.enabled:
            return

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🔍 クライアント識別が必要",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"以下のミーティングのクライアントを識別できませんでした:\n*{topic}*",
                },
            },
        ]

        if suggested_clients:
            options = "\n".join([f"• {c}" for c in suggested_clients])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*候補:*\n{options}",
                },
            })

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"ダッシュボードで設定してください。\n録画ID: `{recording_id}`",
            },
        })

        await self.client.send(blocks=blocks)
        logger.info(f"Sent client identification request for: {topic}")

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def send_upcoming_meeting_reminder(
        self,
        client_name: str,
        meeting_title: str,
        meeting_time: datetime,
        past_summary: str,
    ):
        """Send reminder about upcoming meeting with past context."""
        if not self.enabled:
            return

        time_str = meeting_time.strftime("%Y-%m-%d %H:%M")
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📅 {client_name} ミーティング予定",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*日時:*\n{time_str}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*タイトル:*\n{meeting_title}",
                    },
                ],
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*過去のミーティングサマリー:*",
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": past_summary[:2000],
                },
            },
        ]

        await self.client.send(blocks=blocks)
        logger.info(f"Sent upcoming meeting reminder for: {client_name}")

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def send_simple_message(self, message: str):
        """Send a simple text message."""
        if not self.enabled:
            return

        await self.client.send(text=message)

    async def send_daily_summary(
        self,
        date: datetime,
        meetings_processed: int,
        clients_updated: int,
        errors: int,
    ):
        """Send daily processing summary."""
        if not self.enabled:
            return

        date_str = date.strftime("%Y-%m-%d")
        status_emoji = "✅" if errors == 0 else "⚠️"

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 {date_str} 処理サマリー",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*処理完了:*\n{meetings_processed}件",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*クライアント更新:*\n{clients_updated}件",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*エラー:*\n{errors}件",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*ステータス:*\n{status_emoji}",
                    },
                ],
            },
        ]

        await self.client.send(blocks=blocks)
        logger.info(f"Sent daily summary for: {date_str}")
