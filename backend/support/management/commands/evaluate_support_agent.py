"""
===============================================================================
Support Agent — Evaluation Harness
===============================================================================
Domain: Support
Description:
    Runs the support agent over a golden set and applies the gate.

    Usage, from the repo root on the machine that holds the git history:
        python backend/manage.py evaluate_support_agent <eval_set.json>
            --settings=config.test_settings_sqlite
            [--split tune|sealed|all] [--rows q01,q07] [--runs N] [--controls] [--rejudge]
            [--model claude-haiku-5-5] [--effort high] [--workers 4] [--budget-usd 20] [--out DIR]
            [--runner api|cli] [--claude-bin PATH] [--config-dir DIR]

    The tools need the repository's `.git`, so this runs on a checkout and not in
    the containers. Host-side settings do not read the root `.env`, so the key is
    taken from there when they hold none. No database is touched.

    `tune` is the default. Sealed rows run only when asked for by name, because
    their results are read once, after the prompt and tools are frozen; `run.json`
    records the prompt versions they ran under.

    `--controls` calls no agent. It grades each row's own reference, a non-answer
    and the row's forbidden claims, and shows whether the judge can tell them apart.
    Run it before spending money on the agent.

    `--rejudge` calls no agent either. It grades the stored runs of the selected rows
    again, from their transcripts, after a checklist changed. What it replaces stays
    beside them in `results.before-rejudge.jsonl`.

    The output folder holds `results.jsonl`, `errors.jsonl`, `summary.json` and one
    transcript per run. It contains real reports, so it belongs in a git-ignored
    location. Passing an existing folder resumes it: finished runs are kept, runs
    that ended in an error run again, and a run where only the judge failed is
    graded again from its transcript.

    NOTE: under `--runner api`, the default, every run is a REAL, BILLED Anthropic
    call, outside the pipeline's budget counters. `--budget-usd` stops starting new
    runs once it is spent. Under `--runner cli` the runs go through `claude -p` on a
    subscription (see `support.cli_runner`): the dollar figures are what the API
    would charge, nothing is charged, and `--config-dir` picks the account.

Standards: SaaS 2026, evaluation-before-tuning.
===============================================================================
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import anthropic
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from archive.infrastructure.ai_client import AIClient, AIModel
from support.agent import (
    AgentConfig,
    AgentOutcome,
    AgentRun,
    ReportInput,
    ToolCallRecord,
    TurnRecord,
    run_support_agent,
)
from support.cli_runner import (
    CliJudge,
    CliJudgeError,
    CliOptions,
    claude_version,
    find_claude_binary,
    run_support_agent_cli,
)
from support.code_reader import CODE_TOOLS, CodeReader
from support.evaluation import (
    JUDGE_MODEL,
    EvalSet,
    ItemResult,
    JudgeError,
    RunScore,
    ScoredRow,
    SilentRow,
    gate_verdict,
    is_error,
    nearest_rank,
    report_for,
    row_verdicts,
    run_control,
    score_scored_run,
    score_silent_run,
)
from support.prompts import GAP_JUDGE, RUBRIC_JUDGE, SUPPORT_AGENT

# Long enough to measure real latency. The production values come from this run's p95.
EVAL_REQUEST_TIMEOUT_SECONDS = 180.0
EVAL_MAX_RETRIES = 4


@dataclass(frozen=True)
class _Route:
    """Where the agent and its judges run, and whether their dollar figures are real."""
    name: str
    judge: AIClient
    agent: Callable[[ReportInput, CodeReader], AgentRun]
    charged: bool
    client_version: str = ''


class Command(BaseCommand):
    help = "Run the support agent over a golden set and apply the gate. Billed unless --runner cli."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument('eval_set', type=Path)
        parser.add_argument('--split', choices=['tune', 'sealed', 'all'], default='tune')
        parser.add_argument('--rows', default='', help="Comma-separated row ids, e.g. q01,n17.")
        parser.add_argument('--runs', type=int, default=0, help="Runs per row; 0 takes the gate's value.")
        parser.add_argument('--controls', action='store_true', help="Test the judge only; calls no agent.")
        parser.add_argument('--rejudge', action='store_true', help="Grade the runs stored in --out again.")
        parser.add_argument('--runner', choices=['api', 'cli'], default='api')
        parser.add_argument('--claude-bin', type=Path, default=None, help="Default: PATH, then the VS Code extension.")
        parser.add_argument('--config-dir', type=Path, default=None, help="CLAUDE_CONFIG_DIR of the account to use.")
        parser.add_argument(
            '--model',
            choices=[AIModel.OPUS_5_5, AIModel.SONNET_5_5, AIModel.HAIKU_5_5],
            default=AIModel.OPUS_5_5,
        )
        parser.add_argument('--effort', default='high')
        parser.add_argument('--workers', type=int, default=4)
        parser.add_argument('--budget-usd', type=Decimal, default=Decimal('20'))
        parser.add_argument('--out', type=Path, default=None)

    def handle(self, *args: Any, **options: Any) -> None:
        # The host console is cp1250: a Polish reply printed there would kill a run already paid for.
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        path: Path = options['eval_set']
        if not path.exists():
            raise CommandError(f"No eval set at {path}")
        eval_set = EvalSet.model_validate_json(path.read_text(encoding='utf-8'))
        repo = Path(settings.BASE_DIR).parent
        scored, silent = _selected(eval_set, options['split'], options['rows'])
        config = AgentConfig(model=options['model'], effort=options['effort'])
        route = _route(options, repo, config)
        if options['controls']:
            self._run_controls(route.judge, scored)
            return
        if options['rejudge'] and options['out'] is None:
            raise CommandError("--rejudge needs --out, the folder holding the stored runs.")
        runs_per_row = options['runs'] or eval_set.gate.runs_per_row
        out = options['out'] or repo / 'tmp' / 'agent-options' / 'eval' / _folder_name(options['split'])
        session = _Session(
            command=self,
            eval_set=eval_set,
            repo=repo,
            out=out,
            route=route,
            config=config,
            budget=options['budget_usd'],
        )
        if options['rejudge']:
            session.rejudge(scored)
            session.report(_selected(eval_set, options['split'], '')[0], runs_per_row)
            return
        session.write_run_header(path, options['split'], runs_per_row)
        # An empty API account or a rejected request ends the runs, and what was paid for still gets reported.
        try:
            session.run(scored, silent, runs_per_row, options['workers'])
        finally:
            session.report(scored, runs_per_row)

    def _run_controls(self, judge: AIClient, rows: list[ScoredRow]) -> None:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda row: run_control(judge, row), rows))
        self.stdout.write(
            f"{'row':<5}{'oracle':<8}{'gap':<7}{'null':<7}{'gap':<7}{'off-gap':<9}{'wrong':<7}{'claim':<7}ok"
        )
        for result in results:
            self.stdout.write(
                f"{result.row:<5}{_mark(result.oracle_passed):<8}{_mark(result.oracle_gap_hit):<7}"
                f"{_mark(result.null_passed):<7}{_mark(result.null_gap_hit):<7}{_mark(result.off_topic_gap_hit):<9}"
                f"{_mark(result.wrong_passed):<7}{_mark(result.wrong_false_claim_found):<7}"
                f"{_mark(result.as_expected)}"
            )
        spent = sum((result.cost_usd for result in results), Decimal('0'))
        good = sum(1 for result in results if result.as_expected)
        self.stdout.write(f"As expected: {good} of {len(results)}. Judge spend: ${spent:.3f}")


class _Session:
    """One evaluation: the runs still to do, and everything written about them."""

    def __init__(
        self,
        *,
        command: Command,
        eval_set: EvalSet,
        repo: Path,
        out: Path,
        route: _Route,
        config: AgentConfig,
        budget: Decimal,
    ) -> None:
        self.command = command
        self.eval_set = eval_set
        self.repo = repo
        self.out = out
        self.route = route
        self.config = config
        self.budget = budget
        self.lock = threading.Lock()
        self.spent = Decimal('0')
        self.skipped = 0
        self.scores: list[RunScore] = []
        (out / 'transcripts').mkdir(parents=True, exist_ok=True)
        self.done = self._load_finished()

    def write_run_header(self, eval_set_path: Path, split: str, runs_per_row: int) -> None:
        header = {
            'started_at': datetime.now(UTC).isoformat(),
            'eval_set': str(eval_set_path),
            'eval_set_status': self.eval_set.status,
            'split': split,
            'runs_per_row': runs_per_row,
            'runner': self.route.name,
            'client_version': self.route.client_version,
            'model': self.config.model,
            'effort': self.config.effort,
            'judge_model': JUDGE_MODEL,
            'limits': {
                'max_tool_rounds': self.config.max_tool_rounds,
                'deadline_seconds': self.config.deadline_seconds,
                'max_cost_usd': str(self.config.max_cost_usd),
            },
            'prompts': [SUPPORT_AGENT.version, RUBRIC_JUDGE.version, GAP_JUDGE.version],
            'tools_sha': hashlib.sha256(json.dumps(CODE_TOOLS, sort_keys=True).encode()).hexdigest()[:12],
            'head': subprocess.run(
                ['git', '-C', str(self.repo), 'rev-parse', 'HEAD'],
                capture_output=True, encoding='utf-8', check=True,
            ).stdout.strip(),
        }
        (self.out / 'run.json').write_text(json.dumps(header, indent=1), encoding='utf-8')

    def run(self, scored: list[ScoredRow], silent: list[SilentRow], runs_per_row: int, workers: int) -> None:
        rows: list[ScoredRow | SilentRow] = [*scored, *silent]
        pending = [
            (row, rep)
            for row in rows
            for rep in range(1, runs_per_row + 1)
            if (row.id, rep) not in self.done
        ]
        self.command.stdout.write(f"{len(pending)} runs to do, {len(self.done)} already finished, in {self.out}")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(self._one_run, row, rep) for row, rep in pending]
            try:
                for future in futures:
                    future.result()
            except Exception:
                pool.shutdown(cancel_futures=True)
                raise

    def _one_run(self, row: ScoredRow | SilentRow, rep: int) -> None:
        with self.lock:
            if self.route.charged and self.spent >= self.budget:
                self.skipped += 1
                return
        # An answer on disk with no result line means only its judge failed.
        run = self._stored_run(row.id, rep)
        if run is None:
            reader = CodeReader(self.repo, row.build)
            report = report_for(row, self.eval_set.reporter_role)
            run = self.route.agent(report, reader)
            self._write_transcript(row.id, rep, run)
        if is_error(run):
            with self.lock:
                self.spent += run.cost_usd
                _append(self.out / 'errors.jsonl', {
                    'row': row.id, 'rep': rep, 'status': run.status, 'error': run.error,
                    'agent_cost_usd': run.cost_usd,
                })
            self.command.stdout.write(f"  {row.id}#{rep} ERROR {run.status}: {run.error}")
            return
        try:
            if isinstance(row, ScoredRow):
                score = score_scored_run(self.route.judge, row, rep, run)
            else:
                score = score_silent_run(row, rep, run)
        except (CliJudgeError, JudgeError) as exc:
            with self.lock:
                _append(self.out / 'errors.jsonl', {
                    'row': row.id, 'rep': rep, 'status': 'judge_error', 'error': str(exc),
                    'agent_cost_usd': run.cost_usd,
                })
            self.command.stdout.write(f"  {row.id}#{rep} JUDGE ERROR: {exc}")
            return
        with self.lock:
            self.spent += score.agent_cost_usd + score.judge_cost_usd
            self.scores.append(score)
            _append(self.out / 'results.jsonl', score.as_json())
            spent = self.spent
        self.command.stdout.write(
            f"  {row.id}#{rep} {_mark(score.passed)} action={score.action} rounds={score.tool_rounds} "
            f"{score.elapsed_seconds:.0f}s ${score.agent_cost_usd:.3f} (total ${spent:.2f}) "
            f"{_windows(run.usage_windows)}"
        )

    def rejudge(self, rows: list[ScoredRow]) -> None:
        """Grade the selected rows' stored runs again. Their answers and measurements stay as they were."""
        results = self.out / 'results.jsonl'
        if not results.exists():
            raise CommandError(f"No stored runs in {self.out}")
        before = self.out / 'results.before-rejudge.jsonl'
        if not before.exists():
            shutil.copyfile(results, before)
        by_id = {row.id: row for row in rows}
        graded: list[RunScore] = []
        for old in self.scores:
            row = by_id.get(old.row)
            run = self._stored_run(old.row, old.rep) if row else None
            if row is None or run is None:
                graded.append(old)
                continue
            score = score_scored_run(self.route.judge, row, old.rep, run)
            score.elapsed_seconds = old.elapsed_seconds
            graded.append(score)
            self.command.stdout.write(
                f"  {old.row}#{old.rep} passed {_mark(old.passed)} -> {_mark(score.passed)}, "
                f"gap {_mark(old.gap_hit)} -> {_mark(score.gap_hit)}"
            )
        self.scores = graded
        self.spent = sum((score.agent_cost_usd + score.judge_cost_usd for score in graded), Decimal('0'))
        results.write_text(
            ''.join(json.dumps(score.as_json(), ensure_ascii=False, default=str) + '\n' for score in graded),
            encoding='utf-8',
        )

    def report(self, scored: list[ScoredRow], runs_per_row: int) -> None:
        verdicts = row_verdicts(scored, self.scores, runs_per_row)
        gate = gate_verdict(self.eval_set, verdicts, self.scores)
        silent_scores = [score for score in self.scores if score.kind == 'silent']
        perf = _performance(self.scores)
        summary: dict[str, Any] = {
            'gate': asdict(gate),
            'rows': [asdict(verdict) for verdict in verdicts],
            'silent': {
                'runs': len(silent_scores),
                'passed': sum(1 for score in silent_scores if score.passed),
                'answered': sorted({score.row for score in silent_scores if not score.passed}),
            },
            'performance': perf,
            'refusals': sum(1 for score in self.scores if score.status == 'refusal'),
            'budget_skipped_runs': self.skipped,
            'spent_usd': self.spent,
        }
        (self.out / 'summary.json').write_text(json.dumps(summary, indent=1, default=str), encoding='utf-8')
        write = self.command.stdout.write
        write(f"\n{'row':<5}{'split':<8}{'harm':<6}{'runs':<7}{'gap':<6}{'actions (expected)'}")
        for verdict in verdicts:
            gap = f"{verdict.gap_runs_hit}/{verdict.runs_scored}" if verdict.ended_in_commit else '-'
            write(
                f"{verdict.row:<5}{verdict.split:<8}{'yes' if verdict.harm else '':<6}"
                f"{verdict.runs_passed}/{verdict.runs_scored:<5}{gap:<6}"
                f"{','.join(verdict.actions)} ({verdict.expected_action})"
            )
        write(f"\nCorrect rows: {gate.correct} of {gate.rows_run} run; the gate wants {gate.correct_needed} of "
              f"{gate.rows_total}.")
        write(f"Harm rows not correct: {gate.harm_not_correct or 'none'} of {gate.harm_rows}; "
              f"with a false claim: {gate.harm_with_false_claim or 'none'}.")
        write(f"Gap flags: {gate.gap_flagged} of {gate.gap_rows} run; the gate wants {gate.gap_needed} of "
              f"{sum(1 for row in self.eval_set.rows if row.ended_in_commit)}.")
        write(f"Silent rows: {summary['silent']['passed']} of {summary['silent']['runs']} runs stayed silent; "
              f"answered: {summary['silent']['answered'] or 'none'}.")
        if gate.rows_incomplete:
            write(f"Incomplete rows, not scored: {gate.rows_incomplete}")
        verdict_line = {True: 'PASSED', False: 'FAILED', None: 'not decided, rows still to run'}[gate.passed]
        write(f"Gate: {verdict_line}. Still reachable: {gate.still_reachable}.")
        write(f"Per run: {perf['seconds_p50']:.0f}s p50, {perf['seconds_p95']:.0f}s p95; "
              f"{perf['rounds_p95']:.0f} rounds p95; ${perf['agent_cost_mean']:.3f} mean, "
              f"${perf['agent_cost_p95']:.3f} p95. Cache reads {perf['cache_read_share']:.0%} of input.")
        spent_label = 'Spent' if self.route.charged else 'API equivalent, nothing charged'
        write(f"{spent_label}: ${self.spent:.2f} (judges ${perf['judge_cost_total']:.2f}). "
              f"Skipped for budget: {self.skipped}. Results in {self.out}")

    def _load_finished(self) -> set[tuple[str, int]]:
        path = self.out / 'results.jsonl'
        if not path.exists():
            return set()
        finished: set[tuple[str, int]] = set()
        for line in path.read_text(encoding='utf-8').splitlines():
            score = _score_from_json(json.loads(line))
            self.scores.append(score)
            self.spent += score.agent_cost_usd + score.judge_cost_usd
            finished.add((score.row, score.rep))
        return finished

    def _stored_run(self, row_id: str, rep: int) -> AgentRun | None:
        """A run from its transcript, if that run produced an answer."""
        path = self.out / 'transcripts' / f'{row_id}-{rep}.json'
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding='utf-8'))
        if payload['outcome'] is None:
            return None
        return AgentRun(
            status=payload['status'],
            outcome=AgentOutcome(**payload['outcome']),
            limit_hit=payload['limit_hit'],
            error=payload['error'],
            elapsed_seconds=payload.get('elapsed_seconds', 0.0),
            turns=[TurnRecord(**{**turn, 'cost_usd': Decimal(turn['cost_usd'])}) for turn in payload['turns']],
            tool_calls=[ToolCallRecord(**call) for call in payload['tool_calls']],
            transcript=payload['transcript'],
        )

    def _write_transcript(self, row_id: str, rep: int, run: AgentRun) -> None:
        payload = {
            'status': run.status,
            'error': run.error,
            'limit_hit': run.limit_hit,
            'elapsed_seconds': run.elapsed_seconds,
            'usage_windows': run.usage_windows,
            'outcome': run.outcome.model_dump() if run.outcome else None,
            'turns': [asdict(turn) for turn in run.turns],
            'tool_calls': [asdict(call) for call in run.tool_calls],
            'transcript': run.transcript,
        }
        (self.out / 'transcripts' / f'{row_id}-{rep}.json').write_text(
            json.dumps(payload, ensure_ascii=False, indent=1, default=str), encoding='utf-8',
        )


