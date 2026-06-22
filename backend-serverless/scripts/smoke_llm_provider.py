"""Smoke test the configured real LLM provider with one structured request."""

from __future__ import annotations

import asyncio
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api.v1.schemas.content import GeneratedWritingPrompt  # noqa: E402
from app.config import Settings  # noqa: E402
from app.llm.client import LLMClient, LLMConfigError, render_prompt  # noqa: E402

OutputT = TypeVar("OutputT", bound=BaseModel)


class StructuredLLMClient(Protocol):
    @property
    def model(self) -> str: ...

    async def generate_structured(
        self,
        *,
        prompt: str,
        output_type: type[OutputT],
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[OutputT, object]: ...


@dataclass(frozen=True)
class SmokeResult:
    provider: str
    model: str
    latency_ms: int
    output: GeneratedWritingPrompt


def missing_required_env(settings: Settings) -> list[str]:
    """Return required env keys missing for the selected provider."""
    if settings.llm_provider == "anthropic":
        return ["ANTHROPIC_API_KEY"] if not settings.anthropic_api_key else []

    if settings.llm_provider == "azure_openai":
        return [
            name
            for name, value in (
                ("LLM_MODEL", settings.llm_model),
                ("AZURE_OPENAI_ENDPOINT", settings.azure_openai_endpoint),
                ("AZURE_OPENAI_API_KEY", settings.azure_openai_api_key),
            )
            if not value
        ]

    return ["LLM_PROVIDER"]


def ensure_required_env(settings: Settings) -> None:
    missing = missing_required_env(settings)
    if missing:
        joined = ", ".join(missing)
        msg = f"LLM smoke test missing required configuration: {joined}"
        raise LLMConfigError(msg)


def build_smoke_prompt() -> str:
    return render_prompt(
        "writing_prompt",
        school_grade_level=5,
        content_grade_level=4,
        content_level_label="Grade 4",
        interest_label="travel",
        min_words=30,
        max_words=80,
    )


def validate_smoke_output(output: GeneratedWritingPrompt) -> None:
    if not output.title.strip():
        msg = "LLM smoke response did not include a title"
        raise ValueError(msg)
    if not output.prompt.strip():
        msg = "LLM smoke response did not include a prompt"
        raise ValueError(msg)
    if output.min_words >= output.max_words:
        msg = "LLM smoke response word bounds must be increasing"
        raise ValueError(msg)


def extract_latency_ms(run_info: object) -> int:
    latency = getattr(run_info, "latency_ms", run_info)
    if isinstance(latency, int):
        return latency
    return int(latency)


def smoke_description(settings: Settings) -> str:
    model = settings.resolved_llm_model or "<unset>"
    return (
        f"provider={settings.llm_provider} "
        f"model={settings.llm_provider}:{model} "
        f"max_tokens={settings.resolved_llm_max_tokens}"
    )


def redact_secrets(message: str, settings: Settings | None) -> str:
    if settings is None:
        return message

    redacted = message
    for secret in (settings.anthropic_api_key, settings.azure_openai_api_key):
        if len(secret) >= 4:
            redacted = redacted.replace(secret, "***")
    return redacted


def exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        chain.append(current)
        seen.add(id(current))
        current = current.__cause__
        if current is None and not chain[-1].__suppress_context__:
            current = chain[-1].__context__
    return chain


def format_exception_chain(exc: BaseException, settings: Settings | None) -> str:
    parts: list[str] = []
    for item in exception_chain(exc):
        message = redact_secrets(str(item), settings)
        if message:
            parts.append(f"{type(item).__name__}: {message}")
        else:
            parts.append(type(item).__name__)
    return " <- ".join(parts)


async def run_smoke(
    *,
    settings: Settings | None = None,
    client: StructuredLLMClient | None = None,
) -> SmokeResult:
    resolved_settings = settings or Settings()
    ensure_required_env(resolved_settings)

    llm_client = client or LLMClient(settings=resolved_settings)
    output, run_info = await llm_client.generate_structured(
        prompt=build_smoke_prompt(),
        output_type=GeneratedWritingPrompt,
        max_retries=1,
    )
    validate_smoke_output(output)

    return SmokeResult(
        provider=resolved_settings.llm_provider,
        model=llm_client.model,
        latency_ms=extract_latency_ms(run_info),
        output=output,
    )


def main() -> None:
    started = time.perf_counter()
    settings: Settings | None = None
    try:
        settings = Settings()
        print(f"LLM smoke starting {smoke_description(settings)}")
        result = asyncio.run(run_smoke(settings=settings))
    except (LLMConfigError, ValidationError, ValueError) as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        details = format_exception_chain(exc, settings)
        raise SystemExit(f"LLM smoke failed elapsed_ms={elapsed_ms}: {details}") from exc
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        details = format_exception_chain(exc, settings)
        raise SystemExit(
            f"LLM smoke request failed elapsed_ms={elapsed_ms}: {details}"
        ) from exc

    print(
        "LLM smoke succeeded "
        f"provider={result.provider} model={result.model} latency_ms={result.latency_ms}"
    )


if __name__ == "__main__":
    main()
