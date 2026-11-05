"""
===============================================================================
Support Agent — Read-Only Code Access at One Commit
===============================================================================
Domain: Support
Description:
    The agent's only view of the app: `git grep`, `git show` and `git ls-tree`
    against the commit a report was written on. There is no worktree and no
    history tool, so nothing the developer changed after the report can reach
    the agent. A reference answer checked at the report's build would otherwise
    score a correct answer as wrong.

    Every path passes an allowlist of roots and suffixes: `.env` and the data
    folders sit outside it even when a commit happens to track them. Every git
    argument is passed as a list, with the search pattern behind `-e`, so report
    text the model repeats into a tool call cannot become a git option.

    A failing tool call raises `CodeReaderError`; the caller returns the message
    to the model as an error result, which lets it correct itself.

Standards: SaaS 2026, least privilege.
===============================================================================
"""
from __future__ import annotations

import re
import subprocess
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import Any, Final

GIT_TIMEOUT_SECONDS: Final[float] = 20.0

ALLOWED_ROOTS: Final[tuple[str, ...]] = ('backend/', 'frontend/src/')
ALLOWED_SUFFIXES: Final[tuple[str, ...]] = ('.py', '.ts', '.tsx', '.json', '.html', '.po')

# A search skips what only adds noise: generated migrations and the locales the
# members do not read. All of it stays readable by path.
GREP_EXCLUDES: Final[tuple[str, ...]] = (
    ':(exclude,glob)**/migrations/**',
    ':(exclude,glob)backend/locale/**',
    ':(exclude,glob)frontend/src/shared/config/locales/en/**',
    ':(exclude,glob)frontend/src/shared/config/locales/fr/**',
)

MAX_GREP_LINES: Final[int] = 80
MAX_READ_LINES: Final[int] = 400
MAX_LIST_ENTRIES: Final[int] = 300
MAX_LINE_CHARS: Final[int] = 400

_COMMIT_RE: Final[re.Pattern[str]] = re.compile(r'^[0-9a-f]{7,40}$')
_FORBIDDEN_PATH_CHARS: Final[re.Pattern[str]] = re.compile(r'[\\:*?\[\]]')


class CodeReaderError(Exception):
    """A tool call the reader refused or git could not serve."""


class CodeReader:
    """Read-only access to the tracked source of one commit of a local repo."""

    def __init__(self, repo: Path, commit: str) -> None:
        if not _COMMIT_RE.match(commit):
            raise CodeReaderError(f"Not a commit id: {commit!r}")
        self._repo = repo
        self.commit = self._git(['rev-parse', '--verify', f'{commit}^{{commit}}']).strip()

    # -- tools ---------------------------------------------------------------

    def grep(self, pattern: str, path: str | None = None, *, ignore_case: bool = False) -> str:
        """Matching lines as `path:line:text`, capped at `MAX_GREP_LINES`."""
        if not pattern:
            raise CodeReaderError("The search pattern is empty.")
        arguments = ['grep', '-n', '-I', '-E']
        if ignore_case:
            arguments.append('-i')
        arguments += ['-e', pattern, self.commit, '--', *self._grep_pathspecs(path), *GREP_EXCLUDES]
        output = self._git(arguments, no_match_is_empty=True)
        lines = [line.removeprefix(f'{self.commit}:') for line in output.splitlines()]
        if not lines:
            return "No matches at this build."
        return _capped(
            [_clip(line) for line in lines],
            limit=MAX_GREP_LINES,
            advice="narrow the pattern or the path",
        )

    def read_file(self, path: str, start_line: int | None = None, end_line: int | None = None) -> str:
        """Numbered lines of one file, at most `MAX_READ_LINES` per call."""
        clean = _validated_file(path)
        text = self._git(['show', f'{self.commit}:{clean}'])
        lines = text.splitlines()
        first = max(start_line or 1, 1)
        last = min(end_line or len(lines), len(lines), first + MAX_READ_LINES - 1)
        if first > len(lines):
            raise CodeReaderError(f"{clean} has {len(lines)} lines; line {first} does not exist.")
        numbered = [f'{number}\t{_clip(lines[number - 1])}' for number in range(first, last + 1)]
        header = f'{clean} (lines {first}-{last} of {len(lines)})'
        return '\n'.join([header, *numbered])

    def list_files(self, path: str | None = None) -> str:
        """Readable files under a directory, capped at `MAX_LIST_ENTRIES`."""
        targets = [_validated_directory(path)] if path else list(ALLOWED_ROOTS)
        output = self._git(['ls-tree', '-r', '--name-only', self.commit, '--', *targets])
        names = sorted(name for name in output.splitlines() if name.endswith(ALLOWED_SUFFIXES))
        if not names:
            return "No files there at this build."
        return _capped(names, limit=MAX_LIST_ENTRIES, advice="list a narrower directory")

    def run_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """Dispatch one model tool call. Raises `CodeReaderError` on a bad call."""
        if name == 'grep_code':
            return self.grep(
                arguments['pattern'],
                arguments.get('path'),
                ignore_case=bool(arguments.get('ignore_case')),
            )
        if name == 'read_file':
            return self.read_file(
                arguments['path'], arguments.get('start_line'), arguments.get('end_line'),
            )
        if name == 'list_files':
            return self.list_files(arguments.get('path'))
        raise CodeReaderError(f"Unknown tool: {name!r}")

    # -- internals -----------------------------------------------------------

    def _grep_pathspecs(self, path: str | None) -> list[str]:
        if path and path.endswith(ALLOWED_SUFFIXES):
            return [f':(literal){_validated_file(path)}']
        directories = [_validated_directory(path)] if path else list(ALLOWED_ROOTS)
        return [
            f':(glob){directory}**/*{suffix}'
            for directory in directories
            for suffix in ALLOWED_SUFFIXES
        ]

    def _git(self, arguments: Sequence[str], *, no_match_is_empty: bool = False) -> str:
        command = ['git', '-C', str(self._repo), '-c', 'core.quotepath=false', '--no-pager', *arguments]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                encoding='utf-8',
                errors='replace',
                timeout=GIT_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise CodeReaderError("The search took too long; narrow it.") from exc
        if no_match_is_empty and result.returncode == 1:
            return ''
        if result.returncode != 0:
            raise CodeReaderError(result.stderr.strip() or f"git exited with {result.returncode}")
        return result.stdout


