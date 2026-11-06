"""
===============================================================================
Support Agent — Code Tools as an MCP Server
===============================================================================
Domain: Support
Description:
    Serves `CodeReader` for one commit over stdio, so a `claude -p` run reaches the
    same three tools as `run_support_agent` and no other way into the repository.
    A shell with `git` would not do: `git log` or `git show HEAD:` reaches commits
    the developer made after the report, which are the answers being measured.

    Speaks newline-delimited JSON-RPC, and only the methods a client needs. Three
    tools do not justify a dependency on the `mcp` library.

    `--stop-file` carries the research limit of the run. `claude -p` has no way to
    forbid tools for one turn, so once `cli_runner` writes that file, every further
    call returns its text to the model as an error result.

    Started by `cli_runner`, one process per run, with `backend/` on PYTHONPATH:
        python -m support.mcp_server --repo <path> --commit <sha> --stop-file <path>

Standards: SaaS 2026, least privilege.
===============================================================================
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path
from typing import Any, Final, TextIO

from support.code_reader import CODE_TOOLS, CodeReader, CodeReaderError

SERVER_NAME: Final[str] = 'code'
FALLBACK_PROTOCOL_VERSION: Final[str] = '2025-06-18'
METHOD_NOT_FOUND: Final[int] = -32601


def handle_message(message: dict[str, Any], reader: CodeReader, stop_file: Path | None) -> dict[str, Any] | None:
    """The reply to one JSON-RPC message. Notifications carry no id and get none."""
    if 'id' not in message:
        return None
    method = message.get('method')
    params = message.get('params') or {}
    result: dict[str, Any]
    if method == 'initialize':
        result = {
            'protocolVersion': params.get('protocolVersion', FALLBACK_PROTOCOL_VERSION),
            'capabilities': {'tools': {}},
            'serverInfo': {'name': SERVER_NAME, 'version': '1'},
        }
    elif method == 'ping':
        result = {}
    elif method == 'tools/list':
        result = {'tools': [_tool_listing(tool) for tool in CODE_TOOLS]}
    elif method == 'tools/call':
        result = _call_tool(params, reader, stop_file)
    else:
        return {
            'jsonrpc': '2.0',
            'id': message['id'],
            'error': {'code': METHOD_NOT_FOUND, 'message': f'Unknown method: {method}'},
        }
    return {'jsonrpc': '2.0', 'id': message['id'], 'result': result}


def _tool_listing(tool: dict[str, Any]) -> dict[str, Any]:
    return {
        'name': tool['name'],
        'description': tool['description'],
        'inputSchema': tool['input_schema'],
        # The API loop runs one turn's calls together; this lets the client do the same.
        'annotations': {'readOnlyHint': True},
    }


def _call_tool(params: dict[str, Any], reader: CodeReader, stop_file: Path | None) -> dict[str, Any]:
    if stop_file is not None and stop_file.exists():
        return _tool_result(stop_file.read_text(encoding='utf-8'), is_error=True)
    try:
        return _tool_result(reader.run_tool(params.get('name', ''), params.get('arguments') or {}), is_error=False)
    except CodeReaderError as exc:
        return _tool_result(str(exc), is_error=True)
    except (KeyError, TypeError, ValueError) as exc:
        # The API loop's strict schemas rule these out. Here the model may still send a bad call.
        return _tool_result(f'Bad arguments: {exc!r}', is_error=True)


def _tool_result(text: str, *, is_error: bool) -> dict[str, Any]:
    return {'content': [{'type': 'text', 'text': text}], 'isError': is_error}


def serve(reader: CodeReader, stop_file: Path | None, stdin: TextIO, stdout: TextIO) -> None:
    """Answer until the client closes stdin, which also ends this process if the client is killed."""
    for line in stdin:
        if not line.strip():
            continue
        reply = handle_message(json.loads(line), reader, stop_file)
        if reply is not None:
            stdout.write(json.dumps(reply, ensure_ascii=False) + '\n')
            stdout.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description='Read-only code tools for one commit, over MCP stdio.')
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--stop-file', type=Path, default=None)
    options = parser.parse_args()
    # The Windows default is the ANSI code page, and tool results hold Polish text.
    stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
    stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', newline='\n')
    serve(CodeReader(options.repo, options.commit), options.stop_file, stdin, stdout)


if __name__ == '__main__':
    main()
