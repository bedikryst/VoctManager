"""
===============================================================================
Support Agent — Scoring Against the Golden Set
===============================================================================
Domain: Support
Description:
    Turns agent runs into a verdict against the gate. The golden set itself holds
    real members' reports and stays out of the repository; this module only knows
    its shape (`EvalSet`), and its tests use a synthetic sample.

    The gate has a hard part and a quality part, both over the selected rows. Hard:
    no run makes a `must_not_say` claim; every run on a harm row (who sees what,
    actions with consequences for others) conveys that row's critical `must_say`
    items; every reply is in the report's language and shows no gender
    (`reply_form`). A harm row with no items marked critical is held to all of
    them. Quality: the `must_say` items met, pooled over every run, reach the
    gate's percentage, so an agent that abstains cannot pass.

    A row counts as correct when every run conveys all of `must_say` and makes
    none of the `must_not_say` claims, and as gap-flagged when every run's note
    points at the shortfall the developer later fixed. Both are reported beside
    the gate, not in it.

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
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator

from archive.dtos import CallCost
from archive.infrastructure.ai_client import AIClient, AIModel
from archive.infrastructure.prompts import Prompt
from support.agent import AgentAction, AgentOutcome, AgentRun, NeighbourReport, ReportInput
from support.prompts import GAP_JUDGE, RUBRIC_JUDGE
from support.reply_form import gendered_forms, in_language_of

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
    critical_must_say: list[int] = []
    accepts_no_reply: bool = False
    actual_resolution: str
    neighbours: list[NeighbourRow] = []

    @model_validator(mode='after')
    def _critical_items_index_must_say(self) -> Self:
        if self.critical_must_say and not self.harm:
            raise ValueError(f"{self.id}: only a harm row marks critical items")
        indices = self.critical_must_say
        if len(set(indices)) != len(indices) or not all(0 <= index < len(self.must_say) for index in indices):
            raise ValueError(f"{self.id}: critical_must_say {indices} does not index must_say")
        return self

    @property
    def critical_items(self) -> list[str]:
        """The `must_say` items the hard gate holds every run to."""
        if not self.harm:
            return []
        if not self.critical_must_say:
            return list(self.must_say)
        return [self.must_say[index] for index in self.critical_must_say]


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
    runs_per_row: int
    must_say_percent_at_least: int


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
    runs_owed: int
    runs_passed: int
    gap_runs_hit: int
    complete: bool
    correct: bool
    gap_flagged: bool
    must_say_met: int
    must_say_total: int
    actions: list[str]
    expected_action: str


@dataclass
class GateVerdict:
    """The gate over the selected rows. `passed` stays None until every one of them has run."""
    rows_run: int
    rows_total: int
    rows_incomplete: list[str]
    false_claims: list[str]
    critical_missed: list[str]
    wrong_language: list[str]
    gendered: list[str]
    must_say_met: int
    must_say_total: int
    must_say_percent_needed: int
    correct: int
    gap_rows: int
    gap_flagged: int
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
            runs_owed=max(0, runs_per_row - len(runs)),
            runs_passed=passed,
            gap_runs_hit=hit,
            complete=complete,
            correct=complete and passed == len(runs),
            gap_flagged=complete and row.ended_in_commit and hit == len(runs),
            must_say_met=sum(1 for run in runs for item in run.must_say if item.holds),
            must_say_total=sum(len(run.must_say) for run in runs),
            actions=[run.action for run in runs],
            expected_action=row.expected_action,
        ))
    return verdicts


def gate_verdict(gate: Gate, rows: list[ScoredRow], verdicts: list[RowVerdict], scores: list[RunScore]) -> GateVerdict:
    """Apply the gate to the selected rows. Runs still owed count as meeting everything when judging reachability."""
    by_id = {row.id: row for row in rows}
    false_claims: list[str] = []
    critical_missed: list[str] = []
    wrong_language: list[str] = []
    gendered: list[str] = []
    for score in scores:
        row = by_id.get(score.row)
        if score.kind != 'scored' or row is None:
            continue
        label = f'{score.row}#{score.rep}'
        critical = set(row.critical_items)
        false_claims += [f'{label}: {item.item}' for item in score.must_not_say if item.holds]
        critical_missed += [
            f'{label}: {item.item}' for item in score.must_say if item.item in critical and not item.holds
        ]
        if score.reply.strip():
            if not in_language_of(score.reply, row.question):
                wrong_language.append(label)
            gendered += [f'{label}: {form}' for form in gendered_forms(score.reply)]
    met = sum(verdict.must_say_met for verdict in verdicts)
    total = sum(verdict.must_say_total for verdict in verdicts)
    owed = sum(verdict.runs_owed * len(by_id[verdict.row].must_say) for verdict in verdicts)
    hard_held = not (false_claims or critical_missed or wrong_language or gendered)
    reachable = hard_held and (met + owed) * 100 >= gate.must_say_percent_at_least * (total + owed)
    ran = [verdict for verdict in verdicts if verdict.runs_scored > 0]
    gap_rows = [verdict for verdict in verdicts if verdict.complete and verdict.ended_in_commit]
    return GateVerdict(
        rows_run=len(ran),
        rows_total=len(verdicts),
        rows_incomplete=[verdict.row for verdict in ran if not verdict.complete],
        false_claims=false_claims,
        critical_missed=critical_missed,
        wrong_language=wrong_language,
        gendered=gendered,
        must_say_met=met,
        must_say_total=total,
        must_say_percent_needed=gate.must_say_percent_at_least,
        correct=sum(1 for verdict in verdicts if verdict.correct),
        gap_rows=len(gap_rows),
        gap_flagged=sum(1 for verdict in gap_rows if verdict.gap_flagged),
        passed=reachable if all(verdict.complete for verdict in verdicts) else None,
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
