"""
Application configuration using pydantic-settings.
Loads environment variables from .env file.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # -------------------------------------------
    # Zoom Configuration
    # -------------------------------------------
    zoom_account_id: str
    zoom_client_id: str
    zoom_client_secret: str
    zoom_webhook_secret_token: str

    # -------------------------------------------
    # OpenAI Configuration
    # -------------------------------------------
    openai_api_key: str
    openai_whisper_model: str = "whisper-1"
    openai_gpt_model: str = "gpt-4-turbo-preview"

    # -------------------------------------------
    # Google Configuration
    # -------------------------------------------
    google_application_credentials: str = "credentials/service_account.json"
    youtube_client_secret_file: str = "credentials/youtube_oauth.json"
    youtube_token_file: str = "credentials/youtube_token.json"
    google_sheets_spreadsheet_id: str
    google_calendar_id: str = "primary"

    # -------------------------------------------
    # Notion Configuration
    # -------------------------------------------
    notion_api_key: str
    notion_client_db_id: str
    notion_meeting_db_id: str

    # -------------------------------------------
    # Slack Configuration
    # -------------------------------------------
    slack_webhook_url: Optional[str] = None
    slack_enabled: bool = False

    # -------------------------------------------
    # Redis Configuration
    # -------------------------------------------
    redis_url: str = "redis://localhost:6379/0"

    # -------------------------------------------
    # Application Settings
    # -------------------------------------------
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = False
    app_secret_key: str

    # Dashboard Authentication
    dashboard_username: str = "admin"
    dashboard_password: str

    # File Storage
    download_dir: str = "downloads"
    max_file_size_mb: int = 5000

    # Processing
    auto_delete_after_processing: bool = True
    enable_local_whisper: bool = False

    # -------------------------------------------
    # Logging
    # -------------------------------------------
    log_level: str = "INFO"
    log_file: str = "logs/app.log"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
