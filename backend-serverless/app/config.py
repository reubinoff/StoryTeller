"""Application configuration loaded from env vars."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal["anthropic", "azure_openai"]


def contains_control_characters(value: str) -> bool:
    return any(ord(char) < 32 or ord(char) == 127 for char in value)


class LLMTokenPrice(BaseModel):
    input_per_million: float = Field(ge=0)
    output_per_million: float = Field(ge=0)
    cache_write_per_million: float | None = Field(default=None, ge=0)
    cache_read_per_million: float | None = Field(default=None, ge=0)


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
    admin_frontend_base_url: str = "http://localhost:5175"
    admin_bootstrap_emails: list[str] = Field(
        default_factory=lambda: ["reubinoff@gmail.com"]
    )
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:7071/api/v1/auth/google/callback"

    anthropic_api_key: str = Field(default="")
    claude_model: str = Field(default="claude-haiku-4-5-20251001")
    llm_provider: LLMProvider = "anthropic"
    llm_model: str = ""
    llm_max_tokens: int | None = None
    claude_max_tokens: int = 4096
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_api_version: str = ""
    llm_token_pricing: dict[str, LLMTokenPrice] = Field(default_factory=dict)

    @field_validator("anthropic_api_key", "azure_openai_api_key", mode="before")
    @classmethod
    def _normalize_llm_api_key(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return value.strip()

    azure_web_jobs_storage: str = Field(
        default="",
        validation_alias=AliasChoices("AzureWebJobsStorage", "AZURE_WEB_JOBS_STORAGE"),
    )
    evaluation_queue_name: str = Field(default="writing-evaluations")
    task_prewarm_queue_name: str = Field(default="task-prewarm")
    avatar_container_name: str = Field(default="avatars")
    create_evaluation_queue_on_enqueue: bool = Field(default=True)
    create_task_prewarm_queue_on_enqueue: bool = Field(default=True)

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "https://storyteller.reubinoff.com",
        ]
    )

    seed_on_startup: bool = True
    auto_create_schema: bool = False
    run_migrations_on_startup: bool = False

    @property
    def cors_origins_with_admin(self) -> list[str]:
        origins = [origin.rstrip("/") for origin in self.cors_origins]
        admin_origin = self.admin_frontend_base_url.rstrip("/")
        if admin_origin and admin_origin not in origins:
            origins.append(admin_origin)
        return origins

    @property
    def resolved_llm_model(self) -> str:
        if self.llm_provider == "anthropic":
            return self.llm_model or self.claude_model
        return self.llm_model

    @property
    def resolved_llm_max_tokens(self) -> int:
        return self.llm_max_tokens if self.llm_max_tokens is not None else self.claude_max_tokens


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
