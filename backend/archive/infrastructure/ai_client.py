"""
===============================================================================
Score Package Compiler — Claude API Client Wrapper
===============================================================================
Domain: Archive / Ingestion
Description:
    Thin, opinionated wrapper around the Anthropic Python SDK for the Score
    Package Compiler. Responsibilities, in order of importance:

      1. **Structured output** — every call returns a validated Pydantic
         instance via `client.messages.parse(output_format=...)`. Bad JSON
         is the SDK's problem, not ours.
      2. **Cost tracking** — every call returns a `CallCost` with USD and
         cents, attributing cache reads at 0.1× input. Persisted to
         `ScoreEdition.ingestion_cost_cents`.
      3. **Cost ceiling** — `enforce_ceiling()` raises `CostCeilingExceeded`
         before a runaway loop drains the API account.
      4. **Prompt caching** — system prompt always carries
         `cache_control: ephemeral`. After the first call in a run, cache
         reads should dominate. Audit via `usage.cache_read_input_tokens`.
      5. **Provenance** — every call emits the prompt version + model id, so
         the caller can stamp `ProvenanceRecord` rows with full attribution.

    Adheres to the Anthropic 2026 defaults: adaptive thinking, no sampling
    parameters, Claude 4.7 / 4.6 / 4.5-haiku as the supported model tier.

Standards: SaaS 2026, Anthropic SDK best practices, provenance-aware.
===============================================================================
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from decimal import Decimal, ROUND_UP
from typing import Final, Type, TypeVar

import anthropic
from django.conf import settings
from pydantic import BaseModel

from archive.dtos import CallCost
from archive.infrastructure.prompts import Prompt

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------
# We tier model choice to task complexity. The ingestion pipeline picks one
# of these constants per task; downstream code never hard-codes the strings.

class AIModel:
    """Canonical model IDs (Claude API, May 2026). Never construct your own."""
    HAIKU: Final[str] = "claude-haiku-4-5"      # cheap classification, dedup, simple extraction
    SONNET: Final[str] = "claude-sonnet-4-6"    # enrichment, translations, program notes
    OPUS: Final[str] = "claude-opus-4-7"        # hardest reasoning / multi-step decisions


# ---------------------------------------------------------------------------
# Pricing table (USD per 1M tokens, May 2026)
# Source: https://platform.claude.com/docs/en/pricing
# Update if Anthropic publishes new prices. Cents are rounded UP to never
# under-report cost in the audit log.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _ModelPricing:
    input_per_1m: Decimal
    output_per_1m: Decimal
    cache_write_5m_per_1m: Decimal   # 1.25× input
    cache_read_per_1m: Decimal       # 0.1× input


_PRICING: Final[dict[str, _ModelPricing]] = {
    AIModel.OPUS: _ModelPricing(
        input_per_1m=Decimal("5.00"),
        output_per_1m=Decimal("25.00"),
        cache_write_5m_per_1m=Decimal("6.25"),
        cache_read_per_1m=Decimal("0.50"),
    ),
    AIModel.SONNET: _ModelPricing(
        input_per_1m=Decimal("3.00"),
        output_per_1m=Decimal("15.00"),
        cache_write_5m_per_1m=Decimal("3.75"),
        cache_read_per_1m=Decimal("0.30"),
    ),
    AIModel.HAIKU: _ModelPricing(
        input_per_1m=Decimal("1.00"),
        output_per_1m=Decimal("5.00"),
        cache_write_5m_per_1m=Decimal("1.25"),
        cache_read_per_1m=Decimal("0.10"),
    ),
}


# Models that reject `output_config.effort` (Anthropic returns 400 with
# "This model does not support the effort parameter"). Haiku 4.5 in particular
# has no adaptive-effort dial — it always runs at a single tier. We silently
# omit the field for these models instead of forcing every caller to know.
_MODELS_WITHOUT_EFFORT: Final[frozenset[str]] = frozenset({AIModel.HAIKU})


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class CostCeilingExceeded(Exception):
    """
    Raised before a call when proceeding would push the entity's cumulative
    cost past the configured ceiling. Calling task should mark the entity
    FAILED with this message and stop the chain.
    """

    def __init__(self, entity_id: str, spent_cents: int, ceiling_cents: int) -> None:
        self.entity_id = entity_id
        self.spent_cents = spent_cents
        self.ceiling_cents = ceiling_cents
        super().__init__(
            f"Cost ceiling exceeded for {entity_id}: "
            f"spent {spent_cents}¢ + this call would exceed {ceiling_cents}¢ ceiling."
        )


class AIClientError(Exception):
    """
    Wraps SDK errors that the caller should treat as terminal (not retryable).
    Carries the `CallCost` of the failed attempt when the API call DID reach
    Anthropic — so callers bill the entity even when output was unparseable
    (Anthropic still charges for input + truncated output tokens).
    """

    def __init__(self, message: str, *, cost: 'CallCost | None' = None) -> None:
        super().__init__(message)
        self.cost = cost


class AIClientPermanentError(AIClientError):
    """
    Subclass for 4xx-class failures (BadRequestError, AuthenticationError,
    PermissionError) — Anthropic rejected the request as invalid. Retrying
    will produce the same 400; the Celery task should abort the chain and
    mark the entity FAILED instead of burning autoretry cycles.

    400s do NOT bill (the request is rejected before processing), so `cost`
    is always None on instances of this subclass.
    """


# ---------------------------------------------------------------------------
# Cost arithmetic helpers
# ---------------------------------------------------------------------------

def _compute_cost(
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation_input_tokens: int,
    cache_read_input_tokens: int,
) -> CallCost:
    """Compute total USD + cents from the SDK's usage object."""
    price = _PRICING.get(model)
    if price is None:
        raise AIClientError(f"Unknown model for pricing: {model!r}")

    per_1m = Decimal("1000000")
    total_usd = (
        (Decimal(input_tokens) * price.input_per_1m / per_1m)
        + (Decimal(output_tokens) * price.output_per_1m / per_1m)
        + (Decimal(cache_creation_input_tokens) * price.cache_write_5m_per_1m / per_1m)
        + (Decimal(cache_read_input_tokens) * price.cache_read_per_1m / per_1m)
    )
    total_cents = int((total_usd * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_UP))

    return CallCost(
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_input_tokens=cache_creation_input_tokens,
        cache_read_input_tokens=cache_read_input_tokens,
        total_usd=total_usd,
        total_cents=total_cents,
    )


