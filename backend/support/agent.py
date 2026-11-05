"""
===============================================================================
Support Agent — The Tool Loop
===============================================================================
Domain: Support
Description:
    Takes one feedback report and the code of its build, and returns what to say
    to the reporter and what to tell the developer. Nothing here sends anything:
    the caller decides where an outcome goes.

    Limits come in layers. Each run has a cap on tool rounds, on spend and on
    wall-clock time, checked between turns. Reaching one does not end the run: the
    next request forbids tools, so the model answers from what it has found and
    the run still yields something a person can read.

    A transient API failure ends the run with a status rather than an exception,
    so the caller can tell the plumbing from a bad answer. A rejected request or a
    bad key raises, because every later run would fail the same way.

Standards: SaaS 2026, Anthropic SDK manual tool loop.
===============================================================================
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Final, Literal, get_args

import anthropic
from pydantic import BaseModel, ConfigDict, ValidationError

from archive.infrastructure.ai_client import AIModel, cost_from_usage
from support.code_reader import CODE_TOOLS, CodeReader, CodeReaderError
from support.prompts import SUPPORT_AGENT

logger = logging.getLogger(__name__)

AgentAction = Literal['answer', 'answer_and_flag', 'flag_defect', 'no_reply']

# `ok` and `refusal` are answers the model gave. The rest never produced one, and
# an evaluation must not count them against it.
RunStatus = Literal['ok', 'refusal', 'truncated', 'unparseable', 'api_error', 'model_mismatch']

_WRAP_UP_NOTE: Final[str] = (
    "The research budget for this report is used up ({reason}). Give your final JSON object now, "
    "from what you have found. In the reply, say plainly what you could not establish."
)

_OUTCOME_FORMAT: Final[dict[str, Any]] = {
    'type': 'json_schema',
    'schema': {
        'type': 'object',
        'properties': {
            'reading': {'type': 'string'},
            'action': {'type': 'string', 'enum': list(get_args(AgentAction))},
            'reply': {'type': 'string'},
            'developer_note': {'type': 'string'},
        },
        'required': ['reading', 'action', 'reply', 'developer_note'],
        'additionalProperties': False,
    },
}


class AgentOutcome(BaseModel):
    """What the agent decided. Empty `reply` means silence towards the reporter."""
    model_config = ConfigDict(extra='forbid')

    reading: str
    action: AgentAction
    reply: str
    developer_note: str


@dataclass(frozen=True)
class NeighbourReport:
    """Another report from the same person, shown as context."""
    offset: str
    filed_as: str
    screen: str
    body: str


@dataclass(frozen=True)
class ReportInput:
    """One feedback report, carrying a role instead of the reporter's identity."""
    sent: str
    filed_as: str
    screen: str
    reporter_role: str
    body: str
    neighbours: tuple[NeighbourReport, ...] = ()


@dataclass(frozen=True)
class AgentConfig:
    model: str = AIModel.OPUS_5_5
    effort: str = 'high'
    max_tokens: int = 16000
    max_tool_rounds: int = 14
    deadline_seconds: float = 300.0
    max_cost_usd: Decimal = Decimal('1.50')


@dataclass
class TurnRecord:
    """One model call, with token counts as the API reported them."""
    served_model: str
    stop_reason: str | None
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int
    cost_usd: Decimal
    elapsed_seconds: float


@dataclass
class ToolCallRecord:
    name: str
    arguments: dict[str, Any]
    is_error: bool
    result_chars: int
    elapsed_seconds: float


@dataclass
class AgentRun:
    """Everything one run produced, including what it takes to trace a bad answer."""
    status: RunStatus = 'ok'
    outcome: AgentOutcome | None = None
    limit_hit: str | None = None
    error: str | None = None
    elapsed_seconds: float = 0.0
    turns: list[TurnRecord] = field(default_factory=list)
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    transcript: list[dict[str, Any]] = field(default_factory=list)

    @property
    def cost_usd(self) -> Decimal:
        return sum((turn.cost_usd for turn in self.turns), Decimal('0'))

    @property
    def tool_rounds(self) -> int:
        return sum(1 for turn in self.turns if turn.stop_reason == 'tool_use')


def render_report(report: ReportInput) -> str:
    """The user message: the primary report, then its neighbours as context."""
    parts = [
        '<primary_report>',
        f'sent: {report.sent}',
        f'filed_as: {report.filed_as}',
        f'screen: {report.screen}',
        f'reporter: {report.reporter_role}',
        'text:',
        report.body.strip(),
        '</primary_report>',
    ]
    for neighbour in report.neighbours:
        parts += [
            f'<neighbouring_report when="{neighbour.offset}" '
            f'filed_as="{neighbour.filed_as}" screen="{neighbour.screen}">',
            neighbour.body.strip(),
            '</neighbouring_report>',
        ]
    return '\n'.join(parts)


