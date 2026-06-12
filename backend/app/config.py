"""Application configuration loaded from env vars."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "LinguaQuest"
    environment: str = "dev"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/linguaquest"
    )

    jwt_secret: str = Field(default="change-me-in-prod-please-use-a-long-random-string")
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_seconds: int = 60 * 15

    anthropic_api_key: str = Field(default="")
    claude_model: str = Field(default="claude-sonnet-4-5-20250929")
    claude_max_tokens: int = 4096

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    seed_on_startup: bool = True
    auto_create_schema: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
