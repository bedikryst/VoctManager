"""
===============================================================================
Support Agent — Scoring Against the Golden Set
===============================================================================
Domain: Support
Description:
    Turns agent runs into a verdict against the gate. The golden set itself holds
    real members' reports and stays out of the repository; this module only knows
    its shape (`EvalSet`), and its tests use a synthetic sample.

    A scored row counts as correct only if every one of its runs conveys all of
    `must_say` and makes none of the `must_not_say` claims. A gap flag counts on
    the same terms: every run's note has to point at the shortfall the developer
    later fixed. A harm row (who sees what, actions with consequences) that is not
    correct fails the gate, so abstaining on those rows cannot pass it.

    A run that never produced an answer (API failure, truncation, unparseable
    output) is an error, not a wrong answer: it leaves its row incomplete and
    stays out of the score. A refusal is the model's own output, so it scores as
    a failure and is counted apart.

    Silent rows are reports the agent should not answer. They are scored without
    a judge, from whether the reply is empty, and stay outside the gate.

Standards: SaaS 2026, evaluation-before-tuning.
===============================================================================
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from archive.dtos import CallCost
from archive.infrastructure.ai_client import AIClient, AIModel
from archive.infrastructure.prompts import Prompt
from support.agent import AgentAction, AgentOutcome, AgentRun, NeighbourReport, ReportInput
from support.prompts import GAP_JUDGE, RUBRIC_JUDGE

JUDGE_MODEL = AIModel.SONNET_5_5
JUDGE_MAX_TOKENS = 8000
ONE_LINE_REPLY_MAX_CHARS = 200

Split = Literal['tune', 'sealed']


class JudgeError(Exception):
    """The judge returned a verdict that does not fit the checklist."""


# ---------------------------------------------------------------------------
# The golden set's shape
# ---------------------------------------------------------------------------

class _Row(BaseModel):
    model_config = ConfigDict(extra='forbid')


class NeighbourRow(_Row):
    offset: str
    filed_as: str
    screen: str
    body: str


class ScoredRow(_Row):
    id: str
    split: Split
    sent: str
    filed_as: str
    route: str
    build: str
    harm: bool
    expected_action: AgentAction
    ended_in_commit: bool
    question: str
    must_say: list[str]
    must_not_say: list[str]
    accepts_no_reply: bool = False
    actual_resolution: str
    neighbours: list[NeighbourRow] = []


class SilentRow(_Row):
    id: str
    sent: str
    filed_as: str
    route: str
    build: str
    body: str
    accepts_one_line: bool = False
    neighbours: list[NeighbourRow] = []


class Gate(_Row):
    scored_rows: int
    correct_at_least: int
    wrong_on_harm_rows: int
    gap_flags_at_least: int
    runs_per_row: int


class EvalSet(_Row):
    version: int
    status: str
    reporter_role: str
    gate: Gate
    rows: list[ScoredRow]
    silent_rows: list[SilentRow]


def report_for(row: ScoredRow | SilentRow, reporter_role: str) -> ReportInput:
    """The report as the agent sees it. No reference field ever reaches this object."""
    return ReportInput(
        sent=row.sent,
        filed_as=row.filed_as,
        screen=row.route,
        reporter_role=reporter_role,
        body=row.question if isinstance(row, ScoredRow) else row.body,
        neighbours=tuple(
            NeighbourReport(offset=item.offset, filed_as=item.filed_as, screen=item.screen, body=item.body)
            for item in row.neighbours
        ),
    )


# ---------------------------------------------------------------------------
# The judges
# ---------------------------------------------------------------------------

class MustSayVerdict(BaseModel):
    index: int
    met: bool
    quote: str


class MustNotSayVerdict(BaseModel):
    index: int
    violated: bool
    quote: str


class RubricVerdict(BaseModel):
    must_say: list[MustSayVerdict]
    must_not_say: list[MustNotSayVerdict]


class GapVerdict(BaseModel):
    same_gap: bool
    reason: str


@dataclass
class ItemResult:
    """One checklist item. `holds` means met for must_say and violated for must_not_say."""
    item: str
    holds: bool
    quote: str = ''


@dataclass
class RubricResult:
    must_say: list[ItemResult]
    must_not_say: list[ItemResult]
    cost: Decimal = Decimal('0')

    @property
    def passed(self) -> bool:
        return all(item.holds for item in self.must_say) and not any(item.holds for item in self.must_not_say)


def judge_rubric(judge: AIClient, row: ScoredRow, outcome: AgentOutcome) -> RubricResult:
    """Grade one outcome against the row's checklist. Silence meets nothing and costs nothing."""
    if not outcome.reply.strip() and not outcome.developer_note.strip():
        return RubricResult(
            must_say=[ItemResult(item, False) for item in row.must_say],
            must_not_say=[ItemResult(item, False) for item in row.must_not_say],
        )
    verdict, cost = _ask(judge, RUBRIC_JUDGE, _rubric_content(row, outcome), RubricVerdict)
    return RubricResult(
        must_say=_matched(row.must_say, [(v.index, v.met, v.quote) for v in verdict.must_say]),
        must_not_say=_matched(row.must_not_say, [(v.index, v.violated, v.quote) for v in verdict.must_not_say]),
        cost=cost.total_usd,
    )