def _selected(eval_set: EvalSet, split: str, rows: str) -> tuple[list[ScoredRow], list[SilentRow]]:
    scored = [row for row in eval_set.rows if split == 'all' or row.split == split]
    # Silent rows hold no sealed reference, and they belong with the tuning work.
    silent = [] if split == 'sealed' else list(eval_set.silent_rows)
    if rows:
        wanted = {item.strip() for item in rows.split(',') if item.strip()}
        known = {row.id for row in scored} | {row.id for row in silent}
        if wanted - known:
            raise CommandError(f"Not in the {split} split: {sorted(wanted - known)}")
        scored = [row for row in scored if row.id in wanted]
        silent = [row for row in silent if row.id in wanted]
    return scored, silent


def _route(options: dict[str, Any], repo: Path, config: AgentConfig) -> _Route:
    if options['runner'] == 'cli':
        binary = options['claude_bin'] or find_claude_binary()
        if binary is None or not binary.exists():
            raise CommandError("No claude binary found: pass --claude-bin.")
        cli = CliOptions(binary=binary, repo=repo, config_dir=options['config_dir'])
        return _Route(
            name='cli',
            judge=CliJudge(cli),
            agent=lambda report, reader: run_support_agent_cli(
                report=report, reader=reader, options=cli, config=config,
            ),
            charged=False,
            client_version=claude_version(cli),
        )
    api_key = _api_key(repo)
    client = anthropic.Anthropic(api_key=api_key, timeout=EVAL_REQUEST_TIMEOUT_SECONDS, max_retries=EVAL_MAX_RETRIES)
    return _Route(
        name='api',
        judge=AIClient(api_key=api_key),
        agent=lambda report, reader: run_support_agent(report=report, reader=reader, client=client, config=config),
        charged=True,
    )


