"""Tests for the real-provider LLM smoke script without network calls."""

from __future__ import annotations

from typing import TypeVar

import pytest
from pydantic import BaseModel

from app.config import Settings
from app.llm.client import LLMConfigError
from scripts.smoke_llm_provider import (
    build_smoke_prompt,
    ensure_required_env,
    extract_latency_ms,
    format_exception_chain,
    missing_required_env,
    redact_secrets,
    run_smoke,
    smoke_description,
)
from tests.__conftest_helpers__ import WRITING_PROMPT_RESPONSE

OutputT = TypeVar("OutputT", bound=BaseModel)


class FakeSmokeClient:
    def __init__(self, payload: dict[str, object] | None = None) -> None:
        self._payload = payload or WRITING_PROMPT_RESPONSE
        self.calls: list[dict[str, object]] = []

    @property
    def model(self) -> str:
        return "test:llm-smoke"

    async def generate_structured(
        self,
        *,
        prompt: str,
        output_type: type[OutputT],
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[OutputT, int]:
        self.calls.append(
            {
                "prompt": prompt,
                "output_type": output_type,
                "system": system,
                "max_retries": max_retries,
            }
        )
        return (
            output_type.model_validate(self._payload),
            9,
        )


def test_anthropic_smoke_requires_api_key() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="",
        llm_model="",
        claude_model="claude-legacy",
    )

    assert missing_required_env(settings) == ["ANTHROPIC_API_KEY"]


def test_anthropic_smoke_accepts_legacy_model_with_api_key() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="test-key",
        llm_model="",
        claude_model="claude-legacy",
    )

    assert missing_required_env(settings) == []
    assert settings.resolved_llm_model == "claude-legacy"


def test_anthropic_smoke_rejects_embedded_control_characters_without_leaking_key() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="test\nanthropic-key",
        llm_model="",
        claude_model="claude-legacy",
    )

    with pytest.raises(LLMConfigError, match="ANTHROPIC_API_KEY") as exc_info:
        ensure_required_env(settings)

    message = str(exc_info.value)
    assert "single-line" in message
    assert "test\nanthropic-key" not in message


def test_azure_smoke_requires_model_endpoint_and_api_key() -> None:
    settings = Settings(
        llm_provider="azure_openai",
        llm_model="",
        azure_openai_endpoint="",
        azure_openai_api_key="",
    )

    assert missing_required_env(settings) == [
        "LLM_MODEL",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_KEY",
    ]


def test_smoke_prompt_uses_existing_writing_prompt_template() -> None:
    prompt = build_smoke_prompt()

    assert "short-answer writing prompt" in prompt
    assert "travel" in prompt
    assert "30–80" in prompt


def test_extract_latency_supports_metadata_object() -> None:
    class Metadata:
        latency_ms = 42

    assert extract_latency_ms(Metadata()) == 42


def test_smoke_description_uses_resolved_provider_model_and_token_limit() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="test-key",
        llm_model="",
        claude_model="claude-legacy",
        llm_max_tokens=1024,
    )

    assert smoke_description(settings) == (
        "provider=anthropic model=anthropic:claude-legacy max_tokens=1024"
    )


def test_redact_secrets_masks_configured_api_keys() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="anthropic-secret",
        azure_openai_api_key="azure-secret",
    )

    message = "bad keys anthropic-secret and azure-secret"

    assert redact_secrets(message, settings) == "bad keys *** and ***"


def test_format_exception_chain_includes_causes_without_secrets() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="anthropic-secret",
    )

    try:
        try:
            raise RuntimeError("inner anthropic-secret connection reset")
        except RuntimeError as cause:
            raise ValueError("outer failure") from cause
    except ValueError as exc:
        formatted = format_exception_chain(exc, settings)

    assert formatted == (
        "ValueError: outer failure <- RuntimeError: inner *** connection reset"
    )
    assert "anthropic-secret" not in formatted


@pytest.mark.asyncio
async def test_run_smoke_uses_fake_client_without_network() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="test-key",
        claude_model="claude-legacy",
    )
    fake_client = FakeSmokeClient()

    result = await run_smoke(settings=settings, client=fake_client)

    assert result.provider == "anthropic"
    assert result.model == "test:llm-smoke"
    assert result.latency_ms == 9
    assert result.output.title == WRITING_PROMPT_RESPONSE["title"]
    assert len(fake_client.calls) == 1
    assert fake_client.calls[0]["max_retries"] == 1


@pytest.mark.asyncio
async def test_run_smoke_rejects_invalid_word_bounds() -> None:
    settings = Settings(
        llm_provider="anthropic",
        anthropic_api_key="test-key",
        claude_model="claude-legacy",
    )
    payload = {**WRITING_PROMPT_RESPONSE, "min_words": 80, "max_words": 80}
    fake_client = FakeSmokeClient(payload)

    with pytest.raises(ValueError, match="word bounds"):
        await run_smoke(settings=settings, client=fake_client)
