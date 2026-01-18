"""Notion API service for managing meeting records."""

from datetime import datetime
from typing import Optional, List, Dict

from notion_client import Client

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()


class NotionService:
    """Service for syncing data with Notion databases."""

    def __init__(self):
        self.client = Client(auth=settings.notion_api_key)
        self.meeting_db_id = settings.notion_meeting_db_id
        self.client_db_id = settings.notion_client_db_id

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def create_meeting_page(
        self,
        title: str,
        start_time: datetime,
        youtube_url: Optional[str] = None,
        zoom_url: Optional[str] = None,
        transcript: Optional[str] = None,
        summary: Optional[str] = None,
        decisions: Optional[str] = None,
        action_items: Optional[str] = None,
        client_page_id: Optional[str] = None,
    ) -> str:
        """
        Create a new meeting page in Notion.

        Returns:
            Notion page ID
        """
        import asyncio

        properties = {
            "タイトル": {"title": [{"text": {"content": title}}]},
            "開催日時": {"date": {"start": start_time.isoformat()}},
        }

        if youtube_url:
            properties["YouTube URL"] = {"url": youtube_url}

        if zoom_url:
            properties["Zoom録画URL"] = {"url": zoom_url}

        if client_page_id:
            properties["クライアント"] = {
                "relation": [{"id": client_page_id}]
            }

        # Build page content
        children = []

        if summary:
            children.extend([
                {"object": "block", "heading_2": {"rich_text": [{"text": {"content": "要約"}}]}},
                {"object": "block", "paragraph": {"rich_text": [{"text": {"content": summary}}]}},
            ])

        if decisions:
            children.extend([
                {"object": "block", "heading_2": {"rich_text": [{"text": {"content": "決定事項"}}]}},
                {"object": "block", "paragraph": {"rich_text": [{"text": {"content": decisions}}]}},
            ])

        if action_items:
            children.extend([
                {"object": "block", "heading_2": {"rich_text": [{"text": {"content": "アクションアイテム"}}]}},
                {"object": "block", "paragraph": {"rich_text": [{"text": {"content": action_items}}]}},
            ])

        if transcript:
            # Truncate transcript for Notion (max 2000 chars per block)
            truncated = transcript[:10000] if len(transcript) > 10000 else transcript
            children.extend([
                {"object": "block", "heading_2": {"rich_text": [{"text": {"content": "文字起こし"}}]}},
                {
                    "object": "block",
                    "toggle": {
                        "rich_text": [{"text": {"content": "全文を表示"}}],
                        "children": [
                            {"object": "block", "paragraph": {"rich_text": [{"text": {"content": truncated[:2000]}}]}}
                        ],
                    },
                },
            ])

        # Create page
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.pages.create(
                parent={"database_id": self.meeting_db_id},
                properties=properties,
                children=children if children else None,
            ),
        )

        page_id = result["id"]
        logger.info(f"Created Notion meeting page: {page_id}")
        return page_id

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def update_meeting_page(
        self,
        page_id: str,
        **kwargs,
    ) -> dict:
        """Update an existing meeting page."""
        import asyncio

        properties = {}

        if "youtube_url" in kwargs:
            properties["YouTube URL"] = {"url": kwargs["youtube_url"]}

        if "status" in kwargs:
            properties["ステータス"] = {"select": {"name": kwargs["status"]}}

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.pages.update(
                page_id=page_id,
                properties=properties,
            ),
        )

        return result

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def create_client_page(
        self,
        name: str,
        description: Optional[str] = None,
        status: str = "アクティブ",
    ) -> str:
        """
        Create a new client page in Notion.

        Returns:
            Notion page ID
        """
        import asyncio

        properties = {
            "名前": {"title": [{"text": {"content": name}}]},
            "ステータス": {"select": {"name": status}},
        }

        children = []
        if description:
            children.append({
                "object": "block",
                "paragraph": {"rich_text": [{"text": {"content": description}}]},
            })

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.pages.create(
                parent={"database_id": self.client_db_id},
                properties=properties,
                children=children if children else None,
            ),
        )

        page_id = result["id"]
        logger.info(f"Created Notion client page: {page_id}")
        return page_id

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def update_client_summary(
        self,
        page_id: str,
        cumulative_summary: str,
        meeting_count: int,
        last_meeting_date: Optional[datetime] = None,
    ) -> dict:
        """Update client page with cumulative summary."""
        import asyncio

        properties = {
            "ミーティング回数": {"number": meeting_count},
        }

        if last_meeting_date:
            properties["最終ミーティング"] = {
                "date": {"start": last_meeting_date.isoformat()}
            }

        # Update properties
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.pages.update(
                page_id=page_id,
                properties=properties,
            ),
        )

        # Update summary content block
        # First, get existing blocks
        blocks = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.blocks.children.list(block_id=page_id),
        )

        # Find and update or create summary block
        summary_block_id = None
        for block in blocks.get("results", []):
            if block.get("type") == "heading_2":
                text = block.get("heading_2", {}).get("rich_text", [])
                if text and text[0].get("text", {}).get("content") == "累積サマリー":
                    # Get the next block (the actual summary content)
                    idx = blocks["results"].index(block)
                    if idx + 1 < len(blocks["results"]):
                        summary_block_id = blocks["results"][idx + 1]["id"]
                    break

        if summary_block_id:
            # Update existing block
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.blocks.update(
                    block_id=summary_block_id,
                    paragraph={"rich_text": [{"text": {"content": cumulative_summary[:2000]}}]},
                ),
            )
        else:
            # Append new summary section
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.blocks.children.append(
                    block_id=page_id,
                    children=[
                        {"object": "block", "heading_2": {"rich_text": [{"text": {"content": "累積サマリー"}}]}},
                        {"object": "block", "paragraph": {"rich_text": [{"text": {"content": cumulative_summary[:2000]}}]}},
                    ],
                ),
            )

        logger.info(f"Updated Notion client summary: {page_id}")
        return {"success": True}

    async def find_client_by_name(self, name: str) -> Optional[str]:
        """Find client page ID by name."""
        import asyncio

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.databases.query(
                database_id=self.client_db_id,
                filter={"property": "名前", "title": {"equals": name}},
            ),
        )

        results = result.get("results", [])
        if results:
            return results[0]["id"]
        return None

    async def get_client_meetings(
        self,
        client_page_id: str,
        limit: int = 50,
    ) -> List[Dict]:
        """Get all meetings for a client."""
        import asyncio

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.client.databases.query(
                database_id=self.meeting_db_id,
                filter={
                    "property": "クライアント",
                    "relation": {"contains": client_page_id},
                },
                sorts=[{"property": "開催日時", "direction": "descending"}],
                page_size=limit,
            ),
        )

        return result.get("results", [])
