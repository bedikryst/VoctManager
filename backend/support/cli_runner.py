"""
===============================================================================
Support Agent — The Same Agent Through `claude -p`
===============================================================================
Domain: Support
Description:
    Runs the agent and its judges on a Claude subscription, so a tuning round needs
    no API balance. Model, prompts, tools and reports are those of
    `run_support_agent`. The loop around them is Claude Code's, so a result here
    says which prompt and which model, and nothing about that function's latency.

    Isolation. Every process starts in an empty directory with no settings, memory,
    instruction files or skills, and its tools are the structured-output tool plus
    `mcp_server`. Every CLAUDE* and ANTHROPIC* variable leaves the child's
    environment: a leftover `ANTHROPIC_API_KEY` would bill the API without a word,
    and a parent session's `CLAUDE_EFFORT` would override `--effort`. The init event
    proves the result, and `CliSetupError` ends the evaluation when it does not,
    because every later run would be wrong the same way.

    Limits. `--max-turns` ends a run with no answer at all, while most long reports
    reach the research limit and still answer in the API loop. So `limit_reached`
    decides here too, between turns, and the wrap-up note goes into a file that
    `mcp_server` returns for every later call. The client streams a call as it
    starts it, so a run can get a call or so past the limit. `--max-turns` is only
    the backstop behind that.

    A hit usage limit comes back as an error result: status `api_error`, so the run
    resumes later or on another account.

    `cost_usd` is what the API would charge for these tokens, not a charge.

Standards: SaaS 2026, least privilege.
===============================================================================
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Final

from pydantic import BaseModel, ValidationError

from archive.dtos import CallCost
from archive.infrastructure.ai_client import AIClient, AIClientError, cost_from_usage
from archive.infrastructure.prompts import Prompt
from support.agent import (
    OUTCOME_FORMAT,
    WRAP_UP_NOTE,
    AgentConfig,
    AgentOutcome,
    AgentRun,
    ReportInput,
    ToolCallRecord,
    TurnRecord,
    limit_reached,
    render_report,
)
from support.code_reader import CODE_TOOLS, CodeReader
from support.mcp_server import SERVER_NAME
from support.prompts import SUPPORT_AGENT

STRUCTURED_OUTPUT_TOOL: Final[str] = 'StructuredOutput'
BRIDGE_TOOL_PREFIX: Final[str] = f'mcp__{SERVER_NAME}__'
BRIDGE_TOOLS: Final[tuple[str, ...]] = tuple(f"{BRIDGE_TOOL_PREFIX}{tool['name']}" for tool in CODE_TOOLS)

# Room for the calls the wrap-up note answers, and the final message.
MAX_TURNS_PAST_LIMIT: Final[int] = 6
# Reached only by a process that has stopped answering.
HARD_TIMEOUT_PAST_DEADLINE_SECONDS: Final[float] = 300.0
# Above this the client saves a result to a file, and the model has no tool to read one.
MAX_MCP_OUTPUT_TOKENS: Final[int] = 100000
# One structured answer, and room to correct it if it fails the schema.
JUDGE_MAX_TURNS: Final[int] = 3
JUDGE_TIMEOUT_SECONDS: Final[float] = 300.0

# The model the client names on messages it writes itself, such as a usage-limit notice.
_SYNTHETIC_MODEL: Final[str] = '<synthetic>'
_STDERR_TAIL_CHARS: Final[int] = 500
_STRIPPED_ENV_PREFIXES: Final[tuple[str, ...]] = ('CLAUDE', 'ANTHROPIC')


class CliSetupError(Exception):
    """The process is not isolated as this module promises, so no run can count."""


class CliJudgeError(AIClientError):
    """The judge's process gave no usable verdict. The run it grades stays intact."""


@dataclass(frozen=True)
class CliOptions:
    binary: Path
    repo: Path
    config_dir: Path | None = None


