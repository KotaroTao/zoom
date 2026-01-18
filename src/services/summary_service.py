"""Summary service using OpenAI GPT for meeting summarization."""

import asyncio
from pathlib import Path
from typing import Optional, List, Dict

from openai import OpenAI

from src.config import get_settings
from src.utils.logger import get_logger
from src.utils.retry import async_retry

logger = get_logger(__name__)
settings = get_settings()

# Default prompts
DEFAULT_SUMMARY_PROMPT = """以下はZoomミーティングの文字起こしです。この内容を日本語で要約してください。

要約には以下の項目を含めてください：
1. ミーティングの概要（2-3文）
2. 主要な議題（箇条書き）
3. 重要なポイント（箇条書き）

文字起こし：
{transcript}

要約："""

DEFAULT_DECISIONS_PROMPT = """以下はZoomミーティングの文字起こしです。このミーティングで決定された事項を抽出してください。

決定事項がない場合は「決定事項なし」と回答してください。
箇条書きで、具体的かつ簡潔に記載してください。

文字起こし：
{transcript}

決定事項："""

DEFAULT_ACTIONS_PROMPT = """以下はZoomミーティングの文字起こしです。このミーティングで発生したアクションアイテム（TODO、宿題、次のステップ）を抽出してください。

アクションアイテムがない場合は「アクションアイテムなし」と回答してください。
可能であれば、担当者と期限も含めてください。
箇条書きで記載してください。

文字起こし：
{transcript}

アクションアイテム："""

DEFAULT_CUMULATIVE_PROMPT = """あなたはプロジェクト管理のアシスタントです。
以下はあるクライアントとの複数回のミーティング要約履歴です。
これらを分析し、プロジェクト全体の状況を把握できる累積サマリーを作成してください。

累積サマリーには以下を含めてください：
1. プロジェクト概要（何のプロジェクトか、現在のフェーズ）
2. これまでの主要マイルストーン（達成済みの重要な成果）
3. 現在進行中の作業
4. 未解決の課題・懸念事項
5. 次のステップ・予定されているアクション

過去のミーティング要約：
{meeting_summaries}

累積サマリー："""

DEFAULT_CLIENT_IDENTIFY_PROMPT = """以下はZoomミーティングの情報です。このミーティングがどのクライアント（顧客・取引先）に関するものか特定してください。

ミーティングタイトル: {title}
参加者のメールドメイン: {domains}
会話の冒頭部分: {transcript_start}

クライアント名を1つだけ回答してください。特定できない場合は「不明」と回答してください。
回答には企業名のみを含め、説明は不要です。

クライアント名："""