def judge_gap(judge: AIClient, row: ScoredRow, outcome: AgentOutcome) -> tuple[bool, str, Decimal]:
    """Whether the developer note points at what the developer later changed."""
    note = outcome.developer_note.strip()
    if not note:
        return False, 'no developer note', Decimal('0')
    content = (
        f'<report>\n{row.question}\n</report>\n'
        f'<agent_note>\n{note}\n</agent_note>\n'
        f'<what_the_developer_did>\n{row.actual_resolution}\n</what_the_developer_did>'
    )
    verdict, cost = _ask(judge, GAP_JUDGE, content, GapVerdict)
    return verdict.same_gap, verdict.reason, cost.total_usd


def _rubric_content(row: ScoredRow, outcome: AgentOutcome) -> str:
    return '\n'.join([
        f'<report>\n{row.question}\n</report>',
        f'<agent_reading>\n{outcome.reading}\n</agent_reading>',
        f'<agent_answer_to_reporter>\n{outcome.reply}\n</agent_answer_to_reporter>',
        f'<agent_note_to_developer>\n{outcome.developer_note}\n</agent_note_to_developer>',
        'MUST_SAY',
        *[f'{index}. {item}' for index, item in enumerate(row.must_say)],
        'MUST_NOT_SAY',
        *[f'{index}. {item}' for index, item in enumerate(row.must_not_say)],
    ])


def _ask[T: BaseModel](judge: AIClient, prompt: Prompt, content: str, schema: type[T]) -> tuple[T, CallCost]:
    return judge.parse(
        model=JUDGE_MODEL,
        prompt=prompt,
        user_content=content,
        output_schema=schema,
        max_tokens=JUDGE_MAX_TOKENS,
    )


def _matched(items: list[str], verdicts: list[tuple[int, bool, str]]) -> list[ItemResult]:
    by_index = {index: (holds, quote) for index, holds, quote in verdicts}
    if sorted(by_index) != list(range(len(items))):
        raise JudgeError(f"Expected verdicts for {len(items)} items, got indices {sorted(by_index)}")
    return [ItemResult(item, *by_index[index]) for index, item in enumerate(items)]


# ---------------------------------------------------------------------------
# Scoring runs
# ---------------------------------------------------------------------------

@dataclass
class RunScore:
    """One graded run: the line written to `results.jsonl`."""
    kind: Literal['scored', 'silent']
    row: str
    rep: int
    split: Split | None
    status: str
    action: str
    expected_action: str | None
    passed: bool
    gap_hit: bool | None
    limit_hit: str | None
    reading: str
    reply: str
    developer_note: str
    must_say: list[ItemResult] = field(default_factory=list)
    must_not_say: list[ItemResult] = field(default_factory=list)
    gap_reason: str = ''
    tool_rounds: int = 0
    tool_calls: int = 0
    elapsed_seconds: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    agent_cost_usd: Decimal = Decimal('0')
    judge_cost_usd: Decimal = Decimal('0')

    def as_json(self) -> dict[str, Any]:
        return asdict(self)


def is_error(run: AgentRun) -> bool:
    """True when the run never produced anything to score."""
    return run.status not in ('ok', 'refusal')