def find_claude_binary() -> Path | None:
    """`claude` from PATH, else the newest VS Code extension's, whose folder name holds its version."""
    on_path = shutil.which('claude')
    if on_path:
        return Path(on_path)
    installed = Path.home().glob('.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude.exe')
    return max(installed, key=lambda path: path.stat().st_mtime, default=None)


def claude_version(options: CliOptions) -> str:
    done = subprocess.run(
        [str(options.binary), '--version'],
        capture_output=True, encoding='utf-8', errors='replace', timeout=60,
        env=child_environment(options.config_dir, 0), check=False,
    )
    return done.stdout.strip()


def child_environment(config_dir: Path | None, max_output_tokens: int) -> dict[str, str]:
    """The child's environment: the parent's, with no route to the API and no inherited session."""
    environment = {
        name: value
        for name, value in os.environ.items()
        if not name.upper().startswith(_STRIPPED_ENV_PREFIXES)
    }
    environment['CLAUDE_CODE_DISABLE_CLAUDE_MDS'] = '1'
    environment['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] = '1'
    environment['MAX_MCP_OUTPUT_TOKENS'] = str(MAX_MCP_OUTPUT_TOKENS)
    if max_output_tokens:
        environment['CLAUDE_CODE_MAX_OUTPUT_TOKENS'] = str(max_output_tokens)
    if config_dir is not None:
        environment['CLAUDE_CONFIG_DIR'] = str(config_dir)
    return environment


def base_command(
    binary: Path,
    *,
    system: str,
    model: str,
    effort: str,
    schema: dict[str, Any],
    max_turns: int,
) -> list[str]:
    return [
        str(binary), '-p',
        '--output-format', 'stream-json',
        '--verbose',
        '--system-prompt', system,
        '--tools', '',
        '--setting-sources', '',
        '--disable-slash-commands',
        '--no-session-persistence',
        '--strict-mcp-config',
        '--model', model,
        '--effort', effort,
        '--max-turns', str(max_turns),
        '--json-schema', json.dumps(schema),
    ]


def bridge_config(repo: Path, commit: str, stop_file: Path) -> dict[str, Any]:
    """The `--mcp-config` content: one bridge, on this interpreter, for one commit."""
    return {
        'mcpServers': {
            SERVER_NAME: {
                'command': sys.executable,
                'args': [
                    '-m', 'support.mcp_server',
                    '--repo', str(repo),
                    '--commit', commit,
                    '--stop-file', str(stop_file),
                ],
                'env': {'PYTHONPATH': str(repo / 'backend')},
            },
        },
    }


# ---------------------------------------------------------------------------
# One process
# ---------------------------------------------------------------------------

def check_isolation(event: dict[str, Any], expected_tools: frozenset[str]) -> None:
    """Raise unless the init event shows a subscription, the expected tools and a live bridge."""
    source = event.get('apiKeySource')
    if source != 'none':
        raise CliSetupError(f"This process would bill the API: key source {source!r}.")
    tools = frozenset(event.get('tools') or [])
    if tools != expected_tools:
        raise CliSetupError(f"Expected tools {sorted(expected_tools)}, got {sorted(tools)}.")
    down = [server.get('name') for server in event.get('mcp_servers') or [] if server.get('status') != 'connected']
    if down:
        raise CliSetupError(f"MCP servers not connected: {down}.")


def _run_claude(
    *,
    command: list[str],
    stdin_text: str,
    folder: Path,
    environment: dict[str, str],
    timeout: float,
    on_event: Callable[[dict[str, Any]], bool],
) -> tuple[dict[str, Any] | None, str]:
    """Run one process in an empty directory. Returns its result event, if any, and the tail of stderr.

    `on_event` sees every other event as it arrives. Returning False ends the process.
    """
    work = folder / 'work'
    work.mkdir()
    errors = folder / 'stderr.txt'
    result: dict[str, Any] | None = None
    with errors.open('wb') as stderr, subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, cwd=work, env=environment,
    ) as process:
        watchdog = threading.Timer(timeout, process.kill)
        watchdog.start()
        try:
            if process.stdin is None or process.stdout is None:
                raise CliSetupError("The process has no pipes.")
            try:
                process.stdin.write(stdin_text.encode('utf-8'))
                process.stdin.close()
            except OSError:
                # It died at startup. Its stderr says why, and reading stdout finds the end.
                pass
            for line in process.stdout:
                event = _parsed(line)
                if event is None:
                    continue
                if event.get('type') == 'result':
                    result = event
                elif not on_event(event):
                    break
        finally:
            watchdog.cancel()
            process.kill()
    return result, errors.read_text(encoding='utf-8', errors='replace')[-_STDERR_TAIL_CHARS:]


