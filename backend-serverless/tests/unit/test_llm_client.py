"""Tests for provider-neutral LLM configuration and wrapper behavior."""

from __future__ import annotations

import pytest
from pydantic_ai.models.test import TestModel

from app.api.v1.schemas.content import GeneratedWritingPrompt
from app.config import Settings
from app.llm.client import LLMClient, LLMConfigError
from tests.__conftest_helpers__ import WRITING_PROMPT_RESPONSE


def test_default_anthropic_uses_legacy_claude_model() -> None:
    settings = Settings(
        llm_provider="anthropic",
        llm_model="",
        claude_model="claude-legacy",
        anthropic_api_key="test",
    )
    client = LLMClient(settings=settings)

    assert settings.resolved_llm_model == "claude-legacy"
    assert client.model == "anthropic:claude-legacy"


def test_llm_model_overrides_legacy_claude_model() -> None:
    settings = Settings(
        llm_provider="anthropic",
        llm_model="claude-new",
        claude_model="claude-legacy",
        anthropic_api_key="test",
    )
    client = LLMClient(settings=settings)

    assert settings.resolved_llm_model == "claude-new"
    assert client.model == "anthropic:claude-new"


def test_llm_api_keys_are_stripped_for_header_safety() -> None:
    settings = Settings(
        anthropic_api_key="\n test-anthropic-key \r\n",
        azure_openai_api_key="\t test-azure-key \n",
    )

    assert settings.anthropic_api_key == "test-anthropic-key"
    assert settings.azure_openai_api_key == "test-azure-key"


def test_llm_api_keys_reject_embedded_control_characters() -> None:
    with pytest.raises(ValueError, match="single-line"):
        Settings(anthropic_api_key="test\nanthropic-key")


def test_legacy_claude_max_tokens_used_when_llm_max_tokens_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LLM_MAX_TOKENS", raising=False)
    monkeypatch.setenv("CLAUDE_MAX_TOKENS", "1234")
    settings = Settings(_env_file=None)

    assert settings.resolved_llm_max_tokens == 1234


def test_llm_max_tokens_overrides_legacy_claude_max_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_MAX_TOKENS", "2222")
    monkeypatch.setenv("CLAUDE_MAX_TOKENS", "1234")
    settings = Settings(_env_file=None)

    assert settings.resolved_llm_max_tokens == 2222


@pytest.mark.asyncio
async def test_azure_provider_requires_endpoint_key_and_model() -> None:
    settings = Settings(
        llm_provider="azure_openai",
        llm_model="",
        azure_openai_endpoint="",
        azure_openai_api_key="",
    )
    client = LLMClient(settings=settings)

    with pytest.raises(
        LLMConfigError,
        match="LLM_MODEL, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY",
    ):
        await client.generate_structured(
            prompt="Generate a writing prompt.",
            output_type=GeneratedWritingPrompt,
        )


def test_azure_provider_uses_provider_qualified_model_label() -> None:
    settings = Settings(
        llm_provider="azure_openai",
        llm_model="gpt-4.1-mini",
        azure_openai_endpoint="https://example.openai.azure.com/openai/v1/",
        azure_openai_api_key="test",
    )
    client = LLMClient(settings=settings)

    assert settings.resolved_llm_model == "gpt-4.1-mini"
    assert client.model == "azure_openai:gpt-4.1-mini"


@pytest.mark.asyncio
async def test_generate_structured_uses_pydantic_ai_test_model_without_network() -> None:
    test_model = TestModel(custom_output_args=WRITING_PROMPT_RESPONSE)
    client = LLMClient(
        settings=Settings(anthropic_api_key="test"),
        model_override=test_model,
        model_label="test:structured",
    )

    output, metadata = await client.generate_structured(
        prompt="Generate a writing prompt.",
        output_type=GeneratedWritingPrompt,
    )

    assert output.title == WRITING_PROMPT_RESPONSE["title"]
    assert metadata.latency_ms >= 0
    assert metadata.usage.requests >= 0
    assert client.model == "test:structured"
    assert test_model.last_model_request_parameters is not None
    assert test_model.last_model_request_parameters.output_tools