def score_scored_run(judge: AIClient, row: ScoredRow, rep: int, run: AgentRun) -> RunScore:
    score = _base_score('scored', row.id, rep, row.split, row.expected_action, run)
    outcome = run.outcome
    if outcome is None:
        score.must_say = [ItemResult(item, False) for item in row.must_say]
        score.must_not_say = [ItemResult(item, False) for item in row.must_not_say]
        return score
    if row.accepts_no_reply and not outcome.reply.strip():
        score.passed = True
        score.gap_hit = False if row.ended_in_commit else None
        return score
    rubric = judge_rubric(judge, row, outcome)
    score.must_say = rubric.must_say
    score.must_not_say = rubric.must_not_say
    score.passed = rubric.passed
    score.judge_cost_usd += rubric.cost
    if row.ended_in_commit:
        score.gap_hit, score.gap_reason, gap_cost = judge_gap(judge, row, outcome)
        score.judge_cost_usd += gap_cost
    return score


def score_silent_run(row: SilentRow, rep: int, run: AgentRun) -> RunScore:
    score = _base_score('silent', row.id, rep, None, 'no_reply', run)
    if run.outcome is not None:
        reply = run.outcome.reply.strip()
        one_line = '\n' not in reply and len(reply) <= ONE_LINE_REPLY_MAX_CHARS
        score.passed = not reply or (row.accepts_one_line and one_line)
    return score


def _base_score(
    kind: Literal['scored', 'silent'],
    row_id: str,
    rep: int,
    split: Split | None,
    expected_action: str,
    run: AgentRun,
) -> RunScore:
    outcome = run.outcome
    return RunScore(
        kind=kind,
        row=row_id,
        rep=rep,
        split=split,
        status=run.status,
        action=outcome.action if outcome else '',
        expected_action=expected_action,
        passed=False,
        gap_hit=None,
        limit_hit=run.limit_hit,
        reading=outcome.reading if outcome else '',
        reply=outcome.reply if outcome else '',
        developer_note=outcome.developer_note if outcome else '',
        tool_rounds=run.tool_rounds,
        tool_calls=len(run.tool_calls),
        elapsed_seconds=run.elapsed_seconds,
        input_tokens=sum(turn.input_tokens for turn in run.turns),
        output_tokens=sum(turn.output_tokens for turn in run.turns),
        cache_creation_input_tokens=sum(turn.cache_creation_input_tokens for turn in run.turns),
        cache_read_input_tokens=sum(turn.cache_read_input_tokens for turn in run.turns),
        agent_cost_usd=run.cost_usd,
    )


# ---------------------------------------------------------------------------
# The verdict
# ---------------------------------------------------------------------------

@dataclass
class RowVerdict:
    row: str
    split: Split
    harm: bool
    ended_in_commit: bool
    runs_scored: int
    runs_passed: int
    gap_runs_hit: int
    complete: bool
    correct: bool
    gap_flagged: bool
    actions: list[str]
    expected_action: str


@dataclass
class GateVerdict:
    """The gate over the rows that ran. `passed` stays None until every row has run."""
    rows_run: int
    rows_total: int
    rows_incomplete: list[str]
    correct: int
    correct_needed: int
    harm_rows: int
    harm_not_correct: list[str]
    harm_with_false_claim: list[str]
    gap_rows: int
    gap_flagged: int
    gap_needed: int
    passed: bool | None
    still_reachable: bool


def row_verdicts(rows: list[ScoredRow], scores: list[RunScore], runs_per_row: int) -> list[RowVerdict]:
    verdicts = []
    for row in rows:
        runs = [score for score in scores if score.kind == 'scored' and score.row == row.id]
        complete = len(runs) >= runs_per_row
        passed = sum(1 for run in runs if run.passed)
        hit = sum(1 for run in runs if run.gap_hit)
        verdicts.append(RowVerdict(
            row=row.id,
            split=row.split,
            harm=row.harm,
            ended_in_commit=row.ended_in_commit,
            runs_scored=len(runs),
            runs_passed=passed,
            gap_runs_hit=hit,
            complete=complete,
            correct=complete and passed == len(runs),
            gap_flagged=complete and row.ended_in_commit and hit == len(runs),
            actions=[run.action for run in runs],
            expected_action=row.expected_action,
        ))
    return verdicts


