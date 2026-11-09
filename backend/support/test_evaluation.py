"""
===============================================================================
Support Agent — Tests: Scoring and the Gate
===============================================================================
Domain: Support
Description:
    Synthetic rows only; the real golden set holds members' reports and stays out
    of the repository. The judge is scripted, so these tests pin the arithmetic and
    the rules around it: the gate's hard part and pooled share, critical items on
    harm rows, reference fields kept from the agent, errors kept out of the score.

Standards: SaaS 2026, no network, no database.
===============================================================================
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.test import SimpleTestCase

from archive.dtos import CallCost
from archive.infrastructure.ai_client import AIClient
from support.agent import AgentOutcome, AgentRun, render_report
from support.evaluation import (
    EvalSet,
    GapVerdict,
    Gate,
    GateVerdict,
    ItemResult,
    JudgeError,
    MustNotSayVerdict,
    MustSayVerdict,
    RubricVerdict,
    RunScore,
    ScoredRow,
    SilentRow,
    gate_verdict,
    is_error,
    judge_rubric,
    nearest_rank,
    report_for,
    row_verdicts,
    run_control,
    score_scored_run,
    score_silent_run,
)

COST = CallCost(model='test', total_usd=Decimal('0.01'), total_cents=1)


def _row(row_id: str = 'q01', *, harm: bool = False, commit: bool = False, **fields: Any) -> ScoredRow:
    return ScoredRow(
        id=row_id,
        split='tune',
        sent='2026-01-05 21:00',
        filed_as='Something is unclear',
        route='/panel/x',
        build='abcdef12',
        harm=harm,
        expected_action='answer',
        ended_in_commit=commit,
        question='How does it work?',
        must_say=['It works this way.', 'Only managers can do it.'],
        must_not_say=['Everyone can do it.'],
        actual_resolution='SECRET-RESOLUTION: commit abc changed it.',
        **fields,
    )


def _eval_set(rows: list[ScoredRow], percent: int) -> EvalSet:
    return EvalSet(
        version=1,
        status='synthetic',
        reporter_role='the conductor',
        gate=Gate(runs_per_row=3, must_say_percent_at_least=percent),
        rows=rows,
        silent_rows=[],
    )


def _run(reply: str = 'An answer.', note: str = '', action: str = 'answer') -> AgentRun:
    return AgentRun(outcome=AgentOutcome(reading='r', action=action, reply=reply, developer_note=note))


def _score(
    row: str,
    rep: int,
    *,
    met: tuple[bool, bool] = (True, True),
    violated: bool = False,
    gap: bool | None = None,
    reply: str = 'It works this way, and only managers can do it.',
) -> RunScore:
    return RunScore(
        kind='scored', row=row, rep=rep, split='tune', status='ok', action='answer', expected_action='answer',
        passed=all(met) and not violated, gap_hit=gap, limit_hit=None, reading='', reply=reply, developer_note='',
        must_say=[ItemResult(item, holds) for item, holds in zip(_row().must_say, met, strict=True)],
        must_not_say=[ItemResult(_row().must_not_say[0], violated)],
    )


class _ScriptedJudge(AIClient):
    """A judge with canned verdicts. Refuses to run with an empty script."""

    def __init__(self, *verdicts: Any) -> None:
        super().__init__(api_key='test')
        self.verdicts = list(verdicts)
        self.contents: list[str] = []

    def parse(self, **kwargs: Any) -> Any:
        self.contents.append(kwargs['user_content'])
        return self.verdicts.pop(0), COST


def _verdict(*met: bool, violated: bool = False) -> RubricVerdict:
    return RubricVerdict(
        must_say=[MustSayVerdict(index=index, met=value, quote='') for index, value in enumerate(met)],
        must_not_say=[MustNotSayVerdict(index=0, violated=violated, quote='')],
    )


class ReferenceIsolationTests(SimpleTestCase):
    def test_the_agent_input_holds_no_reference_field(self) -> None:
        row = _row(commit=True)
        text = render_report(report_for(row, 'the conductor'))
        self.assertIn(row.question, text)
        for hidden in (*row.must_say, *row.must_not_say, row.actual_resolution):
            self.assertNotIn(hidden, text)

    def test_the_eval_set_rejects_an_unknown_field(self) -> None:
        with self.assertRaises(ValueError):
            _row(typo_field=True)

    def test_critical_items_index_must_say_and_belong_to_harm_rows(self) -> None:
        self.assertEqual(_row(harm=True, critical_must_say=[1]).critical_items, ['Only managers can do it.'])
        for indices in ([2], [0, 0]):
            with self.assertRaises(ValueError):
                _row(harm=True, critical_must_say=indices)
        with self.assertRaises(ValueError):
            _row(critical_must_say=[0])


class ScoringTests(SimpleTestCase):
    def test_all_items_met_and_no_false_claim_passes(self) -> None:
        judge = _ScriptedJudge(_verdict(True, True))
        self.assertTrue(score_scored_run(judge, _row(), 1, _run()).passed)

    def test_one_missed_item_fails(self) -> None:
        judge = _ScriptedJudge(_verdict(True, False))
        self.assertFalse(score_scored_run(judge, _row(), 1, _run()).passed)

    def test_a_false_claim_fails_even_with_everything_said(self) -> None:
        judge = _ScriptedJudge(_verdict(True, True, violated=True))
        self.assertFalse(score_scored_run(judge, _row(), 1, _run()).passed)

    def test_silence_meets_nothing_without_a_judge_call(self) -> None:
        judge = _ScriptedJudge()
        score = score_scored_run(judge, _row(), 1, _run(reply='', action='no_reply'))
        self.assertFalse(score.passed)
        self.assertEqual(judge.contents, [])

    def test_a_row_can_accept_silence(self) -> None:
        judge = _ScriptedJudge()
        row = _row(accepts_no_reply=True)
        self.assertTrue(score_scored_run(judge, row, 1, _run(reply='', action='no_reply')).passed)

    def test_gap_flag_needs_a_note_that_the_judge_accepts(self) -> None:
        row = _row(commit=True)
        judge = _ScriptedJudge(_verdict(True, True), GapVerdict(same_gap=True, reason='same'))
        self.assertTrue(score_scored_run(judge, row, 1, _run(note='The card lacks recordings.')).gap_hit)
        judge = _ScriptedJudge(_verdict(True, True))
        self.assertFalse(score_scored_run(judge, row, 1, _run(note='')).gap_hit)

    def test_a_judge_that_skips_an_item_is_an_error_not_a_score(self) -> None:
        judge = _ScriptedJudge(_verdict(True))
        with self.assertRaises(JudgeError):
            judge_rubric(judge, _row(), AgentOutcome(reading='r', action='answer', reply='x', developer_note=''))

    def test_refusal_scores_as_failure_and_plumbing_is_kept_out(self) -> None:
        self.assertFalse(is_error(AgentRun(status='refusal')))
        for status in ('truncated', 'unparseable', 'api_error', 'model_mismatch'):
            self.assertTrue(is_error(AgentRun(status=status)))
        score = score_scored_run(_ScriptedJudge(), _row(), 1, AgentRun(status='refusal'))
        self.assertFalse(score.passed)

    def test_silent_rows_pass_only_in_silence_unless_one_line_is_accepted(self) -> None:
        row = SilentRow(
            id='n1', sent='s', filed_as='Praise', route='/p', build='abcdef12', body='Great!',
        )
        self.assertTrue(score_silent_run(row, 1, _run(reply='', action='no_reply')).passed)
        self.assertFalse(score_silent_run(row, 1, _run(reply='Thanks!')).passed)
        lenient = row.model_copy(update={'accepts_one_line': True})
        self.assertTrue(score_silent_run(lenient, 1, _run(reply='Not at this build.')).passed)
        self.assertFalse(score_silent_run(lenient, 1, _run(reply='Long.\nReply.')).passed)


class GateTests(SimpleTestCase):
    def _gate(self, rows: list[ScoredRow], scores: list[RunScore], percent: int = 80) -> GateVerdict:
        eval_set = _eval_set(rows, percent)
        return gate_verdict(eval_set.gate, rows, row_verdicts(rows, scores, 3), scores)

    def test_a_row_needs_all_three_runs_to_count_as_correct(self) -> None:
        scores = [_score('q01', 1), _score('q01', 2), _score('q01', 3, met=(True, False))]
        verdict = row_verdicts([_row()], scores, 3)[0]
        self.assertEqual(verdict.runs_passed, 2)
        self.assertEqual((verdict.must_say_met, verdict.must_say_total), (5, 6))
        self.assertFalse(verdict.correct)

    def test_a_good_set_passes(self) -> None:
        rows = [_row('q01', commit=True), _row('q02', harm=True)]
        scores = [_score(row.id, rep, gap=True) for row in rows for rep in (1, 2, 3)]
        self.assertTrue(self._gate(rows, scores).passed)

    def test_a_missed_item_off_the_critical_list_costs_only_share(self) -> None:
        rows = [_row('q01', harm=True, critical_must_say=[0])]
        scores = [_score('q01', rep, met=(True, rep != 2)) for rep in (1, 2, 3)]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.critical_missed, [])
        self.assertEqual(verdict.correct, 0)
        self.assertTrue(verdict.passed)

    def test_a_missed_critical_item_fails_the_gate_whatever_the_share(self) -> None:
        rows = [_row('q01', harm=True, critical_must_say=[1])]
        scores = [_score('q01', rep, met=(True, rep != 2)) for rep in (1, 2, 3)]
        verdict = self._gate(rows, scores, percent=50)
        self.assertEqual(verdict.critical_missed, ['q01#2: Only managers can do it.'])
        self.assertFalse(verdict.passed)

    def test_an_unmarked_harm_row_holds_every_item_critical(self) -> None:
        rows = [_row('q01', harm=True)]
        scores = [_score('q01', rep, met=(rep != 3, True)) for rep in (1, 2, 3)]
        self.assertEqual(self._gate(rows, scores, percent=50).critical_missed, ['q01#3: It works this way.'])

    def test_a_false_claim_on_any_row_fails_the_gate(self) -> None:
        rows = [_row('q01')]
        scores = [_score('q01', rep, violated=rep == 1) for rep in (1, 2, 3)]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.false_claims, ['q01#1: Everyone can do it.'])
        self.assertFalse(verdict.passed)

    def test_a_reply_in_another_language_or_with_a_gendered_form_fails_the_gate(self) -> None:
        rows = [_row('q01').model_copy(update={'question': 'Jak to działa?'})]
        scores = [
            _score('q01', 1, reply='Działa to tak, a robią to tylko menedżerowie.'),
            _score('q01', 2, reply='It works this way, and only managers can do it.'),
            _score('q01', 3, reply='Jak już kliknąłeś, działa to tak.'),
        ]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.wrong_language, ['q01#2'])
        self.assertEqual(verdict.gendered, ['q01#3: kliknąłeś'])
        self.assertFalse(verdict.passed)

    def test_the_share_pools_items_over_every_run(self) -> None:
        rows = [_row('q01'), _row('q02')]
        scores = [
            *[_score('q01', rep) for rep in (1, 2, 3)],
            *[_score('q02', rep, met=(False, rep == 1)) for rep in (1, 2, 3)],
        ]
        verdict = self._gate(rows, scores, percent=60)
        self.assertEqual((verdict.must_say_met, verdict.must_say_total), (7, 12))
        self.assertFalse(verdict.passed)
        self.assertTrue(self._gate(rows, scores, percent=55).passed)

    def test_an_agent_that_always_abstains_fails(self) -> None:
        rows = [_row('q01', commit=True), _row('q02')]
        scores = [_score(row.id, rep, met=(False, False), gap=False, reply='') for row in rows for rep in (1, 2, 3)]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.must_say_met, 0)
        self.assertFalse(verdict.passed)

    def test_gap_flags_need_every_run_and_stay_outside_the_gate(self) -> None:
        rows = [_row('q01', commit=True), _row('q02')]
        scores = [
            *[_score('q01', rep, gap=rep != 3) for rep in (1, 2, 3)],
            *[_score('q02', rep) for rep in (1, 2, 3)],
        ]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.gap_flagged, 0)
        self.assertTrue(verdict.passed)

    def test_rows_still_to_run_leave_the_gate_undecided(self) -> None:
        rows = [_row('q01'), _row('q02', commit=True)]
        scores = [_score('q01', rep) for rep in (1, 2, 3)]
        verdict = self._gate(rows, scores)
        self.assertIsNone(verdict.passed)
        self.assertTrue(verdict.still_reachable)

    def test_an_errored_run_leaves_its_row_incomplete_rather_than_wrong(self) -> None:
        rows = [_row('q01'), _row('q02')]
        scores = [_score('q01', rep) for rep in (1, 2)]
        verdict = self._gate(rows, scores)
        self.assertEqual(verdict.rows_incomplete, ['q01'])
        self.assertEqual(verdict.correct, 0)
        self.assertIsNone(verdict.passed)

    def test_owed_runs_count_as_met_while_judging_reachability(self) -> None:
        rows = [_row('q01'), _row('q02')]
        scores = [_score('q01', rep, met=(False, rep == 1)) for rep in (1, 2, 3)]
        self.assertTrue(self._gate(rows, scores, percent=55).still_reachable)
        self.assertFalse(self._gate(rows, scores, percent=60).still_reachable)

    def test_a_hard_failure_makes_the_gate_unreachable_early(self) -> None:
        rows = [_row('q01', harm=True), _row('q02')]
        scores = [_score('q01', 1, met=(False, True))]
        self.assertFalse(self._gate(rows, scores).still_reachable)


class ControlTests(SimpleTestCase):
    def test_controls_pass_when_the_judge_separates_the_three(self) -> None:
        row = _row(commit=True)
        judge = _ScriptedJudge(
            _verdict(True, True),
            _verdict(False, False),
            _verdict(False, False, violated=True),
            GapVerdict(same_gap=True, reason='same'),
            GapVerdict(same_gap=False, reason='unrelated'),
        )
        self.assertTrue(run_control(judge, row).as_expected)

    def test_a_judge_that_passes_everything_is_caught(self) -> None:
        row = _row()
        judge = _ScriptedJudge(_verdict(True, True), _verdict(True, True), _verdict(True, True))
        self.assertFalse(run_control(judge, row).as_expected)


class NearestRankTests(SimpleTestCase):
    def test_it_returns_observed_values(self) -> None:
        self.assertEqual(nearest_rank([3.0, 1.0, 2.0], 0.5), 2.0)
        self.assertEqual(nearest_rank([1.0, 2.0, 3.0, 4.0], 0.95), 4.0)
        self.assertEqual(nearest_rank([], 0.5), 0.0)
