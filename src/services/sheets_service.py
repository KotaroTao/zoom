"""Google Sheets API service for recording meeting data."""

import asyncio
from datetime import datetime
from typing import Optional, List

import gspread
from google.oauth2.service_account import Credentials

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()

# Google Sheets API scopes
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


class SheetsService:
    """Service for managing Google Sheets data."""

    MASTER_SHEET_NAME = "全ミーティング"
    CLIENT_SUMMARY_SHEET = "クライアントサマリー"

    def __init__(self):
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None

    def _get_client(self) -> gspread.Client:
        """Get authenticated gspread client."""
        if not self.client:
            creds = Credentials.from_service_account_file(
                settings.google_application_credentials,
                scopes=SCOPES,
            )
            self.client = gspread.authorize(creds)

        return self.client

    def _get_spreadsheet(self) -> gspread.Spreadsheet:
        """Get the target spreadsheet."""
        if not self.spreadsheet:
            client = self._get_client()
            self.spreadsheet = client.open_by_key(
                settings.google_sheets_spreadsheet_id
            )

        return self.spreadsheet

    def _get_or_create_sheet(self, sheet_name: str) -> gspread.Worksheet:
        """Get worksheet by name, create if not exists."""
        spreadsheet = self._get_spreadsheet()

        try:
            return spreadsheet.worksheet(sheet_name)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(
                title=sheet_name,
                rows=1000,
                cols=20,
            )
            logger.info(f"Created new sheet: {sheet_name}")
            return worksheet

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def append_meeting_record(
        self,
        meeting_id: str,
        topic: str,
        start_time: datetime,
        duration_minutes: int,
        youtube_url: Optional[str] = None,
        zoom_url: Optional[str] = None,
        summary: Optional[str] = None,
        decisions: Optional[str] = None,
        action_items: Optional[str] = None,
        client_name: Optional[str] = None,
    ) -> int:
        """
        Append a meeting record to the master sheet.

        Returns:
            Row number where record was added
        """
        def _append():
            sheet = self._get_or_create_sheet(self.MASTER_SHEET_NAME)

            # Check if header exists
            try:
                header = sheet.row_values(1)
            except Exception:
                header = []

            if not header or header[0] != "日時":
                # Add header row
                sheet.update(
                    "A1:J1",
                    [[
                        "日時",
                        "ミーティングID",
                        "タイトル",
                        "時間(分)",
                        "クライアント",
                        "YouTube URL",
                        "Zoom URL",
                        "要約",
                        "決定事項",
                        "アクションアイテム",
                    ]],
                )

            # Prepare row data
            row = [
                start_time.strftime("%Y-%m-%d %H:%M"),
                meeting_id,
                topic,
                duration_minutes,
                client_name or "",
                youtube_url or "",
                zoom_url or "",
                summary or "",
                decisions or "",
                action_items or "",
            ]

            # Append row
            sheet.append_row(row, value_input_option="USER_ENTERED")

            return sheet.row_count

        row_num = await asyncio.get_event_loop().run_in_executor(None, _append)
        logger.info(f"Appended meeting record to row {row_num}")
        return row_num

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def append_to_client_sheet(
        self,
        client_name: str,
        meeting_date: datetime,
        topic: str,
        youtube_url: Optional[str] = None,
        summary: Optional[str] = None,
        decisions: Optional[str] = None,
        action_items: Optional[str] = None,
        progress_note: Optional[str] = None,
    ) -> int:
        """
        Append a meeting record to a client-specific sheet.

        Creates the sheet if it doesn't exist.
        """
        def _append():
            sheet_name = f"CL_{client_name[:20]}"  # Limit sheet name length
            sheet = self._get_or_create_sheet(sheet_name)

            # Check if header exists
            try:
                header = sheet.row_values(1)
            except Exception:
                header = []

            if not header or header[0] != "開催日時":
                sheet.update(
                    "A1:G1",
                    [[
                        "開催日時",
                        "タイトル",
                        "YouTube",
                        "要約",
                        "決定事項",
                        "アクション",
                        "前回からの進捗",
                    ]],
                )

            row = [
                meeting_date.strftime("%Y-%m-%d %H:%M"),
                topic,
                youtube_url or "",
                summary or "",
                decisions or "",
                action_items or "",
                progress_note or "",
            ]

            sheet.append_row(row, value_input_option="USER_ENTERED")
            return sheet.row_count

        row_num = await asyncio.get_event_loop().run_in_executor(None, _append)
        logger.info(f"Appended to client sheet for {client_name}")
        return row_num

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def update_client_summary(
        self,
        client_name: str,
        cumulative_summary: str,
        meeting_count: int,
        last_meeting_date: Optional[datetime] = None,
    ):
        """Update the client summary sheet."""
        def _update():
            sheet = self._get_or_create_sheet(self.CLIENT_SUMMARY_SHEET)

            # Check if header exists
            try:
                header = sheet.row_values(1)
            except Exception:
                header = []

            if not header or header[0] != "クライアント名":
                sheet.update(
                    "A1:D1",
                    [[
                        "クライアント名",
                        "ミーティング回数",
                        "最終ミーティング",
                        "累積サマリー",
                    ]],
                )

            # Find existing row for client
            try:
                cell = sheet.find(client_name)
                row_num = cell.row
            except gspread.exceptions.CellNotFound:
                row_num = sheet.row_count + 1

            # Update row
            sheet.update(
                f"A{row_num}:D{row_num}",
                [[
                    client_name,
                    meeting_count,
                    last_meeting_date.strftime("%Y-%m-%d") if last_meeting_date else "",
                    cumulative_summary[:50000],  # Sheets cell limit
                ]],
            )

            return row_num

        row_num = await asyncio.get_event_loop().run_in_executor(None, _update)
        logger.info(f"Updated client summary for {client_name} at row {row_num}")

    async def get_client_meetings(
        self,
        client_name: str,
    ) -> List[dict]:
        """Get all meetings for a client from the client sheet."""
        def _get():
            sheet_name = f"CL_{client_name[:20]}"
            try:
                sheet = self._get_spreadsheet().worksheet(sheet_name)
                records = sheet.get_all_records()
                return records
            except gspread.WorksheetNotFound:
                return []

        records = await asyncio.get_event_loop().run_in_executor(None, _get)
        return records

    async def get_all_meetings(self) -> List[dict]:
        """Get all meetings from master sheet."""
        def _get():
            sheet = self._get_or_create_sheet(self.MASTER_SHEET_NAME)
            return sheet.get_all_records()

        return await asyncio.get_event_loop().run_in_executor(None, _get)