# ---------------------------------------------------------------------------
# The client
# ---------------------------------------------------------------------------

class AIClient:
    """
    Opinionated Claude wrapper for the Score Package Compiler.

    Caller pattern:
        client = AIClient()
        result, cost = client.parse(
            model=AIModel.SONNET,
            prompt=EXTRACT_WORK_IDENTITY,
            user_content="...first 2 pages of the PDF as text...",
            output_schema=ExtractedWorkIdentity,
            max_tokens=2048,
        )
    """

    DEFAULT_MAX_TOKENS: Final[int] = 4096
    DEFAULT_EFFORT: Final[str] = "high"

    def __init__(self, *, api_key: str | None = None) -> None:
        key = api_key or getattr(settings, 'ANTHROPIC_API_KEY', None)
        if not key:
            raise AIClientError(
                "ANTHROPIC_API_KEY is not configured. "
                "Set it in the environment or in Django settings."
            )
        self._client = anthropic.Anthropic(api_key=key)

    # -- public --------------------------------------------------------------

    @staticmethod
    def enforce_ceiling(
        *,
        entity_id: str,
        spent_cents: int,
        ceiling_cents: int,
    ) -> None:
        """
        Raise `CostCeilingExceeded` if the entity has already exhausted its
        budget. Call this at the top of every Celery task in the ingestion
        chain.
        """
        if spent_cents >= ceiling_cents:
            raise CostCeilingExceeded(
                entity_id=entity_id,
                spent_cents=spent_cents,
                ceiling_cents=ceiling_cents,
            )

    def parse(
        self,
        *,
        model: str,
        prompt: Prompt,
        user_content: str | list[dict],
        output_schema: Type[T],
        max_tokens: int = DEFAULT_MAX_TOKENS,
        effort: str = DEFAULT_EFFORT,
        enable_thinking: bool = True,
    ) -> tuple[T, CallCost]:
        """
        Run one structured-output call. Returns the parsed Pydantic instance
        plus a `CallCost` populated from `response.usage`.

        Defaults align with the Claude 4.7 / 4.6 / 4.5 family:
          - `thinking: {type: "adaptive"}` (only valid form on 4.7)
          - `output_config.effort` controls overall reasoning depth
          - System prompt is cached for the run

        Raises `AIClientError` on any unrecoverable SDK error.
        """
        params: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "system": [
                {
                    "type": "text",
                    "text": prompt.system,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [
                {"role": "user", "content": user_content},
            ],
            "output_format": output_schema,
        }
        # Haiku 4.5 returns 400 for `output_config.effort` ("This model does
        # not support the effort parameter"); only set the dial on models
        # that honour it.
        if model not in _MODELS_WITHOUT_EFFORT:
            params["output_config"] = {"effort": effort}
        if enable_thinking:
            params["thinking"] = {"type": "adaptive"}

        t0 = time.monotonic()
        try:
            response = self._client.messages.parse(**params)
        except anthropic.BadRequestError as exc:
            # 400 is a code bug (bad params, malformed schema, model mismatch).
            # Surface as AIClientPermanentError so the Celery guard short-
            # circuits the chain instead of autoretrying the same broken call.
            raise AIClientPermanentError(
                f"Claude rejected request: {exc.message}"
            ) from exc
        except anthropic.AuthenticationError as exc:
            raise AIClientPermanentError(
                "Claude API key is invalid."
            ) from exc
        except anthropic.PermissionDeniedError as exc:
            raise AIClientPermanentError(
                f"Claude denied access: {exc.message}"
            ) from exc
        except anthropic.APIStatusError:
            # Rate limit / overloaded / 5xx — transient, Celery autoretry
            # is correct here.
            raise

        elapsed = time.monotonic() - t0

        # Compute cost BEFORE checking parsed_output — Anthropic bills for the
        # call whether or not it produced parseable output. We must bill the
        # entity either way, otherwise the hard cap silently leaks.
        usage = response.usage
        cost = _compute_cost(
            model=model,
            input_tokens=usage.input_tokens or 0,
            output_tokens=usage.output_tokens or 0,
            cache_creation_input_tokens=getattr(usage, 'cache_creation_input_tokens', 0) or 0,
            cache_read_input_tokens=getattr(usage, 'cache_read_input_tokens', 0) or 0,
        )

        logger.info(
            "ai.parse model=%s prompt=%s elapsed=%.2fs "
            "in=%d out=%d cache_w=%d cache_r=%d cost=%d¢ stop=%s",
            model,
            prompt.version,
            elapsed,
            cost.input_tokens,
            cost.output_tokens,
            cost.cache_creation_input_tokens,
            cost.cache_read_input_tokens,
            cost.total_cents,
            response.stop_reason,
        )

        parsed: T | None = response.parsed_output
        if parsed is None:
            # Most commonly: stop_reason='max_tokens' — Claude ran out of budget
            # mid-output, often because adaptive thinking consumed it. Caller
            # should bump max_tokens on the prompt rather than blindly retrying.
            raise AIClientError(
                f"Claude returned no parseable output "
                f"(stop_reason={response.stop_reason!r}). "
                f"If stop_reason is 'max_tokens', increase max_tokens.",
                cost=cost,
            )

        return parsed, cost
