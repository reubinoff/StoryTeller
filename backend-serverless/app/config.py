"""Application configuration loaded from env vars."""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "StoryTeller"
    environment: str = "dev"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/storyteller"
    )

    jwt_secret: str = Field(default="change-me-in-prod-please-use-a-long-random-string")
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_seconds: int = 60 * 15
    jwt_refresh_ttl_seconds: int = 60 * 60 * 24 * 30
    auth_cookie_secure: bool | None = None

    frontend_base_url: str = "http://localhost:5174"
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:7071/api/v1/auth/google/callback"

    anthropic_api_key: str = Field(default="")
    claude_model: str = Field(default="claude-haiku-4-5-20251001")
    claude_max_tokens: int = 4096

    azure_web_jobs_storage: str = Field(
        default="",
        validation_alias=AliasChoices("AzureWebJobsStorage", "AZURE_WEB_JOBS_STORAGE"),
    )
    evaluation_queue_name: str = Field(default="writing-evaluations")
    task_prewarm_queue_name: str = Field(default="task-prewarm")
    create_evaluation_queue_on_enqueue: bool = Field(default=True)
    create_task_prewarm_queue_on_enqueue: bool = Field(default=True)

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "https://storyteller.reubinoff.com",
        ]
    )

    seed_on_startup: bool = True
    auto_create_schema: bool = False
    run_migrations_on_startup: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