class SummaryService:
    """Service for generating meeting summaries using GPT."""

    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_gpt_model
        self._load_prompts()

    def _load_prompts(self):
        """Load prompts from files or use defaults."""
        prompts_dir = Path("prompts")

        self.summary_prompt = self._load_prompt(
            prompts_dir / "meeting_summary.txt",
            DEFAULT_SUMMARY_PROMPT,
        )
        self.decisions_prompt = self._load_prompt(
            prompts_dir / "extract_decisions.txt",
            DEFAULT_DECISIONS_PROMPT,
        )
        self.actions_prompt = self._load_prompt(
            prompts_dir / "extract_actions.txt",
            DEFAULT_ACTIONS_PROMPT,
        )
        self.cumulative_prompt = self._load_prompt(
            prompts_dir / "cumulative_summary.txt",
            DEFAULT_CUMULATIVE_PROMPT,
        )
        self.client_identify_prompt = self._load_prompt(
            prompts_dir / "identify_client.txt",
            DEFAULT_CLIENT_IDENTIFY_PROMPT,
        )

    def _load_prompt(self, path: Path, default: str) -> str:
        """Load prompt from file or return default."""
        if path.exists():
            return path.read_text(encoding="utf-8")
        return default

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def generate_summary(
        self,
        transcript: str,
        custom_prompt: Optional[str] = None,
    ) -> str:
        """
        Generate a summary of the meeting transcript.

        Args:
            transcript: The meeting transcript
            custom_prompt: Optional custom prompt template

        Returns:
            Summary text
        """
        prompt = (custom_prompt or self.summary_prompt).format(
            transcript=self._truncate_transcript(transcript)
        )

        logger.info("Generating meeting summary")

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
        )

        logger.info(f"Summary generated: {len(result)} characters")
        return result

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def extract_decisions(self, transcript: str) -> str:
        """Extract decisions from the meeting transcript."""
        prompt = self.decisions_prompt.format(
            transcript=self._truncate_transcript(transcript)
        )

        logger.info("Extracting decisions from meeting")

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
        )

        return result

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def extract_action_items(self, transcript: str) -> str:
        """Extract action items from the meeting transcript."""
        prompt = self.actions_prompt.format(
            transcript=self._truncate_transcript(transcript)
        )

        logger.info("Extracting action items from meeting")

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
        )

        return result

    @async_retry(max_attempts=3, initial_delay=2.0)
    async def generate_cumulative_summary(
        self,
        meeting_summaries: List[Dict[str, str]],
    ) -> str:
        """
        Generate a cumulative summary from multiple meeting summaries.

        Args:
            meeting_summaries: List of {"date": "...", "summary": "..."}

        Returns:
            Cumulative summary text
        """
        # Format meeting summaries
        formatted = []
        for ms in meeting_summaries:
            formatted.append(f"【{ms.get('date', '日付不明')}】\n{ms.get('summary', '')}")

        summaries_text = "\n\n---\n\n".join(formatted)
        prompt = self.cumulative_prompt.format(meeting_summaries=summaries_text)

        logger.info(f"Generating cumulative summary from {len(meeting_summaries)} meetings")

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
        )

        return result

    @async_retry(max_attempts=2, initial_delay=1.0)
    async def identify_client(
        self,
        title: str,
        transcript_start: str,
        email_domains: Optional[List[str]] = None,
    ) -> str:
        """
        Identify the client from meeting information.

        Args:
            title: Meeting title
            transcript_start: First part of transcript
            email_domains: List of participant email domains

        Returns:
            Client name or "不明"
        """
        domains = ", ".join(email_domains) if email_domains else "不明"
        prompt = self.client_identify_prompt.format(
            title=title,
            domains=domains,
            transcript_start=transcript_start[:1000],
        )

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
            200,  # Max tokens for short response
        )

        return result.strip()

    async def generate_chapters(
        self,
        transcript_with_timestamps: Dict,
    ) -> List[Dict[str, str]]:
        """
        Generate YouTube chapters from transcript with timestamps.

        Returns:
            List of {"time": "00:00", "title": "Chapter Title"}
        """
        segments = transcript_with_timestamps.get("segments", [])
        if not segments:
            return []

        # Group segments into ~5 minute chunks
        chapters = []
        current_start = 0
        chunk_texts = []
        chunk_duration = 300  # 5 minutes

        for seg in segments:
            if seg["start"] - current_start >= chunk_duration and chunk_texts:
                # Generate chapter title for this chunk
                title = await self._generate_chapter_title(
                    " ".join(chunk_texts)
                )
                minutes = int(current_start // 60)
                seconds = int(current_start % 60)
                chapters.append({
                    "time": f"{minutes:02d}:{seconds:02d}",
                    "title": title,
                })
                current_start = seg["start"]
                chunk_texts = []

            chunk_texts.append(seg["text"])

        # Add final chapter
        if chunk_texts:
            title = await self._generate_chapter_title(" ".join(chunk_texts))
            minutes = int(current_start // 60)
            seconds = int(current_start % 60)
            chapters.append({
                "time": f"{minutes:02d}:{seconds:02d}",
                "title": title,
            })

        return chapters

    async def _generate_chapter_title(self, text: str) -> str:
        """Generate a short chapter title from text segment."""
        prompt = f"以下のテキストの内容を10文字以内の日本語タイトルにしてください。\n\n{text[:500]}\n\nタイトル："

        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._call_gpt,
            prompt,
            50,
        )

        return result.strip()[:20]  # Limit chapter title length

    def _call_gpt(
        self,
        prompt: str,
        max_tokens: int = 2000,
    ) -> str:
        """Make synchronous GPT API call."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "あなたは優秀な日本語の議事録作成アシスタントです。",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )

        return response.choices[0].message.content

    def _truncate_transcript(self, transcript: str, max_chars: int = 30000) -> str:
        """Truncate transcript to fit within token limits."""
        if len(transcript) <= max_chars:
            return transcript

        # Keep beginning and end
        half = max_chars // 2
        return (
            transcript[:half]
            + "\n\n... (中略) ...\n\n"
            + transcript[-half:]
        )
