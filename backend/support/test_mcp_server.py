"""
===============================================================================
Support Agent — Tests: The MCP Bridge
===============================================================================
Domain: Support
Description:
    Drives the JSON-RPC handling directly with a stand-in reader. Covers what a
    `claude -p` run depends on: the three tools and nothing else, tool errors that
    go back to the model, and the stop file that ends the research.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

import io
import json
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from support.code_reader import CODE_TOOLS, CodeReaderError
from support.mcp_server import METHOD_NOT_FOUND, handle_message, serve


def _call(name: str = 'grep_code', arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        'jsonrpc': '2.0', 'id': 7, 'method': 'tools/call',
        'params': {'name': name, 'arguments': arguments if arguments is not None else {'pattern': 'x'}},
    }


def _handle(message: dict[str, Any], reader: Any, stop_file: Path | None) -> Any:
    return handle_message(message, reader, stop_file)


class McpBridgeTests(SimpleTestCase):
    def setUp(self) -> None:
        self.reader = MagicMock()
        self.reader.run_tool.return_value = 'backend/a.py:1:x'

    def test_initialize_answers_in_the_clients_protocol_version(self) -> None:
        reply = _handle(
            {'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2099-01-01'}}, self.reader, None,
        )
        self.assertEqual(reply['result']['protocolVersion'], '2099-01-01')
        self.assertEqual(reply['result']['capabilities'], {'tools': {}})

    def test_a_notification_gets_no_reply(self) -> None:
        self.assertIsNone(_handle({'method': 'notifications/initialized'}, self.reader, None))

    def test_the_list_holds_exactly_the_agents_tools(self) -> None:
        reply = _handle({'id': 1, 'method': 'tools/list'}, self.reader, None)
        tools = reply['result']['tools']
        self.assertEqual([tool['name'] for tool in tools], [tool['name'] for tool in CODE_TOOLS])
        self.assertEqual(tools[0]['inputSchema'], CODE_TOOLS[0]['input_schema'])

    def test_a_call_reaches_the_reader_and_returns_its_text(self) -> None:
        reply = _handle(_call('read_file', {'path': 'backend/a.py'}), self.reader, None)
        self.reader.run_tool.assert_called_once_with('read_file', {'path': 'backend/a.py'})
        self.assertEqual(reply['id'], 7)
        self.assertEqual(reply['result'], {'content': [{'type': 'text', 'text': 'backend/a.py:1:x'}], 'isError': False})

    def test_a_refused_call_goes_back_to_the_model_as_an_error(self) -> None:
        self.reader.run_tool.side_effect = CodeReaderError('Not a plain path')
        reply = _handle(_call(), self.reader, None)
        self.assertTrue(reply['result']['isError'])
        self.assertEqual(reply['result']['content'][0]['text'], 'Not a plain path')

    def test_a_malformed_call_goes_back_to_the_model_as_an_error(self) -> None:
        self.reader.run_tool.side_effect = KeyError('pattern')
        reply = _handle(_call(arguments={}), self.reader, None)
        self.assertTrue(reply['result']['isError'])

    def test_the_stop_file_answers_every_call_and_the_reader_stays_unused(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            stop_file = Path(name) / 'stop'
            _handle(_call(), self.reader, stop_file)
            self.assertEqual(self.reader.run_tool.call_count, 1)
            stop_file.write_text('Budget used up.', encoding='utf-8')
            reply = _handle(_call(), self.reader, stop_file)
        self.assertEqual(self.reader.run_tool.call_count, 1)
        self.assertTrue(reply['result']['isError'])
        self.assertEqual(reply['result']['content'][0]['text'], 'Budget used up.')

    def test_an_unknown_method_is_a_protocol_error(self) -> None:
        reply = _handle({'id': 1, 'method': 'resources/list'}, self.reader, None)
        self.assertEqual(reply['error']['code'], METHOD_NOT_FOUND)

    def test_serve_answers_line_by_line_and_keeps_polish_readable(self) -> None:
        self.reader.run_tool.return_value = 'Zażółć'
        lines = [
            json.dumps({'method': 'notifications/initialized'}),
            '',
            json.dumps(_call()),
        ]
        stdout = io.StringIO()
        serve(self.reader, None, io.StringIO('\n'.join(lines) + '\n'), stdout)
        replies = stdout.getvalue().splitlines()
        self.assertEqual(len(replies), 1)
        self.assertIn('Zażółć', replies[0])
