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
         cents, attributing cache reads at 0.1x input. Persisted to
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

import base64
import json
import logging
import time
from dataclasses import dataclass
from decimal import ROUND_UP, Decimal
from typing import Any, Final, TypeVar

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
    cache_write_5m_per_1m: Decimal   # 1.25x input
    cache_read_per_1m: Decimal       # 0.1x input


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


# Hard upper bound on `max_tokens` per model when we auto-escalate after a
# `stop_reason='max_tokens'` truncation. `max_tokens` is shared by thinking AND
# output tokens, so a big translation with adaptive thinking can overshoot a
# modest budget; we double and retry up to this ceiling before giving up.
# Values track each model's documented max output cap (Sonnet/Haiku 64K).
# Haiku tasks are pure extraction — a truncation there means something is odd,
# so its ceiling stays low to avoid runaway spend.
_MODEL_OUTPUT_CEILING: Final[dict[str, int]] = {
    AIModel.HAIKU: 16384,
    AIModel.SONNET: 65536,
    AIModel.OPUS: 65536,
}

# How many times we double `max_tokens` after a truncation before declaring the
# call terminally truncated (each attempt is billed by Anthropic).
MAX_TOKEN_ESCALATIONS: Final[int] = 2

# Default per-request timeout (seconds). Generous because ingestion runs in a
# Celery worker, not a web request — a multi-minute structured-output call is
# fine. Setting it explicitly also suppresses the SDK's non-streaming guard,
# which otherwise refuses large-`max_tokens` requests it estimates may exceed
# ~10 minutes (relevant once we escalate the lyrics budget toward 64K).
DEFAULT_REQUEST_TIMEOUT_SECONDS: Final[float] = 600.0

# SDK-level retry budget for transient errors (429/5xx/overloaded/connection).
# The SDK backs off exponentially and honours `retry-after`. This is the first
# tier; archive.tasks adds a much more patient Celery-level tier on exhaustion.
DEFAULT_MAX_RETRIES: Final[int] = 4


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

    def __init__(self, message: str, *, cost: CallCost | None = None) -> None:
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


class AIClientTruncatedError(AIClientError):
    """
    Raised when Claude could not return parseable output *even after escalating
    `max_tokens`* — almost always `stop_reason='max_tokens'`: the combined
    thinking + structured output exceeded the largest budget we will spend on
    one call.

    This is **terminal, not retryable**: a fixed budget truncates
    deterministically, so re-issuing the identical call (Celery autoretry) just
    burns the same money for the same failure. The guard bills the accumulated
    cost of every attempt and marks the entity FAILED with a clear reason.
    `cost` carries the *sum* across all escalation attempts.
    """