def _parsed(line: bytes) -> dict[str, Any] | None:
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return None
    return event if isinstance(event, dict) else None


def _error_text(result: dict[str, Any]) -> str:
    errors = result.get('errors') or []
    return str(result.get('result') or '; '.join(str(item) for item in errors) or result.get('subtype'))


def _usage_of(result: dict[str, Any], model: str) -> SimpleNamespace:
    """A run's tokens on one model. `usage` would also count the client's own side calls."""
    usage = (result.get('modelUsage') or {}).get(model) or {}
    return SimpleNamespace(
        input_tokens=usage.get('inputTokens') or 0,
        output_tokens=usage.get('outputTokens') or 0,
        cache_creation_input_tokens=usage.get('cacheCreationInputTokens') or 0,
        cache_read_input_tokens=usage.get('cacheReadInputTokens') or 0,
    )


# ---------------------------------------------------------------------------
# The agent
# ---------------------------------------------------------------------------

def run_support_agent_cli(
    *,
    report: ReportInput,
    reader: CodeReader,
    options: CliOptions,
    config: AgentConfig | None = None,
) -> AgentRun:
    """Run one report through `claude -p`. Raises only when the process is not isolated."""
    settings = config or AgentConfig()
    run = AgentRun()
    started = time.monotonic()
    user_message = render_report(report)
    run.transcript.append({'role': 'user', 'content': user_message})
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as name:
        folder = Path(name)
        stop_file = folder / 'stop'
        mcp_config = folder / 'mcp.json'
        mcp_config.write_text(json.dumps(bridge_config(options.repo, reader.commit, stop_file)), encoding='utf-8')
        command = [
            *base_command(
                options.binary,
                system=SUPPORT_AGENT.system,
                model=settings.model,
                effort=settings.effort,
                schema=OUTCOME_FORMAT['schema'],
                max_turns=settings.max_tool_rounds + MAX_TURNS_PAST_LIMIT,
            ),
            '--mcp-config', str(mcp_config),
            '--allowedTools', ','.join(BRIDGE_TOOLS),
        ]
        stream = _AgentStream(run, settings, stop_file, started)
        result, stderr = _run_claude(
            command=command,
            stdin_text=user_message,
            folder=folder,
            environment=child_environment(options.config_dir, settings.max_tokens),
            timeout=settings.deadline_seconds + HARD_TIMEOUT_PAST_DEADLINE_SECONDS,
            on_event=stream.feed,
        )
    _finish(run, settings, result, stderr)
    run.elapsed_seconds = time.monotonic() - started
    return run


