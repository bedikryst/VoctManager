"""
===============================================================================
Support Agent — Tests: The Tool Loop
===============================================================================
Domain: Support
Description:
    Drives the loop with a scripted client that returns the SDK's real response
    types, so no call leaves the machine. Covers the limits, and the statuses that
    keep an API failure apart from a bad answer.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

import json
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import anthropic
import httpx
from anthropic.types import Message
from django.test import SimpleTestCase

from archive.infrastructure.ai_client import AIModel
from support.agent import AgentConfig, NeighbourReport, ReportInput, render_report, run_support_agent
from support.code_reader import CodeReaderError

REPORT = ReportInput(
    sent='2026-01-05 21:00 (Monday, Warsaw time)',
    filed_as='Something is unclear',
    screen='/panel/rehearsals',
    reporter_role='the conductor',
    body='What does this button do?',
)
FINAL = json.dumps({
    'reading': 'A question about a button.',
    'action': 'answer',
    'reply': 'It opens the list.',
    'developer_note': '',
})


def _message(content: list[dict[str, Any]], stop_reason: str, model: str = AIModel.OPUS_5_5) -> Message:
    return Message.model_validate({
        'id': 'msg_1',
        'type': 'message',
        'role': 'assistant',
        'model': model,
        'content': content,
        'stop_reason': stop_reason,
        'stop_sequence': None,
        'usage': {
            'input_tokens': 1000,
            'output_tokens': 100,
            'cache_creation_input_tokens': 0,
            'cache_read_input_tokens': 0,
        },
    })


def _tool_turn(name: str = 'grep_code') -> Message:
    return _message(
        [{'type': 'tool_use', 'id': 'toolu_1', 'name': name, 'input': {'pattern': 'x', 'path': None}}],
        'tool_use',
    )


def _final_turn(text: str = FINAL) -> Message:
    return _message([{'type': 'text', 'text': text}], 'end_turn')


class _ScriptedClient:
    """Stands in for `anthropic.Anthropic`: returns or raises the scripted turns in order."""

    def __init__(self, *turns: Any) -> None:
        self.turns = list(turns)
        self.requests: list[dict[str, Any]] = []
        self.messages = self

    def create(self, **params: Any) -> Any:
        self.requests.append({**params, 'messages': list(params['messages'])})
        turn = self.turns.pop(0)
        if isinstance(turn, Exception):
            raise turn
        return turn


class SupportAgentLoopTests(SimpleTestCase):
    def setUp(self) -> None:
        self.reader = MagicMock()
        self.reader.run_tool.return_value = 'backend/a.py:1:x'

    def _run(self, client: _ScriptedClient, **limits: Any) -> Any:
        return run_support_agent(
            report=REPORT, reader=self.reader, client=client, config=AgentConfig(**limits),  # type: ignore[arg-type]
        )

    def test_runs_tools_and_returns_the_parsed_outcome(self) -> None:
        run = self._run(_ScriptedClient(_tool_turn(), _final_turn()))
        self.assertEqual(run.status, 'ok')
        self.assertEqual(run.outcome.reply, 'It opens the list.')
        self.assertEqual(run.tool_rounds, 1)
        self.assertEqual(len(run.tool_calls), 1)
        self.assertEqual(run.cost_usd, Decimal('0.012') * 1)

    def test_the_cost_follows_the_model_under_test(self) -> None:
        cheap = AgentConfig(model=AIModel.HAIKU_5_5)
        turn = _message([{'type': 'text', 'text': FINAL}], 'end_turn', model=AIModel.HAIKU_5_5)
        run = run_support_agent(
            report=REPORT, reader=self.reader, client=_ScriptedClient(turn), config=cheap,  # type: ignore[arg-type]
        )
        self.assertEqual(run.status, 'ok')
        self.assertEqual(run.cost_usd, Decimal('0.00015'))

    def test_tool_results_go_back_against_their_call(self) -> None:
        client = _ScriptedClient(_tool_turn(), _final_turn())
        self._run(client)
        last = client.requests[1]['messages'][-1]
        self.assertEqual(last['role'], 'user')
        self.assertEqual(last['content'][0]['tool_use_id'], 'toolu_1')
        self.assertEqual(last['content'][0]['content'], 'backend/a.py:1:x')

    def test_a_refused_tool_call_returns_to_the_model_as_an_error(self) -> None:
        self.reader.run_tool.side_effect = CodeReaderError('Not a plain path')
        client = _ScriptedClient(_tool_turn(), _final_turn())
        run = self._run(client)
        self.assertEqual(run.status, 'ok')
        self.assertTrue(client.requests[1]['messages'][-1]['content'][0]['is_error'])
        self.assertTrue(run.tool_calls[0].is_error)

    def test_reaching_the_round_limit_forbids_tools_and_still_answers(self) -> None:
        client = _ScriptedClient(_tool_turn(), _tool_turn(), _final_turn())
        run = self._run(client, max_tool_rounds=2)
        self.assertEqual(run.limit_hit, 'tool rounds')
        self.assertEqual(run.status, 'ok')
        self.assertIsNotNone(run.outcome)
        self.assertNotIn('tool_choice', client.requests[1])
        self.assertEqual(client.requests[2]['tool_choice'], {'type': 'none'})
        self.assertIn('research budget', client.requests[2]['messages'][-1]['content'][-1]['text'])

    def test_the_time_and_cost_limits_end_the_research_the_same_way(self) -> None:
        run = self._run(_ScriptedClient(_tool_turn(), _final_turn()), deadline_seconds=0.0)
        self.assertEqual(run.limit_hit, 'time')
        run = self._run(_ScriptedClient(_tool_turn(), _final_turn()), max_cost_usd=Decimal('0.001'))
        self.assertEqual(run.limit_hit, 'cost')

    def test_a_refusal_is_its_own_status(self) -> None:
        run = self._run(_ScriptedClient(_message([], 'refusal')))
        self.assertEqual(run.status, 'refusal')
        self.assertIsNone(run.outcome)

    def test_truncation_is_not_an_answer(self) -> None:
        run = self._run(_ScriptedClient(_message([{'type': 'text', 'text': '{"read'}], 'max_tokens')))
        self.assertEqual(run.status, 'truncated')

    def test_unparseable_output_is_not_an_answer(self) -> None:
        run = self._run(_ScriptedClient(_final_turn('not json')))
        self.assertEqual(run.status, 'unparseable')

    def test_a_different_served_model_fails_the_run(self) -> None:
        run = self._run(_ScriptedClient(_message([], 'end_turn', model=AIModel.OPUS)))
        self.assertEqual(run.status, 'model_mismatch')

    def test_a_transient_failure_ends_the_run_with_a_status(self) -> None:
        failure = anthropic.APIConnectionError(request=httpx.Request('POST', 'https://example.com'))
        run = self._run(_ScriptedClient(_tool_turn(), failure))
        self.assertEqual(run.status, 'api_error')
        self.assertIsNone(run.outcome)
        self.assertEqual(len(run.turns), 1)

    def test_a_rejected_request_raises(self) -> None:
        response = httpx.Response(400, request=httpx.Request('POST', 'https://example.com'))
        failure = anthropic.BadRequestError('bad', response=response, body=None)
        with self.assertRaises(anthropic.BadRequestError):
            self._run(_ScriptedClient(failure))

    def test_the_rendered_report_holds_its_neighbours(self) -> None:
        text = render_report(ReportInput(
            sent=REPORT.sent,
            filed_as=REPORT.filed_as,
            screen=REPORT.screen,
            reporter_role=REPORT.reporter_role,
            body=REPORT.body,
            neighbours=(NeighbourReport('6 minutes later', 'Praise', '/panel', 'Found it, thanks.'),),
        ))
        self.assertIn('<primary_report>', text)
        self.assertIn('when="6 minutes later"', text)
        self.assertIn('Found it, thanks.', text)