class AIClientOverloadedError(AIClientError):
    """
    Transient capacity failure: Anthropic returned 529 `overloaded_error`, a
    5xx, a rate limit (429), or the connection timed out — *after* the SDK
    exhausted its own internal retries. These are NOT billed (the request never
    produced output), so `cost` is always None.

    Unlike every other `AIClientError`, this one is **retryable** — the caller
    should wait patiently (tens of seconds to minutes) and try again rather than
    failing the edition. The pipeline surfaces a "service overloaded, retrying"
    state to the conductor while it waits.
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


def _sum_costs(costs: list[CallCost]) -> CallCost:
    """Combine the per-attempt costs of an escalating call into one `CallCost`.

    Anthropic bills every attempt (input + truncated output), so the entity must
    be charged for the sum, not just the final try. `CallCost` is frozen, so we
    build a fresh aggregate rather than mutate.
    """
    if len(costs) == 1:
        return costs[0]
    return CallCost(
        model=costs[-1].model,
        input_tokens=sum(c.input_tokens for c in costs),
        output_tokens=sum(c.output_tokens for c in costs),
        cache_creation_input_tokens=sum(c.cache_creation_input_tokens for c in costs),
        cache_read_input_tokens=sum(c.cache_read_input_tokens for c in costs),
        total_usd=sum((c.total_usd for c in costs), Decimal("0")),
        total_cents=sum(c.total_cents for c in costs),
    )


# ---------------------------------------------------------------------------
# The client
# ---------------------------------------------------------------------------

class AIClient:
    """
    Opinionated Claude wrapper for the Score Package Compiler.

    Caller pattern (native-PDF vision):
        client = AIClient()
        result, cost = client.parse(
            model=AIModel.SONNET,
            prompt=ANALYZE_SCORE,
            user_content="Translate the sung text into: en, pl.",
            output_schema=ScoreAnalysisResult,
            max_tokens=32768,
            pdf_bytes=raw_pdf_bytes,   # Claude reads the whole document by vision
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
        timeout = getattr(
            settings, 'ANTHROPIC_REQUEST_TIMEOUT_SECONDS',
            DEFAULT_REQUEST_TIMEOUT_SECONDS,
        )
        # The SDK does the *first* line of overload/5xx/429 defence itself, with
        # exponential backoff that honours `retry-after`. We give it a healthy
        # budget; the Celery layer adds a second, far more patient tier on top
        # (minutes) for sustained outages — see archive.tasks `_guarded`.
        max_retries = getattr(settings, 'ANTHROPIC_MAX_RETRIES', DEFAULT_MAX_RETRIES)
        self._client = anthropic.Anthropic(
            api_key=key, timeout=timeout, max_retries=max_retries,
        )

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
        output_schema: type[T],
        max_tokens: int = DEFAULT_MAX_TOKENS,
        effort: str = DEFAULT_EFFORT,
        enable_thinking: bool = True,
        pdf_bytes: bytes | None = None,
        structured: bool = True,
    ) -> tuple[T, CallCost]:
        """
        Run one structured-output call. Returns the parsed Pydantic instance
        plus a `CallCost` populated from `response.usage`.

        Defaults align with the Claude 4.7 / 4.6 / 4.5 family:
          - `thinking: {type: "adaptive"}` (only valid form on 4.7)
          - `output_config.effort` controls overall reasoning depth
          - System prompt is cached for the run

        When `pdf_bytes` is given, the raw PDF is sent as a native `document`
        block (Claude reads every page visually — text layer AND scanned
        images), cached so escalation retries read it back cheaply. This is how
        the v2 pipeline analyses a score: the real document, not pypdf text.

        `structured=True` (default) uses the SDK's strict structured outputs
        (`output_format`). Set `structured=False` when the schema is too large
        for that validator (Anthropic returns 400 "Schema is too complex" — the
        consolidated score analysis hits this): we then steer the shape via the
        prompt and parse the JSON ourselves. Claude 4.x follows an explicit
        schema-in-prompt reliably, and there is no complexity limit.

        Raises `AIClientError` on any unrecoverable SDK error, or
        `AIClientOverloadedError` (retryable) on a transient capacity failure.
        """
        # Without `output_format`, append the JSON Schema to the prompt so the
        # model knows the exact shape to emit.
        json_directive = ""
        if not structured:
            json_directive = (
                "\n\nRespond with ONLY a single JSON object — no prose, no "
                "explanation, no markdown code fences — conforming exactly to "
                "this JSON Schema:\n"
                + json.dumps(output_schema.model_json_schema())
            )

        if pdf_bytes is not None:
            content_blocks: list[dict] = [{
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": base64.standard_b64encode(pdf_bytes).decode("ascii"),
                },
                "cache_control": {"type": "ephemeral"},
            }]
            if isinstance(user_content, str):
                content_blocks.append({"type": "text", "text": user_content + json_directive})
            else:
                content_blocks.extend(user_content)
                if json_directive:
                    content_blocks.append({"type": "text", "text": json_directive})
            message_content: str | list[dict] = content_blocks
        elif isinstance(user_content, str):
            message_content = user_content + json_directive
        else:
            message_content = user_content

        base_params: dict = {
            "model": model,
            "system": [
                {
                    "type": "text",
                    "text": prompt.system,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [
                {"role": "user", "content": message_content},
            ],
        }
        if structured:
            base_params["output_format"] = output_schema
        # Haiku 4.5 returns 400 for `output_config.effort` ("This model does
        # not support the effort parameter"); only set the dial on models
        # that honour it.
        if model not in _MODELS_WITHOUT_EFFORT:
            base_params["output_config"] = {"effort": effort}
        if enable_thinking:
            base_params["thinking"] = {"type": "adaptive"}

        # `max_tokens` is shared between thinking and output. If a generous
        # initial budget still truncates (stop_reason='max_tokens'), doubling
        # and retrying is the *correct* response — blindly re-issuing the same
        # call (which is what Celery autoretry would do) truncates identically
        # and re-bills. We escalate here, bill the sum of every attempt, and
        # only give up at the per-model ceiling.
        ceiling = max(_MODEL_OUTPUT_CEILING.get(model, max_tokens), max_tokens)
        budget = max_tokens
        costs: list[CallCost] = []
        last_stop_reason: str | None = None
        # `.parse()` and `.create()` return different SDK types; `parsed_output`
        # only exists on the former. Keep the handler dynamic so reading it in
        # the structured branch doesn't trip the union.
        response: Any = None

        for attempt in range(MAX_TOKEN_ESCALATIONS + 1):
            params = {**base_params, "max_tokens": budget}

            t0 = time.monotonic()
            try:
                if structured:
                    response = self._client.messages.parse(**params)
                else:
                    response = self._client.messages.create(**params)
            except anthropic.BadRequestError as exc:
                # 400 is a code bug (bad params, malformed schema, model
                # mismatch). Surface as AIClientPermanentError so the Celery
                # guard short-circuits instead of autoretrying a broken call.
                raise AIClientPermanentError(
                    f"Claude rejected request: {exc.message}"
                ) from exc
            except anthropic.AuthenticationError as exc:
                raise AIClientPermanentError("Claude API key is invalid.") from exc
            except anthropic.PermissionDeniedError as exc:
                raise AIClientPermanentError(
                    f"Claude denied access: {exc.message}"
                ) from exc
            except (
                anthropic.RateLimitError,
                anthropic.InternalServerError,
                anthropic.APITimeoutError,
                anthropic.APIConnectionError,
            ) as exc:
                # 429 / 5xx / 529 overloaded / connection-timeout, AFTER the SDK
                # exhausted its own retries. Not billed. Surface as overloaded so
                # the task waits patiently (minutes) instead of failing the
                # edition — the cause of the 529 retry-storm in production.
                raise AIClientOverloadedError(
                    f"Claude temporarily unavailable: {exc.__class__.__name__}"
                ) from exc
            except anthropic.APIStatusError as exc:
                # Any other non-2xx: >=500 is transient overload, <500 is a
                # permanent client error.
                if exc.status_code >= 500:
                    raise AIClientOverloadedError(
                        f"Claude server error {exc.status_code}."
                    ) from exc
                raise AIClientPermanentError(
                    f"Claude rejected request ({exc.status_code}): "
                    f"{getattr(exc, 'message', exc)}"
                ) from exc

            elapsed = time.monotonic() - t0

            # Compute cost BEFORE checking parsed_output — Anthropic bills for
            # the call whether or not it produced parseable output. We must bill
            # the entity either way, otherwise the hard cap silently leaks.
            usage = response.usage
            cost = _compute_cost(
                model=model,
                input_tokens=usage.input_tokens or 0,
                output_tokens=usage.output_tokens or 0,
                cache_creation_input_tokens=getattr(usage, 'cache_creation_input_tokens', 0) or 0,
                cache_read_input_tokens=getattr(usage, 'cache_read_input_tokens', 0) or 0,
            )
            costs.append(cost)
            last_stop_reason = response.stop_reason

            logger.info(
                "ai.parse model=%s prompt=%s attempt=%d max_tokens=%d elapsed=%.2fs "
                "in=%d out=%d cache_w=%d cache_r=%d cost=%d¢ stop=%s",
                model, prompt.version, attempt + 1, budget, elapsed,
                cost.input_tokens, cost.output_tokens,
                cost.cache_creation_input_tokens, cost.cache_read_input_tokens,
                cost.total_cents, response.stop_reason,
            )

            parsed: T | None = (
                response.parsed_output if structured
                else self._coerce_json(response, output_schema)
            )
            if parsed is not None:
                return parsed, _sum_costs(costs)

            # No parseable output. Only a `max_tokens` truncation is worth
            # retrying with a *bigger* budget; anything else won't improve by
            # re-issuing an identical call, so stop the escalation here.
            if response.stop_reason != 'max_tokens' or budget >= ceiling:
                break

            new_budget = min(budget * 2, ceiling)
            logger.warning(
                "ai.parse truncated model=%s prompt=%s — escalating max_tokens %d→%d",
                model, prompt.version, budget, new_budget,
            )
            budget = new_budget

        total = _sum_costs(costs)
        if last_stop_reason == 'max_tokens':
            # Genuinely too long for the budget. Terminal (a bigger budget was
            # already tried) — bill the attempts and let the guard mark FAILED.
            raise AIClientTruncatedError(
                f"Claude returned no parseable output after {len(costs)} attempt(s) "
                f"(stop_reason='max_tokens', max_tokens up to {budget}). "
                f"The score may be longer than a single call can handle.",
                cost=total,
            )
        # Any other no-parse (e.g. malformed JSON in the unstructured path) is
        # worth a fresh attempt — surface a retryable error, not a terminal one.
        raise AIClientError(
            f"Claude returned no parseable output after {len(costs)} attempt(s) "
            f"(stop_reason={last_stop_reason!r}).",
            cost=total,
        )

    @staticmethod
    def _coerce_json(response: Any, output_schema: type[T]) -> T | None:
        """Extract and validate a JSON object from an unstructured response.
        Tolerates markdown fences / surrounding prose. Returns None if nothing
        parses, so the caller retries."""
        text = "".join(
            getattr(block, "text", "") for block in response.content
            if getattr(block, "type", None) == "text"
        ).strip()
        if not text:
            return None
        if text.startswith("```"):
            newline = text.find("\n")
            text = text[newline + 1:] if newline != -1 else text[3:]
            if text.rstrip().endswith("```"):
                text = text.rstrip()[:-3]
            text = text.strip()
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start:end + 1]
        try:
            return output_schema.model_validate_json(text)
        except Exception:
            return None
