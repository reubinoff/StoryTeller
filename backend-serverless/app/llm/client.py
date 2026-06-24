"""Provider-neutral LLM adapter built on Pydantic AI."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from pydantic import BaseModel
from pydantic_ai import Agent, ModelSettings
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.azure import AzureProvider
from pydantic_ai.usage import RunUsage

from app.config import Settings, contains_control_characters, get_settings

OutputT = TypeVar("OutputT", bound=BaseModel)

_PROMPTS_DIR = Path(__file__).parent / "prompts"
_jinja = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=select_autoescape(),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

_DEFAULT_INSTRUCTIONS = "Return only the structured output requested by the application."


class LLMConfigError(RuntimeError):
    """Raised when the selected LLM provider is missing required configuration."""


@dataclass(frozen=True)
class LLMUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    requests: int = 0

    @classmethod
    def from_run_usage(cls, usage: RunUsage) -> LLMUsage:
        return cls(
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_write_tokens=usage.cache_write_tokens,
            cache_read_tokens=usage.cache_read_tokens,
            requests=usage.requests,
        )

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens + self.cache_write_tokens + self.cache_read_tokens


@dataclass(frozen=True)
class LLMRunMetadata:
    latency_ms: int
    usage: LLMUsage


def render_prompt(name: str, **context: Any) -> str:
    template = _jinja.get_template(f"{name}.j2")
    return template.render(**context)


class LLMClient:
    """Generates typed content through the configured LLM provider."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        model_override: Any | None = None,
        model_label: str | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._model_override = model_override
        self._model = self._settings.resolved_llm_model
        self._model_label = model_label or f"{self._settings.llm_provider}:{self._model}"
        self._max_tokens = self._settings.resolved_llm_max_tokens

    @property
    def model(self) -> str:
        return self._model_label

    async def generate_structured(
        self,
        *,
        prompt: str,
        output_type: type[OutputT],
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[OutputT, LLMRunMetadata]:
        """Send `prompt` and return validated structured output plus latency."""
        agent = Agent(
            self._build_model(),
            instructions=system or _DEFAULT_INSTRUCTIONS,
            output_type=output_type,
            model_settings=ModelSettings(max_tokens=self._max_tokens),
            retries={"output": max_retries},
        )
        started = time.perf_counter()
        async with agent:
            result = await agent.run(prompt)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return result.output, LLMRunMetadata(
            latency_ms=latency_ms,
            usage=LLMUsage.from_run_usage(result.usage),
        )

    def _build_model(self) -> Any:
        if self._model_override is not None:
            return self._model_override
        if self._settings.llm_provider == "anthropic":
            return self._build_anthropic_model()
        if self._settings.llm_provider == "azure_openai":
            return self._build_azure_openai_model()
        msg = f"Unsupported LLM_PROVIDER: {self._settings.llm_provider}"
        raise LLMConfigError(msg)

    def _build_anthropic_model(self) -> AnthropicModel:
        self._ensure_header_safe_secret(
            "ANTHROPIC_API_KEY",
            self._settings.anthropic_api_key,
        )
        return AnthropicModel(
            self._model,
            provider=AnthropicProvider(api_key=self._settings.anthropic_api_key or None),
        )

    def _build_azure_openai_model(self) -> OpenAIChatModel:
        missing = [
            name
            for name, value in (
                ("LLM_MODEL", self._settings.llm_model),
                ("AZURE_OPENAI_ENDPOINT", self._settings.azure_openai_endpoint),
                ("AZURE_OPENAI_API_KEY", self._settings.azure_openai_api_key),
            )
            if not value
        ]
        if missing:
            joined = ", ".join(missing)
            msg = f"LLM_PROVIDER=azure_openai requires {joined}"
            raise LLMConfigError(msg)

        self._ensure_header_safe_secret(
            "AZURE_OPENAI_API_KEY",
            self._settings.azure_openai_api_key,
        )
        if self._settings.azure_openai_api_version:
            provider = AzureProvider(
                azure_endpoint=self._settings.azure_openai_endpoint,
                api_key=self._settings.azure_openai_api_key,
                api_version=self._settings.azure_openai_api_version,
            )
        else:
            provider = AzureProvider(
                azure_endpoint=self._settings.azure_openai_endpoint,
                api_key=self._settings.azure_openai_api_key,
            )
        return OpenAIChatModel(self._model, provider=provider)

    @staticmethod
    def _ensure_header_safe_secret(name: str, value: str) -> None:
        if contains_control_characters(value):
            msg = f"{name} must be a single-line value without embedded control characters"
            raise LLMConfigError(msg)


_singleton: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Return a process-wide LLM client. Tests monkey-patch this."""
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton


def set_llm_client(client: LLMClient | None) -> None:
    """Override the singleton used by service code."""
    global _singleton
    _singleton = client