class _AgentStream:
    """Folds one process's events into an `AgentRun`, and applies the research limits as they fall.

    The stream sends one message as several events, one per content block, all with
    the message's id, so a turn is a message id and not an event.
    """

    def __init__(self, run: AgentRun, settings: AgentConfig, stop_file: Path, started: float) -> None:
        self._run = run
        self._settings = settings
        self._stop_file = stop_file
        self._started = started
        self._last_event_at = started
        self._turns: dict[str, TurnRecord] = {}
        self._open_calls: dict[str, tuple[ToolCallRecord, float]] = {}

    def feed(self, event: dict[str, Any]) -> bool:
        kind = event.get('type')
        if kind == 'system' and event.get('subtype') == 'init':
            check_isolation(event, frozenset({STRUCTURED_OUTPUT_TOOL, *BRIDGE_TOOLS}))
        elif kind == 'rate_limit_event':
            self._read_usage_windows(event.get('rate_limit_info') or {})
        elif kind == 'assistant':
            return self._assistant(event['message'])
        elif kind == 'user':
            self._tool_results(event['message'])
        return True

    def _read_usage_windows(self, info: dict[str, Any]) -> None:
        for window, state in (info.get('unifiedWindows') or {}).items():
            self._run.usage_windows[window] = float(state.get('utilization') or 0.0)

    def _assistant(self, message: dict[str, Any]) -> bool:
        model = message.get('model')
        if model == _SYNTHETIC_MODEL:
            return True
        if model != self._settings.model:
            self._run.status = 'model_mismatch'
            self._run.error = f"Asked for {self._settings.model}, served by {model}"
            return False
        turn = self._turn_for(message)
        blocks = [self._loggable(block, turn) for block in message['content'] if block['type'] != 'thinking']
        if blocks:
            self._run.transcript.append({'role': 'assistant', 'content': blocks})
        return True

    def _turn_for(self, message: dict[str, Any]) -> TurnRecord:
        turn = self._turns.get(message['id'])
        if turn is not None:
            return turn
        self._apply_limits()
        now = time.monotonic()
        usage = message.get('usage') or {}
        # The stream reports only the first output tokens of a message; `_finish` adds the rest.
        turn = TurnRecord(
            served_model=message['model'],
            stop_reason='end_turn',
            input_tokens=usage.get('input_tokens') or 0,
            output_tokens=usage.get('output_tokens') or 0,
            cache_creation_input_tokens=usage.get('cache_creation_input_tokens') or 0,
            cache_read_input_tokens=usage.get('cache_read_input_tokens') or 0,
            cost_usd=Decimal('0'),
            elapsed_seconds=now - self._last_event_at,
        )
        turn.cost_usd = cost_from_usage(self._settings.model, turn).total_usd
        self._last_event_at = now
        self._turns[message['id']] = turn
        self._run.turns.append(turn)
        return turn

    def _apply_limits(self) -> None:
        if self._run.limit_hit is not None:
            return
        limit = limit_reached(self._run, self._settings, time.monotonic() - self._started)
        if limit is None:
            return
        self._run.limit_hit = limit
        # Replaced whole, so the bridge never reads it half written.
        pending = self._stop_file.with_suffix('.pending')
        pending.write_text(WRAP_UP_NOTE.format(reason=limit), encoding='utf-8')
        pending.replace(self._stop_file)

    def _loggable(self, block: dict[str, Any], turn: TurnRecord) -> dict[str, Any]:
        if block['type'] != 'tool_use' or block['name'] == STRUCTURED_OUTPUT_TOOL:
            return block
        name = block['name'].removeprefix(BRIDGE_TOOL_PREFIX)
        turn.stop_reason = 'tool_use'
        call = ToolCallRecord(
            name=name, arguments=block['input'], is_error=False, result_chars=0, elapsed_seconds=0.0,
        )
        self._run.tool_calls.append(call)
        self._open_calls[block['id']] = (call, time.monotonic())
        return {**block, 'name': name}

    def _tool_results(self, message: dict[str, Any]) -> None:
        now = time.monotonic()
        self._last_event_at = now
        results = []
        for block in message.get('content') or []:
            if not isinstance(block, dict) or block.get('type') != 'tool_result':
                continue
            text = _result_text(block.get('content'))
            is_error = bool(block.get('is_error'))
            opened = self._open_calls.pop(block.get('tool_use_id', ''), None)
            if opened is not None:
                call, began = opened
                call.is_error = is_error
                call.result_chars = len(text)
                call.elapsed_seconds = now - began
            results.append({
                'type': 'tool_result', 'tool_use_id': block.get('tool_use_id'), 'content': text, 'is_error': is_error,
            })
        if results:
            self._run.transcript.append({'role': 'user', 'content': results})


