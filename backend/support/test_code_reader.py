"""
===============================================================================
Support Agent — Tests: Read-Only Code Access
===============================================================================
Domain: Support
Description:
    Runs the reader against a throwaway git repository with two commits. The
    point under test is isolation: the agent sees one commit, and only the
    allowed part of it.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest import skipUnless

from django.test import SimpleTestCase

from support.code_reader import MAX_GREP_LINES, MAX_LINE_CHARS, CodeReader, CodeReaderError


def _git(repo: Path, *arguments: str) -> str:
    identity = ['-c', 'user.name=test', '-c', 'user.email=test@example.com']
    result = subprocess.run(
        ['git', '-C', str(repo), *identity, *arguments],
        capture_output=True, encoding='utf-8', check=True,
    )
    return result.stdout.strip()


def _write(repo: Path, path: str, text: str) -> None:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


@skipUnless(shutil.which('git'), 'git is not available')
class CodeReaderTests(SimpleTestCase):
    _folder: tempfile.TemporaryDirectory[str]
    repo: Path
    first: str
    reader: CodeReader

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls._folder = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        cls.repo = Path(cls._folder.name)
        _git(cls.repo, 'init', '-q')
        _write(cls.repo, 'backend/roster/views.py', 'def old_name():\n    return "Otwórz odprawę"\n')
        _write(cls.repo, 'backend/roster/migrations/0001_initial.py', 'old_name = 1\n')
        _write(cls.repo, 'frontend/src/shared/config/locales/pl/translation.json', '{"a": "old_name"}\n')
        _write(cls.repo, 'frontend/src/shared/config/locales/en/translation.json', '{"a": "old_name"}\n')
        _write(cls.repo, 'frontend/public/sw.ts', 'old_name\n')
        _write(cls.repo, 'backend/notes.txt', 'old_name\n')
        _write(cls.repo, '.env', 'SECRET=old_name\n')
        many = ''.join(f'needle_{number}\n' for number in range(MAX_GREP_LINES + 5))
        _write(cls.repo, 'backend/roster/many.py', many)
        _write(cls.repo, 'backend/roster/wide.py', f'wide_line = "{"x" * (MAX_LINE_CHARS + 50)}"\n')
        _git(cls.repo, 'add', '-A')
        _git(cls.repo, 'commit', '-q', '-m', 'first')
        cls.first = _git(cls.repo, 'rev-parse', 'HEAD')
        _write(cls.repo, 'backend/roster/views.py', 'def new_name():\n    return 1\n')
        _write(cls.repo, 'backend/roster/added_later.py', 'new_name = 2\n')
        _git(cls.repo, 'add', '-A')
        _git(cls.repo, 'commit', '-q', '-m', 'second')
        cls.reader = CodeReader(cls.repo, cls.first[:10])

    @classmethod
    def tearDownClass(cls) -> None:
        cls._folder.cleanup()
        super().tearDownClass()

    def test_search_sees_the_commit_and_never_a_later_one(self) -> None:
        self.assertIn('backend/roster/views.py:1:def old_name', self.reader.grep('old_name'))
        self.assertEqual(self.reader.grep('new_name'), 'No matches at this build.')

    def test_search_leaves_out_noise_and_everything_outside_the_allowlist(self) -> None:
        result = self.reader.grep('old_name')
        self.assertIn('locales/pl/translation.json', result)
        for absent in ('migrations', 'locales/en', 'frontend/public', 'notes.txt', '.env'):
            self.assertNotIn(absent, result)

    def test_search_takes_polish_words(self) -> None:
        self.assertIn('views.py:2', self.reader.grep('Otwórz odprawę'))

    def test_search_output_carries_no_commit_prefix(self) -> None:
        self.assertNotIn(self.reader.commit, self.reader.grep('old_name'))

    def test_a_pattern_cannot_become_a_git_option(self) -> None:
        self.assertEqual(self.reader.grep('--all-match'), 'No matches at this build.')

    def test_a_broken_pattern_is_a_tool_error(self) -> None:
        with self.assertRaises(CodeReaderError):
            self.reader.grep('(unclosed')

    def test_search_narrows_to_a_directory_or_a_file(self) -> None:
        self.assertNotIn('translation.json', self.reader.grep('old_name', 'backend/roster'))
        self.assertIn('views.py', self.reader.grep('old_name', 'backend/roster/views.py'))

    def test_long_results_are_capped_and_say_so(self) -> None:
        result = self.reader.grep('needle_')
        self.assertEqual(len(result.splitlines()), MAX_GREP_LINES + 1)
        self.assertIn('5 more not shown', result)
        self.assertIn('[line cut]', self.reader.grep('wide_line'))

    def test_read_returns_numbered_lines_of_the_old_version(self) -> None:
        result = self.reader.read_file('backend/roster/views.py', 2, 2)
        self.assertIn('lines 2-2 of 2', result)
        self.assertIn('2\t    return "Otwórz odprawę"', result)

    def test_read_refuses_what_is_outside_the_allowlist(self) -> None:
        for path in (
            '.env',
            'backend/notes.txt',
            'frontend/public/sw.ts',
            'backend/../.env',
            '/etc/passwd',
            'backend\\roster\\views.py',
            'backend/roster/views.py:x',
        ):
            with self.subTest(path=path), self.assertRaises(CodeReaderError):
                self.reader.read_file(path)

    def test_a_file_added_later_does_not_exist_yet(self) -> None:
        with self.assertRaises(CodeReaderError):
            self.reader.read_file('backend/roster/added_later.py')

    def test_list_stays_inside_the_roots(self) -> None:
        self.assertIn('backend/roster/views.py', self.reader.list_files('backend/roster'))
        self.assertNotIn('added_later', self.reader.list_files('backend/roster'))
        with self.assertRaises(CodeReaderError):
            self.reader.list_files('frontend/public')

    def test_only_a_commit_id_is_accepted(self) -> None:
        for commit in ('HEAD', '--all', 'master', 'abc'):
            with self.subTest(commit=commit), self.assertRaises(CodeReaderError):
                CodeReader(self.repo, commit)

    def test_tool_dispatch_takes_nulls_and_rejects_unknown_names(self) -> None:
        self.assertIn('views.py', self.reader.run_tool(
            'grep_code', {'pattern': 'old_name', 'path': None, 'ignore_case': False},
        ))
        self.assertIn('lines 1-2', self.reader.run_tool(
            'read_file', {'path': 'backend/roster/views.py', 'start_line': None, 'end_line': None},
        ))
        with self.assertRaises(CodeReaderError):
            self.reader.run_tool('git_log', {})
