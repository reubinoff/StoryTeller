"""LLM token usage recording and pricing helpers."""

from __future__ import annotations

import uuid
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.models.llm_usage import LLMUsageEvent
from app.llm.client import LLMRunMetadata, LLMUsage

PRICING_CONFIGURED = "configured"
PRICING_UNKNOWN = "unknown"
_MILLION = Decimal("1000000")
_CENTS_PRECISION = Decimal("0.000001")


def split_model_label(model_label: str) -> tuple[str, str]:
    provider, sep, model = model_label.partition(":")
    if sep:
        return provider, model
    return "unknown", model_label


def calculate_cost_usd(
    model_label: str,
    usage: LLMUsage,
    *,
    settings: Settings | None = None,
) -> tuple[Decimal | None, str]:
    pricing = (settings or get_settings()).llm_token_pricing.get(model_label)
    if pricing is None:
        return None, PRICING_UNKNOWN

    priced_parts: list[tuple[int, float | None]] = [
        (usage.input_tokens, pricing.input_per_million),
        (usage.output_tokens, pricing.output_per_million),
        (usage.cache_write_tokens, pricing.cache_write_per_million),
        (usage.cache_read_tokens, pricing.cache_read_per_million),
    ]
    cost = Decimal("0")
    for tokens, rate in priced_parts:
        if tokens <= 0:
            continue
        if rate is None:
            return None, PRICING_UNKNOWN
        cost += Decimal(tokens) * Decimal(str(rate)) / _MILLION
    return cost.quantize(_CENTS_PRECISION, rounding=ROUND_HALF_UP), PRICING_CONFIGURED


async def record_llm_usage(
    db: AsyncSession,
    *,
    operation: str,
    model_label: str,
    metadata: LLMRunMetadata,
    user_id: uuid.UUID | None = None,
    task_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: uuid.UUID | None = None,
) -> LLMUsageEvent:
    provider, model = split_model_label(model_label)
    cost_usd, pricing_status = calculate_cost_usd(model_label, metadata.usage)
    event = LLMUsageEvent(
        operation=operation,
        provider=provider,
        model=model,
        user_id=user_id,
        task_id=task_id,
        resource_type=resource_type,
        resource_id=resource_id,
        input_tokens=metadata.usage.input_tokens,
        output_tokens=metadata.usage.output_tokens,
        cache_write_tokens=metadata.usage.cache_write_tokens,
        cache_read_tokens=metadata.usage.cache_read_tokens,
        requests=metadata.usage.requests,
        latency_ms=metadata.latency_ms,
        cost_usd=cost_usd,
        pricing_status=pricing_status,
    )
    db.add(event)
    await db.flush()
    return event
