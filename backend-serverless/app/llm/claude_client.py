"""Async wrapper around Anthropic's Claude SDK.

Renders Jinja templates from ``app/llm/prompts/`` and asks Claude to reply
with strict JSON. On parse failure, retries once.
"""

from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.config import get_settings

LOGGER = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent / "prompts"
_jinja = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=select_autoescape(),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

_JSON_FENCE = re.compile(r"```(?:json)?\s*(?P<body>\{.*\})\s*```", re.DOTALL)


def render_prompt(name: str, **context: Any) -> str:
    template = _jinja.get_template(f"{name}.j2")
    return template.render(**context)


def _extract_json(raw: str) -> dict[str, Any]:
    """Tolerate stray markdown fences in case the model adds them."""
    text = raw.strip()
    fence_match = _JSON_FENCE.search(text)
    if fence_match:
        text = fence_match.group("body")
    return json.loads(text)


class ClaudeClient:
    """Generates JSON content via Anthropic's messages API."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> None:
        settings = get_settings()
        self._model = model or settings.claude_model
        self._max_tokens = max_tokens or settings.claude_max_tokens
        self._client = AsyncAnthropic(api_key=api_key or settings.anthropic_api_key or None)

    @property
    def model(self) -> str:
        return self._model

    async def generate_json(
        self,
        *,
        prompt: str,
        system: str | None = None,
        max_retries: int = 1,
    ) -> tuple[dict[str, Any], int]:
        """Send `prompt` to Claude and return (parsed_json, latency_ms)."""
        attempt = 0
        last_exc: Exception | None = None
        started = time.perf_counter()
        while attempt <= max_retries:
            attempt += 1
            try:
                response = await self._client.messages.create(
                    model=self._model,
                    max_tokens=self._max_tokens,
                    system=system or "Reply with only a single valid JSON object. No prose.",
                    messages=[{"role": "user", "content": prompt}],
                )
                text_parts = [
                    block.text  # type: ignore[attr-defined]
                    for block in response.content
                    if getattr(block, "type", None) == "text"
                ]
                raw = "".join(text_parts)
                parsed = _extract_json(raw)
                latency_ms = int((time.perf_counter() - started) * 1000)
                return parsed, latency_ms
            except json.JSONDecodeError as exc:
                LOGGER.warning("Claude returned non-JSON response (attempt %s): %s", attempt, exc)
                last_exc = exc
            except Exception:
                LOGGER.exception("Claude API call failed on attempt %s", attempt)
                raise
        msg = "Claude failed to produce valid JSON"
        raise RuntimeError(msg) from last_exc


_singleton: ClaudeClient | None = None


def get_claude_client() -> ClaudeClient:
    """Return a process-wide ClaudeClient. Tests monkey-patch this."""
    global _singleton
    if _singleton is None:
        _singleton = ClaudeClient()
    return _singleton


def set_claude_client(client: ClaudeClient | None) -> None:
    """Override the singleton (used by tests)."""
    global _singleton
    _singleton = client