def gate_verdict(eval_set: EvalSet, verdicts: list[RowVerdict], scores: list[RunScore]) -> GateVerdict:
    """Apply the gate. Rows that have not run count as possible when judging reachability."""
    ran = [verdict for verdict in verdicts if verdict.runs_scored > 0]
    complete = [verdict for verdict in ran if verdict.complete]
    unrun = eval_set.gate.scored_rows - len(complete)
    correct = sum(1 for verdict in complete if verdict.correct)
    harm = [verdict for verdict in complete if verdict.harm]
    harm_not_correct = [verdict.row for verdict in harm if not verdict.correct]
    gap_rows = [verdict for verdict in complete if verdict.ended_in_commit]
    gap_flagged = sum(1 for verdict in gap_rows if verdict.gap_flagged)
    unrun_gap_rows = sum(1 for row in eval_set.rows if row.ended_in_commit) - len(gap_rows)
    harm_allowed = len(harm_not_correct) <= eval_set.gate.wrong_on_harm_rows
    reachable = (
        correct + unrun >= eval_set.gate.correct_at_least
        and gap_flagged + unrun_gap_rows >= eval_set.gate.gap_flags_at_least
        and harm_allowed
    )
    finished = unrun == 0
    return GateVerdict(
        rows_run=len(ran),
        rows_total=eval_set.gate.scored_rows,
        rows_incomplete=[verdict.row for verdict in ran if not verdict.complete],
        correct=correct,
        correct_needed=eval_set.gate.correct_at_least,
        harm_rows=len(harm),
        harm_not_correct=harm_not_correct,
        harm_with_false_claim=sorted({
            score.row
            for score in scores
            if score.kind == 'scored'
            and score.row in {verdict.row for verdict in harm}
            and any(item.holds for item in score.must_not_say)
        }),
        gap_rows=len(gap_rows),
        gap_flagged=gap_flagged,
        gap_needed=eval_set.gate.gap_flags_at_least,
        passed=reachable if finished else None,
        still_reachable=reachable,
    )


# ---------------------------------------------------------------------------
# Controls: is the judge able to tell good from bad?
# ---------------------------------------------------------------------------

@dataclass
class ControlResult:
    row: str
    oracle_passed: bool
    oracle_gap_hit: bool | None
    null_passed: bool
    null_gap_hit: bool | None
    off_topic_gap_hit: bool | None
    wrong_passed: bool
    wrong_false_claim_found: bool
    cost_usd: Decimal

    @property
    def as_expected(self) -> bool:
        return (
            self.oracle_passed
            and self.oracle_gap_hit is not False
            and not self.null_passed
            and not self.null_gap_hit
            and not self.off_topic_gap_hit
            and not self.wrong_passed
            and self.wrong_false_claim_found
        )


def run_control(judge: AIClient, row: ScoredRow) -> ControlResult:
    """Grade the reference itself, a non-answer and the forbidden claims. Calls no agent."""
    oracle = AgentOutcome(
        reading='', action=row.expected_action, reply='\n'.join(row.must_say),
        developer_note=(
            f'The reporter wrote: {row.question}\nThe app falls short of this, and needs what this change '
            f'provides: {row.actual_resolution}'
        ),
    )
    null = AgentOutcome(
        reading='', action='answer', reply='Nie wiem, proszę napisać do administratora.', developer_note='',
    )
    wrong = AgentOutcome(reading='', action='answer', reply='\n'.join(row.must_not_say), developer_note='')
    off_topic = AgentOutcome(
        reading='', action='answer', reply='', developer_note='The app has no dark theme in the settings.',
    )
    oracle_rubric = judge_rubric(judge, row, oracle)
    null_rubric = judge_rubric(judge, row, null)
    wrong_rubric = judge_rubric(judge, row, wrong)
    cost = oracle_rubric.cost + null_rubric.cost + wrong_rubric.cost
    oracle_gap: bool | None = None
    null_gap: bool | None = None
    off_topic_gap: bool | None = None
    if row.ended_in_commit:
        oracle_gap, _, oracle_gap_cost = judge_gap(judge, row, oracle)
        null_gap, _, _ = judge_gap(judge, row, null)
        off_topic_gap, _, off_topic_cost = judge_gap(judge, row, off_topic)
        cost += oracle_gap_cost + off_topic_cost
    return ControlResult(
        row=row.id,
        oracle_passed=oracle_rubric.passed,
        oracle_gap_hit=oracle_gap,
        null_passed=null_rubric.passed,
        null_gap_hit=null_gap,
        off_topic_gap_hit=off_topic_gap,
        wrong_passed=wrong_rubric.passed,
        wrong_false_claim_found=any(item.holds for item in wrong_rubric.must_not_say),
        cost_usd=cost,
    )


def nearest_rank(values: list[float], fraction: float) -> float:
    """Percentile by nearest rank: with a few dozen runs it stays an observed value."""
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[max(1, math.ceil(len(ordered) * fraction)) - 1]
