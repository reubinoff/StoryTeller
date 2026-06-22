"""Backward-compatible aliases for older tests/imports."""

from __future__ import annotations

from app.config import get_settings
from app.llm.client import LLMClient, get_llm_client, render_prompt, set_llm_client

__all__ = ["ClaudeClient", "get_claude_client", "render_prompt", "set_claude_client"]


class ClaudeClient(LLMClient):
    """Compatibility wrapper that maps old Claude-only constructor args."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> None:
        settings = get_settings()
        if api_key is not None or model is not None or max_tokens is not None:
            settings = settings.model_copy(
                update={
                    "llm_provider": "anthropic",
                    "anthropic_api_key": (
                        api_key if api_key is not None else settings.anthropic_api_key
                    ),
                    "llm_model": model if model is not None else settings.llm_model,
                    "llm_max_tokens": (
                        max_tokens if max_tokens is not None else settings.llm_max_tokens
                    ),
                }
            )
        super().__init__(settings=settings)


def get_claude_client() -> LLMClient:
    return get_llm_client()


def set_claude_client(client: LLMClient | None) -> None:
    set_llm_client(client)