def _windows(usage: dict[str, float]) -> str:
    return ' '.join(f'{window} {share:.0%}' for window, share in usage.items())


def _api_key(repo: Path) -> str:
    key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
    env_file = repo / '.env'
    if not key and env_file.exists():
        match = re.search(r'^ANTHROPIC_API_KEY=(.*)$', env_file.read_text(encoding='utf-8'), re.MULTILINE)
        key = match.group(1).strip().strip('"\'') if match else ''
    if not key:
        raise CommandError("ANTHROPIC_API_KEY is not configured: nothing was called.")
    return key


def _folder_name(split: str) -> str:
    return f"{datetime.now(UTC):%Y%m%d-%H%M%S}-{split}"


def _append(path: Path, record: dict[str, Any]) -> None:
    with path.open('a', encoding='utf-8') as file:
        file.write(json.dumps(record, ensure_ascii=False, default=str) + '\n')


def _score_from_json(record: dict[str, Any]) -> RunScore:
    record = dict(record)
    record['must_say'] = [ItemResult(**item) for item in record['must_say']]
    record['must_not_say'] = [ItemResult(**item) for item in record['must_not_say']]
    record['agent_cost_usd'] = Decimal(record['agent_cost_usd'])
    record['judge_cost_usd'] = Decimal(record['judge_cost_usd'])
    return RunScore(**record)


def _performance(scores: list[RunScore]) -> dict[str, float]:
    seconds = [score.elapsed_seconds for score in scores]
    rounds = [float(score.tool_rounds) for score in scores]
    costs = [float(score.agent_cost_usd) for score in scores]
    cached = sum(score.cache_read_input_tokens for score in scores)
    written = sum(score.cache_creation_input_tokens for score in scores)
    fresh = sum(score.input_tokens for score in scores)
    return {
        'seconds_p50': nearest_rank(seconds, 0.5),
        'seconds_p95': nearest_rank(seconds, 0.95),
        'rounds_p95': nearest_rank(rounds, 0.95),
        'agent_cost_mean': sum(costs) / len(costs) if costs else 0.0,
        'agent_cost_p95': nearest_rank(costs, 0.95),
        'judge_cost_total': float(sum((score.judge_cost_usd for score in scores), Decimal('0'))),
        'cache_read_share': cached / (cached + written + fresh) if cached + written + fresh else 0.0,
    }


def _mark(value: bool | None) -> str:
    return {True: 'yes', False: 'no', None: '-'}[value]
