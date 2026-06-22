"""Unit coverage for LLM usage pricing."""

from __future__ import annotations

from decimal import Decimal

from app.config import LLMTokenPrice, Settings
from app.llm.client import LLMUsage
from app.services.llm_usage_service import calculate_cost_usd


def test_calculate_cost_usd_uses_configured_model_rates() -> None:
    cost, status = calculate_cost_usd(
        "test:model",
        LLMUsage(
            input_tokens=1000,
            output_tokens=500,
            cache_write_tokens=250,
            cache_read_tokens=125,
        ),
        settings=Settings(
            llm_token_pricing={
                "test:model": LLMTokenPrice(
                    input_per_million=2.0,
                    output_per_million=8.0,
                    cache_write_per_million=3.0,
                    cache_read_per_million=1.0,
                )
            }
        ),
    )

    assert cost == Decimal("0.006875")
    assert status == "configured"


def test_calculate_cost_usd_marks_missing_rates_unknown() -> None:
    cost, status = calculate_cost_usd(
        "test:missing",
        LLMUsage(input_tokens=1000, output_tokens=500),
        settings=Settings(llm_token_pricing={}),
    )

    assert cost is None
    assert status == "unknown"