def _result_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return ''.join(block.get('text', '') for block in content if isinstance(block, dict))
    return ''


def _finish(run: AgentRun, settings: AgentConfig, result: dict[str, Any] | None, stderr: str) -> None:
    """Turn the result event into a status and an outcome."""
    if run.status != 'ok':
        return
    if result is None:
        run.status = 'api_error'
        run.error = f"claude ended with no result. stderr: {stderr.strip() or 'empty'}"
        return
    _add_missing_output(run, settings.model, result)
    subtype = result.get('subtype')
    if result.get('stop_reason') == 'refusal':
        run.status = 'refusal'
    elif subtype == 'error_max_turns':
        run.status = 'truncated'
        run.limit_hit = run.limit_hit or 'max turns'
        run.error = _error_text(result)
    elif subtype == 'error_max_structured_output_retries':
        run.status = 'unparseable'
        run.error = _error_text(result)
    elif subtype != 'success' or result.get('is_error'):
        run.status = 'api_error'
        run.error = _error_text(result)
    else:
        try:
            run.outcome = AgentOutcome.model_validate(result.get('structured_output'))
        except ValidationError as exc:
            run.status = 'unparseable'
            run.error = f'{exc.error_count()} validation errors in the structured output'


def _add_missing_output(run: AgentRun, model: str, result: dict[str, Any]) -> None:
    """The result event holds the exact output total, so the last turn takes what the stream left out."""
    if not run.turns:
        return
    missing = _usage_of(result, model).output_tokens - sum(turn.output_tokens for turn in run.turns)
    if missing > 0:
        last = run.turns[-1]
        last.output_tokens += missing
        last.cost_usd = cost_from_usage(model, last).total_usd


# ---------------------------------------------------------------------------
# The judge
# ---------------------------------------------------------------------------

class CliJudge(AIClient):
    """`AIClient.parse` through `claude -p`, for the evaluation's judges.

    The judges send text and read a schema, so only those parts of the parent's
    signature mean anything here.
    """

    def __init__(self, options: CliOptions) -> None:
        # The parent builds an SDK client, which wants a key and would never be used.
        self._options = options

    def parse[T: BaseModel](
        self,
        *,
        model: str,
        prompt: Prompt,
        user_content: str | list[dict],
        output_schema: type[T],
        max_tokens: int = AIClient.DEFAULT_MAX_TOKENS,
        effort: str = AIClient.DEFAULT_EFFORT,
        enable_thinking: bool = True,
        pdf_bytes: bytes | None = None,
        structured: bool = True,
        on_text_delta: Callable[[str], None] | None = None,
    ) -> tuple[T, CallCost]:
        if not isinstance(user_content, str) or pdf_bytes is not None:
            raise CliJudgeError("The CLI judge takes text only.")
        command = base_command(
            self._options.binary,
            system=prompt.system,
            model=model,
            effort=effort,
            schema=output_schema.model_json_schema(),
            max_turns=JUDGE_MAX_TURNS,
        )

        def verify(event: dict[str, Any]) -> bool:
            if event.get('type') == 'system' and event.get('subtype') == 'init':
                check_isolation(event, frozenset({STRUCTURED_OUTPUT_TOOL}))
            return True

        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as name:
            result, stderr = _run_claude(
                command=command,
                stdin_text=user_content,
                folder=Path(name),
                environment=child_environment(self._options.config_dir, max_tokens),
                timeout=JUDGE_TIMEOUT_SECONDS,
                on_event=verify,
            )
        if result is None:
            raise CliJudgeError(f"claude ended with no result. stderr: {stderr.strip() or 'empty'}")
        if result.get('subtype') != 'success' or result.get('is_error'):
            raise CliJudgeError(_error_text(result))
        try:
            verdict = output_schema.model_validate(result.get('structured_output'))
        except ValidationError as exc:
            raise CliJudgeError(f'{exc.error_count()} validation errors in the verdict') from exc
        return verdict, cost_from_usage(model, _usage_of(result, model))
