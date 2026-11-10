"""
===============================================================================
Support Agent — Tests: Answering a Stored Report
===============================================================================
Domain: Support
Description:
    The agent and git are stubbed, so no call leaves the machine. Covers what the
    agent is shown (no identity, the burst as neighbours), which replies reach the
    reporter, and that the maintainer hears of every run, a failed one included.

Standards: SaaS 2026, no network.
===============================================================================
"""
from __future__ import annotations

import datetime as dt
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from core.constants import AppRole
from core.models import FeedbackKind, FeedbackReport, UserProfile
from support.agent import AgentOutcome, AgentRun, render_report
from support.delivery import answer_report, report_input, verdict_for
from support.tasks import schedule_answer

User = get_user_model()


def _run(reply: str, action: str = 'answer') -> AgentRun:
    return AgentRun(outcome=AgentOutcome(
        reading='A question about the rehearsal plan.',
        action=action,
        reply=reply,
        developer_note='Nothing to fix.',
    ))


class DeliveryTests(TestCase):

    def setUp(self) -> None:
        self.conductor = User.objects.create_user(
            username=str(uuid4()), email='conductor@voct.test', password='pw12345678', first_name='Jan',
        )
        UserProfile.objects.create(user=self.conductor, role=AppRole.MANAGER)
        self.report = self._report(
            'Jak wysłać plan próby chórowi? /panel/projects/0f8fad5b-d9cb-469f-a165-70867728950e',
            route='/panel/projects/0f8fad5b-d9cb-469f-a165-70867728950e/rehearsals',
        )

    def _report(self, body: str, *, route: str = '/panel', minutes: int = 0) -> FeedbackReport:
        report = FeedbackReport.objects.create(
            reporter=self.conductor, kind=FeedbackKind.CONFUSING, body=body, route=route,
            context={'app_version': '2026-11-10 18:00 · abc1234'},
        )
        moment = timezone.now() + dt.timedelta(minutes=minutes)
        FeedbackReport.objects.filter(pk=report.pk).update(created_at=moment)
        report.refresh_from_db()
        return report

    def test_the_agent_sees_a_role_and_the_burst_but_no_identity(self) -> None:
        self._report('Już znalazłem, dzięki.', minutes=6)
        self._report('Inna sprawa, następnego dnia.', minutes=60 * 24)

        text = render_report(report_input(self.report))

        self.assertIn("one of the ensemble's managers", text)
        self.assertIn('filed_as: Something is unclear', text)
        self.assertIn('screen: /panel/projects/<id>/rehearsals', text)
        self.assertIn('6 minutes later', text)
        self.assertNotIn('następnego dnia', text)
        self.assertNotIn('conductor@voct.test', text)
        self.assertNotIn('Jan', text)

    def test_a_clean_reply_is_sent(self) -> None:
        verdict = verdict_for(self.report, _run('Plan wysyłasz przyciskiem „Wyślij” nad listą utworów.'))

        self.assertTrue(verdict.sent)

    def test_a_gendered_reply_is_held(self) -> None:
        verdict = verdict_for(self.report, _run('Jesteś wpisany na tę próbę, więc plan już widzisz.'))

        self.assertFalse(verdict.sent)
        self.assertIn('jesteś wpisany', verdict.held_because.lower())

    def test_a_reply_in_another_language_is_held(self) -> None:
        verdict = verdict_for(self.report, _run('You send the plan with the button above the list.'))

        self.assertFalse(verdict.sent)
        self.assertTrue(verdict.held_because)

    def test_silence_sends_nothing(self) -> None:
        verdict = verdict_for(self.report, _run('', action='no_reply'))

        self.assertFalse(verdict.sent)
        self.assertEqual(verdict.held_because, '')

    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_sent_reply_reaches_the_reporter_and_the_maintainer(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock,
    ) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = _run('Plan wysyłasz przyciskiem „Wyślij” nad listą utworów.')

        with override_settings(FEEDBACK_NOTIFICATION_EMAIL='dev@voct.test'):
            answer_report(str(self.report.pk), client=MagicMock())

        sent = [call.kwargs for call in mail.delay.call_args_list]
        to_reporter = self._one(sent, 'conductor@voct.test')
        self.assertEqual(to_reporter['template_name'], 'feedback_reply')
        self.assertEqual(to_reporter['reply_to'], ['dev@voct.test'])
        self.assertIn('asystent AI', to_reporter['context']['note'])
        to_maintainer = self._one(sent, 'dev@voct.test')
        self.assertEqual(to_maintainer['context']['summary'], 'Odpowiedź wysłana do zgłaszającego')
        self.report.refresh_from_db()
        self.assertIn('Notatka dla dewelopera:\nNothing to fix.', self.report.note)

    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_failed_run_reaches_only_the_maintainer(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock,
    ) -> None:
        agent.side_effect = RuntimeError('credit balance is too low')

        with override_settings(FEEDBACK_NOTIFICATION_EMAIL='dev@voct.test'):
            answer_report(str(self.report.pk), client=MagicMock())

        sent = [call.kwargs for call in mail.delay.call_args_list]
        self.assertEqual([item['recipient_email'] for item in sent], ['dev@voct.test'])
        self.assertIn('credit balance is too low', sent[0]['context']['summary'])

    def test_nothing_is_queued_without_an_api_key(self) -> None:
        with override_settings(ANTHROPIC_API_KEY=''), self.captureOnCommitCallbacks() as callbacks:
            schedule_answer(self.report)

        self.assertEqual(callbacks, [])

    @patch('support.tasks.answer_feedback_report_task')
    def test_the_run_waits_for_an_addendum(self, task: MagicMock) -> None:
        with override_settings(ANTHROPIC_API_KEY='sk-test'), self.captureOnCommitCallbacks(execute=True):
            schedule_answer(self.report)

        task.apply_async.assert_called_once_with(args=[str(self.report.pk)], countdown=2 * 60)

    def _one(self, sent: list[dict[str, Any]], recipient: str) -> dict[str, Any]:
        matching = [item for item in sent if item['recipient_email'] == recipient]
        self.assertEqual(len(matching), 1, sent)
        return matching[0]