def _validated_directory(path: str) -> str:
    """A directory inside the allowed roots, with one trailing slash."""
    clean = _validated_relative(path).rstrip('/') + '/'
    if not clean.startswith(ALLOWED_ROOTS):
        raise CodeReaderError(f"Readable roots are {', '.join(ALLOWED_ROOTS)}; got {path!r}.")
    return clean


def _validated_file(path: str) -> str:
    """A readable file path: inside the allowed roots, with an allowed suffix."""
    clean = _validated_relative(path)
    if not clean.startswith(ALLOWED_ROOTS) or not clean.endswith(ALLOWED_SUFFIXES):
        raise CodeReaderError(
            f"Readable files are {', '.join(ALLOWED_SUFFIXES)} under {', '.join(ALLOWED_ROOTS)}; "
            f"got {path!r}."
        )
    return clean


def _validated_relative(path: str) -> str:
    if _FORBIDDEN_PATH_CHARS.search(path) or path.startswith('/'):
        raise CodeReaderError(f"Not a plain repo-relative path: {path!r}.")
    if '..' in PurePosixPath(path).parts:
        raise CodeReaderError(f"Parent segments are not allowed: {path!r}.")
    return path


def _clip(line: str) -> str:
    return line if len(line) <= MAX_LINE_CHARS else f'{line[:MAX_LINE_CHARS]} [line cut]'


def _capped(lines: list[str], *, limit: int, advice: str) -> str:
    if len(lines) <= limit:
        return '\n'.join(lines)
    return '\n'.join([*lines[:limit], f'[{len(lines) - limit} more not shown; {advice}]'])


# Strict schemas keep every argument present, so the optional ones arrive as null.
CODE_TOOLS: Final[list[dict[str, Any]]] = [
    {
        'name': 'grep_code',
        'description': (
            "Search the app's code at this build. `pattern` is a POSIX extended regular "
            "expression: use [0-9] rather than \\d. `path` narrows the search to one directory "
            "or file. Without it the search covers backend/ and frontend/src/, leaving out "
            "migrations and the English and French locale files."
        ),
        'strict': True,
        'input_schema': {
            'type': 'object',
            'properties': {
                'pattern': {'type': 'string'},
                'path': {'type': ['string', 'null']},
                'ignore_case': {'type': 'boolean'},
            },
            'required': ['pattern', 'path', 'ignore_case'],
            'additionalProperties': False,
        },
    },
    {
        'name': 'read_file',
        'description': (
            "Read one file at this build, with line numbers. At most 400 lines per call; pass "
            "`start_line` and `end_line` to read around a search hit."
        ),
        'strict': True,
        'input_schema': {
            'type': 'object',
            'properties': {
                'path': {'type': 'string'},
                'start_line': {'type': ['integer', 'null']},
                'end_line': {'type': ['integer', 'null']},
            },
            'required': ['path', 'start_line', 'end_line'],
            'additionalProperties': False,
        },
    },
    {
        'name': 'list_files',
        'description': (
            "List the readable files under a directory at this build. `path` null lists "
            "backend/ and frontend/src/, which is long; prefer a narrower directory."
        ),
        'strict': True,
        'input_schema': {
            'type': 'object',
            'properties': {'path': {'type': ['string', 'null']}},
            'required': ['path'],
            'additionalProperties': False,
        },
    },
]
