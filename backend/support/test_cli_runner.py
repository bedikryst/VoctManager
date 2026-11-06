"""
===============================================================================
Support Agent — Tests: The Route Through `claude -p`
===============================================================================
Domain: Support
Description:
    Replays the event stream the real client emits, including its habit of sending
    one message as several events, so no call leaves the machine. Process handling
    runs against a real Python child. Covers the isolation guard, the research
    limits, and the statuses that keep a hit usage limit apart from a bad answer.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from django.test import SimpleTestCase
from pydantic import BaseModel

from archive.infrastructure.ai_client import AIClientError, AIModel, cost_from_usage
from archive.infrastructure.prompts import Prompt
from support.agent import WRAP_UP_NOTE, AgentConfig, AgentRun, ReportInput, TurnRecord
from support.cli_runner import (
    BRIDGE_TOOLS,
    STRUCTURED_OUTPUT_TOOL,
    CliJudge,
    CliJudgeError,
    CliOptions,
    CliSetupError,
    _AgentStream,
    _run_claude,
    base_command,
    bridge_config,
    check_isolation,
    child_environment,
    run_support_agent_cli,
)

REPORT = ReportInput(
    sent='2026-01-05 21:00 (Monday, Warsaw time)',
    filed_as='Something is unclear',
    screen='/panel/rehearsals',
    reporter_role='the conductor',
    body='Co robi ten przycisk?',
)
OUTCOME = {'reading': 'A question.', 'action': 'answer', 'reply': 'Otwiera listę.', 'developer_note': ''}
AGENT_TOOLS = frozenset({STRUCTURED_OUTPUT_TOOL, *BRIDGE_TOOLS})
OPTIONS = CliOptions(binary=Path('claude'), repo=Path('repo'))


def _init(**overrides: Any) -> dict[str, Any]:
    return {
        'type': 'system',
        'subtype': 'init',
        'apiKeySource': 'none',
        'tools': sorted(AGENT_TOOLS),
        'mcp_servers': [{'name': 'code', 'status': 'connected'}],
        **overrides,
    }


def _assistant(message_id: str, *blocks: dict[str, Any], model: str = AIModel.OPUS_5_5) -> dict[str, Any]:
    return {
        'type': 'assistant',
        'message': {
            'id': message_id,
            'model': model,
            'stop_reason': None,
            'content': list(blocks),
            'usage': {
                'input_tokens': 1000, 'output_tokens': 10,
                'cache_creation_input_tokens': 0, 'cache_read_input_tokens': 0,
            },
        },
    }


def _tool_use(tool_id: str = 'toolu_1', name: str = 'mcp__code__grep_code') -> dict[str, Any]:
    return {'type': 'tool_use', 'id': tool_id, 'name': name, 'input': {'pattern': 'x'}}


def _tool_result(tool_id: str = 'toolu_1', text: str = 'backend/a.py:1:x', *, is_error: bool = False) -> dict[str, Any]:
    return {
        'type': 'user',
        'message': {'content': [{
            'type': 'tool_result', 'tool_use_id': tool_id, 'is_error': is_error,
            'content': [{'type': 'text', 'text': text}],
        }]},
    }


def _final_block() -> dict[str, Any]:
    return {'type': 'tool_use', 'id': 'toolu_end', 'name': STRUCTURED_OUTPUT_TOOL, 'input': OUTCOME}


def _result(**overrides: Any) -> dict[str, Any]:
    return {
        'type': 'result',
        'subtype': 'success',
        'is_error': False,
        'stop_reason': 'tool_use',
        'structured_output': OUTCOME,
        'modelUsage': {
            AIModel.OPUS_5_5: {
                'inputTokens': 2000, 'outputTokens': 500,
                'cacheCreationInputTokens': 0, 'cacheReadInputTokens': 0,
            },
            'claude-haiku-4-5': {'inputTokens': 50, 'outputTokens': 50},
        },
        **overrides,
    }


def _replay(events: list[dict[str, Any]], result: dict[str, Any] | None, stderr: str = '') -> Callable[..., Any]:
    """Stands in for `_run_claude`: feeds the scripted events the way the real one does."""
    def replay(*, on_event: Callable[[dict[str, Any]], bool], **_: Any) -> tuple[dict[str, Any] | None, str]:
        for event in events:
            if not on_event(event):
                break
        return result, stderr
    return replay


def _agent_run(events: list[dict[str, Any]], result: dict[str, Any] | None, stderr: str = '') -> Any:
    reader = MagicMock(commit='abc1234')
    with mock.patch('support.cli_runner._run_claude', side_effect=_replay(events, result, stderr)):
        return run_support_agent_cli(report=REPORT, reader=reader, options=OPTIONS)


class ChildSetupTests(SimpleTestCase):
    def test_the_child_has_no_route_to_the_api_and_no_inherited_session(self) -> None:
        inherited = {
            'ANTHROPIC_API_KEY': 'sk-x', 'ANTHROPIC_AUTH_TOKEN': 'y', 'CLAUDECODE': '1',
            'CLAUDE_EFFORT': 'low', 'CLAUDE_CODE_SESSION_ID': 's', 'KEEP_ME': 'yes',
        }
        with mock.patch.dict(os.environ, inherited):
            environment = child_environment(None, 16000)
        for name in ('ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDECODE', 'CLAUDE_EFFORT', 'CLAUDE_CODE_SESSION_ID'):
            self.assertNotIn(name, environment)
        self.assertEqual(environment['KEEP_ME'], 'yes')
        self.assertEqual(environment['CLAUDE_CODE_DISABLE_CLAUDE_MDS'], '1')
        self.assertEqual(environment['CLAUDE_CODE_DISABLE_AUTO_MEMORY'], '1')
        self.assertEqual(environment['CLAUDE_CODE_MAX_OUTPUT_TOKENS'], '16000')
        self.assertNotIn('CLAUDE_CONFIG_DIR', environment)

    def test_a_config_dir_picks_the_account(self) -> None:
        self.assertEqual(child_environment(Path('second'), 0)['CLAUDE_CONFIG_DIR'], 'second')

    def test_the_command_turns_off_every_built_in_and_setting(self) -> None:
        command = base_command(
            Path('claude'), system='sys', model=AIModel.OPUS_5_5, effort='high', schema={'type': 'object'}, max_turns=9,
        )
        for flag, value in (('--tools', ''), ('--setting-sources', ''), ('--model', AIModel.OPUS_5_5), ('--max-turns', '9')):
            self.assertEqual(command[command.index(flag) + 1], value)
        for flag in ('--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence'):
            self.assertIn(flag, command)

    def test_the_bridge_serves_one_commit_of_this_repo(self) -> None:
        server = bridge_config(Path('repo'), 'abc1234', Path('stop'))['mcpServers']['code']
        self.assertEqual(server['args'][server['args'].index('--commit') + 1], 'abc1234')
        self.assertEqual(server['env']['PYTHONPATH'], str(Path('repo') / 'backend'))


class IsolationCheckTests(SimpleTestCase):
    def test_a_subscription_with_the_expected_tools_passes(self) -> None:
        check_isolation(_init(), AGENT_TOOLS)

    def test_an_api_key_stops_everything(self) -> None:
        with self.assertRaisesMessage(CliSetupError, 'bill the API'):
            check_isolation(_init(apiKeySource='ANTHROPIC_API_KEY'), AGENT_TOOLS)

    def test_a_shell_among_the_tools_stops_everything(self) -> None:
        with self.assertRaisesMessage(CliSetupError, 'Bash'):
            check_isolation(_init(tools=[*sorted(AGENT_TOOLS), 'Bash']), AGENT_TOOLS)

    def test_a_dead_bridge_stops_everything(self) -> None:
        with self.assertRaisesMessage(CliSetupError, 'not connected'):
            check_isolation(_init(mcp_servers=[{'name': 'code', 'status': 'failed'}]), AGENT_TOOLS)

    def test_the_run_raises_rather_than_counts(self) -> None:
        with self.assertRaises(CliSetupError):
            _agent_run([_init(apiKeySource='ANTHROPIC_API_KEY')], _result())


class AgentStreamTests(SimpleTestCase):
    def test_a_run_folds_into_the_same_record_as_the_api_loop(self) -> None:
        run = _agent_run(
            [
                _init(),
                _assistant('m1', {'type': 'thinking', 'thinking': ''}),
                _assistant('m1', _tool_use()),
                _tool_result(),
                _assistant('m2', _final_block()),
            ],
            _result(),
        )
        self.assertEqual(run.status, 'ok')
        self.assertEqual(run.outcome.reply, 'Otwiera listę.')
        self.assertEqual(run.tool_rounds, 1)
        self.assertEqual(run.tool_calls[0].name, 'grep_code')
        self.assertEqual(run.tool_calls[0].result_chars, len('backend/a.py:1:x'))
        self.assertFalse(run.tool_calls[0].is_error)
        self.assertNotIn('thinking', json.dumps(run.transcript))

    def test_events_of_one_message_are_one_turn(self) -> None:
        run = _agent_run(
            [
                _init(),
                _assistant('m1', _tool_use('toolu_1')),
                _tool_result('toolu_1'),
                _assistant('m1', _tool_use('toolu_2')),
                _tool_result('toolu_2'),
                _assistant('m2', _final_block()),
            ],
            _result(),
        )
        self.assertEqual(len(run.turns), 2)
        self.assertEqual(run.tool_rounds, 1)
        self.assertEqual(len(run.tool_calls), 2)

    def test_the_exact_output_total_comes_from_the_result_and_ignores_side_calls(self) -> None:
        run = _agent_run([_init(), _assistant('m1', _tool_use()), _assistant('m2', _final_block())], _result())
        self.assertEqual(sum(turn.output_tokens for turn in run.turns), 500)
        expected = cost_from_usage(AIModel.OPUS_5_5, run.turns[0]).total_usd
        expected += cost_from_usage(AIModel.OPUS_5_5, run.turns[1]).total_usd
        self.assertEqual(run.cost_usd, expected)
        self.assertGreater(run.cost_usd, Decimal('0'))

    def test_a_tool_error_is_recorded_against_its_call(self) -> None:
        run = _agent_run(
            [_init(), _assistant('m1', _tool_use()), _tool_result(text='refused', is_error=True),
             _assistant('m2', _final_block())],
            _result(),
        )
        self.assertTrue(run.tool_calls[0].is_error)

    def test_a_different_served_model_fails_the_run_at_once(self) -> None:
        run = _agent_run(
            [_init(), _assistant('m1', _tool_use(), model=AIModel.SONNET_5_5), _assistant('m2', _final_block())],
            _result(),
        )
        self.assertEqual(run.status, 'model_mismatch')
        self.assertIsNone(run.outcome)
        self.assertEqual(run.turns, [])

    def test_the_clients_own_messages_are_not_a_served_model(self) -> None:
        run = _agent_run(
            [_init(), _assistant('m0', {'type': 'text', 'text': 'Limit'}, model='<synthetic>'),
             _assistant('m1', _final_block())],
            _result(),
        )
        self.assertEqual(run.status, 'ok')
        self.assertEqual(len(run.turns), 1)

    def test_the_usage_windows_are_read_from_the_stream(self) -> None:
        run = _agent_run(
            [_init(), {'type': 'rate_limit_event', 'rate_limit_info': {'unifiedWindows': {
                'five_hour': {'utilization': 0.49}, 'seven_day': {'utilization': 0.7},
            }}}, _assistant('m1', _final_block())],
            _result(),
        )
        self.assertEqual(run.usage_windows, {'five_hour': 0.49, 'seven_day': 0.7})


class ResearchLimitTests(SimpleTestCase):
    def setUp(self) -> None:
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.stop_file = Path(folder.name) / 'stop'

    def _stream(self, **limits: Any) -> tuple[_AgentStream, AgentRun]:
        run = AgentRun()
        return _AgentStream(run, AgentConfig(**limits), self.stop_file, time.monotonic()), run

    def test_the_last_rounds_calls_still_run_and_the_next_turn_gets_the_note(self) -> None:
        stream, run = self._stream(max_tool_rounds=2)
        stream.feed(_assistant('m1', _tool_use('toolu_1')))
        stream.feed(_tool_result('toolu_1'))
        stream.feed(_assistant('m2', _tool_use('toolu_2')))
        stream.feed(_tool_result('toolu_2'))
        self.assertFalse(self.stop_file.exists())
        self.assertIsNone(run.limit_hit)
        stream.feed(_assistant('m3', _tool_use('toolu_3')))
        self.assertEqual(run.limit_hit, 'tool rounds')
        self.assertEqual(self.stop_file.read_text(encoding='utf-8'), WRAP_UP_NOTE.format(reason='tool rounds'))

    def test_the_time_limit_ends_the_research_the_same_way(self) -> None:
        stream, run = self._stream(deadline_seconds=0.0)
        stream.feed(_assistant('m1', _tool_use()))
        self.assertEqual(run.limit_hit, 'time')
        self.assertTrue(self.stop_file.exists())

    def test_a_run_past_the_limit_still_answers(self) -> None:
        run = _agent_run(
            [_init(), *[_assistant(f'm{index}', _tool_use(f't{index}')) for index in range(14)],
             _assistant('last', _final_block())],
            _result(),
        )
        self.assertEqual(run.status, 'ok')
        self.assertEqual(run.limit_hit, 'tool rounds')
        self.assertIsNotNone(run.outcome)


class ResultStatusTests(SimpleTestCase):
    def test_a_hit_usage_limit_is_an_api_error_so_the_run_resumes_later(self) -> None:
        run = _agent_run([_init()], _result(is_error=True, result='5-hour limit reached', structured_output=None))
        self.assertEqual(run.status, 'api_error')
        self.assertIn('limit reached', run.error)

    def test_no_result_event_is_an_api_error_with_the_stderr(self) -> None:
        run = _agent_run([_init()], None, 'it broke')
        self.assertEqual(run.status, 'api_error')
        self.assertIn('it broke', run.error)

    def test_the_turn_backstop_is_truncation_and_not_an_answer(self) -> None:
        run = _agent_run(
            [_init(), _assistant('m1', _tool_use())],
            _result(subtype='error_max_turns', is_error=True, structured_output=None, errors=['Reached maximum']),
        )
        self.assertEqual(run.status, 'truncated')
        self.assertEqual(run.limit_hit, 'max turns')
        self.assertIsNone(run.outcome)

    def test_output_that_fails_the_schema_is_unparseable(self) -> None:
        run = _agent_run([_init()], _result(structured_output={'reading': 'x'}))
        self.assertEqual(run.status, 'unparseable')

    def test_exhausted_schema_retries_are_unparseable(self) -> None:
        run = _agent_run([_init()], _result(
            subtype='error_max_structured_output_retries', is_error=True, structured_output=None,
        ))
        self.assertEqual(run.status, 'unparseable')

    def test_a_refusal_is_its_own_status(self) -> None:
        run = _agent_run([_init()], _result(stop_reason='refusal', structured_output=None))
        self.assertEqual(run.status, 'refusal')
        self.assertIsNone(run.outcome)


class RealProcessTests(SimpleTestCase):
    def _run(
        self,
        script: str,
        *,
        stdin_text: str = '',
        timeout: float = 60.0,
        on_event: Callable[[dict[str, Any]], bool] = lambda event: True,
    ) -> tuple[Any, str]:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as name:
            return _run_claude(
                command=[sys.executable, '-c', script],
                stdin_text=stdin_text,
                folder=Path(name),
                environment=dict(os.environ),
                timeout=timeout,
                on_event=on_event,
            )

    def test_stdin_arrives_as_utf8_and_noise_in_the_stream_is_skipped(self) -> None:
        seen: list[dict[str, Any]] = []

        def record(event: dict[str, Any]) -> bool:
            seen.append(event)
            return True

        script = (
            "import json, sys\n"
            "text = sys.stdin.buffer.read().decode('utf-8')\n"
            "print(json.dumps({'type': 'system'}))\n"
            "print('not json')\n"
            "print(json.dumps({'type': 'result', 'echo': text}))\n"
            "sys.stderr.write('warned')\n"
        )
        result, stderr = self._run(script, stdin_text='Zażółć', on_event=record)
        self.assertEqual(result['echo'], 'Zażółć')
        self.assertEqual(seen, [{'type': 'system'}])
        self.assertEqual(stderr, 'warned')

    def test_a_silent_process_is_killed_at_the_timeout(self) -> None:
        started = time.monotonic()
        result, _ = self._run('import time; time.sleep(60)', timeout=0.5)
        self.assertIsNone(result)
        self.assertLess(time.monotonic() - started, 30)

    def test_returning_false_ends_the_process(self) -> None:
        script = "import json, time; print(json.dumps({'type': 'system'}), flush=True); time.sleep(60)"
        started = time.monotonic()
        result, _ = self._run(script, on_event=lambda event: False)
        self.assertIsNone(result)
        self.assertLess(time.monotonic() - started, 30)


class _Verdict(BaseModel):
    same_gap: bool
    reason: str


class CliJudgeTests(SimpleTestCase):
    PROMPT = Prompt(name='judge', system='Grade this.')

    def _parse(self, events: list[dict[str, Any]], result: dict[str, Any] | None) -> tuple[Any, Any, Any]:
        with mock.patch('support.cli_runner._run_claude', side_effect=_replay(events, result)) as run:
            verdict, cost = CliJudge(OPTIONS).parse(
                model=AIModel.OPUS_5_5, prompt=self.PROMPT, user_content='<report>', output_schema=_Verdict,
                max_tokens=8000,
            )
        return verdict, cost, run.call_args.kwargs

    def _result(self, **overrides: Any) -> dict[str, Any]:
        return _result(structured_output={'same_gap': True, 'reason': 'same'}, **overrides)

    def test_the_verdict_and_its_estimated_cost_come_from_the_result(self) -> None:
        init = _init(tools=[STRUCTURED_OUTPUT_TOOL], mcp_servers=[])
        verdict, cost, call = self._parse([init], self._result())
        self.assertTrue(verdict.same_gap)
        self.assertEqual(cost.input_tokens, 2000)
        self.assertEqual(cost.output_tokens, 500)
        self.assertEqual(call['stdin_text'], '<report>')
        self.assertNotIn('--mcp-config', call['command'])
        self.assertEqual(json.loads(call['command'][call['command'].index('--json-schema') + 1]),
                         _Verdict.model_json_schema())

    def test_a_judge_with_a_bridge_or_a_shell_is_not_isolated(self) -> None:
        with self.assertRaises(CliSetupError):
            self._parse([_init()], self._result())

    def test_a_hit_usage_limit_is_a_judge_error_and_an_ai_client_error(self) -> None:
        with self.assertRaises(CliJudgeError) as caught:
            self._parse([], _result(is_error=True, result='limit reached', structured_output=None))
        self.assertIsInstance(caught.exception, AIClientError)
        self.assertIn('limit reached', str(caught.exception))

    def test_no_result_is_a_judge_error(self) -> None:
        with self.assertRaises(CliJudgeError):
            self._parse([], None)

    def test_a_verdict_outside_the_schema_is_a_judge_error(self) -> None:
        with self.assertRaises(CliJudgeError):
            self._parse([], _result(structured_output={'same_gap': 'perhaps'}))

    def test_turn_records_price_the_same_as_the_api_usage(self) -> None:
        turn = TurnRecord(AIModel.OPUS_5_5, 'end_turn', 1000, 100, 0, 0, Decimal('0'), 0.0)
        self.assertEqual(cost_from_usage(AIModel.OPUS_5_5, turn).total_usd, Decimal('0.006'))