def run_support_agent(
    *,
    report: ReportInput,
    reader: CodeReader,
    client: anthropic.Anthropic,
    config: AgentConfig | None = None,
) -> AgentRun:
    """Run the tool loop for one report. Raises only on a request that can never succeed."""
    settings = config or AgentConfig()
    run = AgentRun()
    started = time.monotonic()
    user_message = render_report(report)
    messages: list[Any] = [{'role': 'user', 'content': user_message}]
    run.transcript.append({'role': 'user', 'content': user_message})
    params: dict[str, Any] = {
        'model': settings.model,
        'max_tokens': settings.max_tokens,
        'system': [{'type': 'text', 'text': SUPPORT_AGENT.system}],
        'tools': CODE_TOOLS,
        'thinking': {'type': 'adaptive'},
        'output_config': {'effort': settings.effort, 'format': _OUTCOME_FORMAT},
        # Moves to the newest block on every turn, so each one reads the last one's work back.
        'cache_control': {'type': 'ephemeral'},
    }
    while True:
        response = _request(client, params, messages, run)
        if response is None:
            break
        if response.model != settings.model:
            run.status = 'model_mismatch'
            run.error = f"Asked for {settings.model}, served by {response.model}"
            break
        if response.stop_reason == 'refusal':
            run.status = 'refusal'
            break
        if response.stop_reason == 'max_tokens':
            run.status = 'truncated'
            break
        run.transcript.append({'role': 'assistant', 'content': _loggable(response.content)})
        tool_uses = [block for block in response.content if block.type == 'tool_use']
        if not tool_uses:
            _finish(run, response)
            break
        results = _execute(tool_uses, reader, run)
        run.transcript.append({'role': 'user', 'content': results})
        messages.append({'role': 'assistant', 'content': response.content})
        limit = _limit_reached(run, settings, time.monotonic() - started)
        if limit is not None:
            run.limit_hit = limit
            params['tool_choice'] = {'type': 'none'}
            results = [*results, {'type': 'text', 'text': _WRAP_UP_NOTE.format(reason=limit)}]
        messages.append({'role': 'user', 'content': results})
    run.elapsed_seconds = time.monotonic() - started
    return run


def _request(
    client: anthropic.Anthropic,
    params: dict[str, Any],
    messages: list[Any],
    run: AgentRun,
) -> Any:
    """One billed model call, recorded on the run. None after a transient failure."""
    started = time.monotonic()
    try:
        response = client.messages.create(**params, messages=messages)
    except (
        anthropic.RateLimitError,
        anthropic.InternalServerError,
        anthropic.APIConnectionError,
    ) as exc:
        run.status = 'api_error'
        run.error = f'{type(exc).__name__}: {exc}'
        logger.warning("support_agent.api_error %s", run.error)
        return None
    usage = response.usage
    run.turns.append(TurnRecord(
        served_model=response.model,
        stop_reason=response.stop_reason,
        input_tokens=usage.input_tokens or 0,
        output_tokens=usage.output_tokens or 0,
        cache_creation_input_tokens=usage.cache_creation_input_tokens or 0,
        cache_read_input_tokens=usage.cache_read_input_tokens or 0,
        cost_usd=cost_from_usage(params['model'], usage).total_usd,
        elapsed_seconds=time.monotonic() - started,
    ))
    return response


def _execute(tool_uses: list[Any], reader: CodeReader, run: AgentRun) -> list[dict[str, Any]]:
    """Run every tool call of a turn. All results go back in one user message."""
    results: list[dict[str, Any]] = []
    for tool_use in tool_uses:
        started = time.monotonic()
        is_error = False
        try:
            content = reader.run_tool(tool_use.name, tool_use.input)
        except CodeReaderError as exc:
            content = str(exc)
            is_error = True
        run.tool_calls.append(ToolCallRecord(
            name=tool_use.name,
            arguments=tool_use.input,
            is_error=is_error,
            result_chars=len(content),
            elapsed_seconds=time.monotonic() - started,
        ))
        results.append({
            'type': 'tool_result',
            'tool_use_id': tool_use.id,
            'content': content,
            'is_error': is_error,
        })
    return results


def _limit_reached(run: AgentRun, settings: AgentConfig, elapsed: float) -> str | None:
    if run.tool_rounds >= settings.max_tool_rounds:
        return 'tool rounds'
    if elapsed >= settings.deadline_seconds:
        return 'time'
    if run.cost_usd >= settings.max_cost_usd:
        return 'cost'
    return None


def _finish(run: AgentRun, response: Any) -> None:
    text = next((block.text for block in response.content if block.type == 'text'), '')
    try:
        run.outcome = AgentOutcome.model_validate_json(text)
    except ValidationError as exc:
        run.status = 'unparseable'
        run.error = f'{exc.error_count()} validation errors in the final message'


def _loggable(content: list[Any]) -> list[dict[str, Any]]:
    """Response blocks for the saved transcript. Thinking comes back empty and is left out."""
    return [
        block.model_dump(mode='json', exclude_none=True)
        for block in content
        if block.type != 'thinking'
    ]
