"""
===============================================================================
Support Agent — Tests: Answering a Stored Report
===============================================================================
Domain: Support
Description:
    The agent is stubbed, and git runs only against a throwaway repository, so no
    call leaves the machine. Covers what the agent is shown (no identity, the burst
    as neighbours, the replies they already got), which commit it reads, which
    replies reach the reporter, that the maintainer hears of every run, a failed
    one included, that a burst draws one run, and the retry, the switch and the
    admin's re-run.

Standards: SaaS 2026, no network.
===============================================================================
"""
from __future__ import annotations

import datetime as dt
import shutil
import tempfile
from pathlib import Path
from typing import Any
from unittest import skipUnless
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from core.constants import AppRole
from core.models import FeedbackKind, FeedbackReport, UserProfile
from support.agent import AgentOutcome, AgentRun, render_report
from support.delivery import answer_report, code_reader_for, report_input, verdict_for
from support.models import SupportReplyChannel, SupportRun, SupportRunResult, SupportRunTrigger
from support.tasks import answer_feedback_report_task, schedule_answer
from support.test_code_reader import _git, _write

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

    @patch('support.delivery.NotificationService')
    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_reply_arrives_in_the_app_from_the_assistant(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock, notifications: MagicMock,
    ) -> None:
        developer = User.objects.create_user(username=str(uuid4()), email='dev@voct.test', password='pw12345678')
        reader.return_value.commit = 'abc1234def'
        reply = 'Plan wysyłasz przyciskiem „Wyślij” nad listą utworów.'
        agent.return_value = _run(reply)

        with override_settings(FEEDBACK_NOTIFICATION_EMAIL='dev@voct.test'):
            answer_report(str(self.report.pk), client=MagicMock())

        dto = notifications.create_notification.call_args.args[0]
        self.assertEqual(dto.recipient_id, str(self.conductor.pk))
        self.assertEqual(dto.metadata.message, reply)
        self.assertEqual(dto.metadata.sender_name, 'Asystent AI')
        self.assertEqual(dto.metadata.sender_id, str(developer.pk))
        sent = [call.kwargs for call in mail.delay.call_args_list]
        self.assertEqual([item['recipient_email'] for item in sent], ['dev@voct.test'])
        self.assertEqual(sent[0]['context']['summary'], 'Odpowiedź wysłana do zgłaszającego (w aplikacji)')
        self.report.refresh_from_db()
        self.assertIn('Notatka dla dewelopera:\nNothing to fix.', self.report.note)
        record = SupportRun.objects.get(report=self.report)
        self.assertEqual(record.result, SupportRunResult.SENT)
        self.assertEqual(record.channel, SupportReplyChannel.APP)
        self.assertEqual(record.reply, reply)
        self.assertEqual(record.commit, 'abc1234def')
        self.assertIsNotNone(record.finished_at)

    @patch('support.delivery.NotificationService')
    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_reply_too_long_for_a_message_goes_by_email(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock, notifications: MagicMock,
    ) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = _run('Plan wysyłasz przyciskiem nad listą utworów. ' * 60)

        with override_settings(FEEDBACK_NOTIFICATION_EMAIL='dev@voct.test'):
            answer_report(str(self.report.pk), client=MagicMock())

        notifications.create_notification.assert_not_called()
        sent = [call.kwargs for call in mail.delay.call_args_list]
        to_reporter = self._one(sent, 'conductor@voct.test')
        self.assertEqual(to_reporter['template_name'], 'feedback_reply')
        self.assertEqual(to_reporter['reply_to'], ['dev@voct.test'])
        self.assertIn('asystent AI', to_reporter['context']['note'])

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
        self.assertEqual(SupportRun.objects.get(report=self.report).result, SupportRunResult.FAILED)

    @patch('support.delivery.NotificationService')
    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_an_addendum_the_first_run_read_gets_no_run_of_its_own(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock, notifications: MagicMock,
    ) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = _run('Plan wysyłasz przyciskiem „Wyślij” nad listą utworów.')
        question = self._report('Jak wysłać plan próby?', minutes=-3)
        addendum = self._report('Chodzi o próbę w piątek.', minutes=-2)

        answer_report(str(question.pk), client=MagicMock())
        answer_report(str(addendum.pk), client=MagicMock())

        self.assertEqual(agent.call_count, 1)
        self.assertEqual(mail.delay.call_count, 1)
        covered = SupportRun.objects.get(report=addendum)
        self.assertEqual(covered.result, SupportRunResult.COVERED)
        self.assertEqual(covered.covered_by, SupportRun.objects.get(report=question))
        addendum.refresh_from_db()
        self.assertIn('Bez osobnego przebiegu', addendum.note)

    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_held_reply_leaves_the_addendum_its_own_run(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock,
    ) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = _run('Jesteś wpisany na tę próbę, więc plan już widzisz.')
        question = self._report('Czy widzę plan?', minutes=-3)
        addendum = self._report('Chodzi o próbę w piątek.', minutes=-2)

        answer_report(str(question.pk), client=MagicMock())
        answer_report(str(addendum.pk), client=MagicMock())

        self.assertEqual(agent.call_count, 2)

    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_a_run_from_the_admin_goes_although_another_run_read_the_report(
        self, reader: MagicMock, agent: MagicMock, mail: MagicMock,
    ) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = _run('', action='no_reply')
        question = self._report('Jak wysłać plan próby?', minutes=-3)
        addendum = self._report('Chodzi o próbę w piątek.', minutes=-2)
        answer_report(str(question.pk), client=MagicMock())

        answer_report(str(addendum.pk), trigger=SupportRunTrigger.MANUAL, client=MagicMock())

        self.assertEqual(agent.call_count, 2)
        self.assertEqual(SupportRun.objects.get(report=addendum).result, SupportRunResult.SILENT)

    def test_a_later_report_is_shown_the_reply_already_sent(self) -> None:
        question = self._report('Jak wysłać plan próby?', minutes=-10)
        earlier = SupportRun.objects.create(
            report=question, trigger=SupportRunTrigger.AUTO, result=SupportRunResult.SENT,
            reply='Plan wysyłasz przyciskiem „Wyślij”.',
        )
        SupportRun.objects.filter(pk=earlier.pk).update(started_at=timezone.now() - dt.timedelta(minutes=8))

        text = render_report(report_input(self.report))

        self.assertIn('<reply_already_sent>\nPlan wysyłasz przyciskiem „Wyślij”.\n</reply_already_sent>', text)

    @patch('support.delivery.send_transactional_email_task')
    @patch('support.delivery.run_support_agent')
    @patch('support.delivery.code_reader_for')
    def test_an_overloaded_run_is_retried_once(self, reader: MagicMock, agent: MagicMock, mail: MagicMock) -> None:
        reader.return_value.commit = 'abc1234def'
        agent.return_value = AgentRun(status='api_error', error='OverloadedError: 529')

        with override_settings(ANTHROPIC_API_KEY='sk-test'), \
                patch.object(answer_feedback_report_task, 'apply_async') as queued:
            answer_feedback_report_task(str(self.report.pk))
            answer_feedback_report_task(str(self.report.pk), trigger=SupportRunTrigger.RETRY.value)

        queued.assert_called_once_with(
            args=[str(self.report.pk)], kwargs={'trigger': 'RETRY'}, countdown=15 * 60,
        )
        self.assertIn('ponowię około', mail.delay.call_args_list[0].kwargs['context']['summary'])
        self.assertNotIn('ponowię', mail.delay.call_args_list[1].kwargs['context']['summary'])

    @patch('support.tasks.answer_report')
    def test_the_switch_stops_queued_runs_but_not_the_admin(self, answer: MagicMock) -> None:
        with override_settings(SUPPORT_AGENT_ENABLED=False):
            answer_feedback_report_task(str(self.report.pk))
            self.assertEqual(answer.call_count, 0)
            answer_feedback_report_task(str(self.report.pk), trigger=SupportRunTrigger.MANUAL.value)
            self.assertEqual(answer.call_count, 1)

    def test_nothing_is_queued_with_the_switch_off(self) -> None:
        with override_settings(ANTHROPIC_API_KEY='sk-test', SUPPORT_AGENT_ENABLED=False), \
                self.captureOnCommitCallbacks() as callbacks:
            schedule_answer(self.report)

        self.assertEqual(callbacks, [])

    @patch('support.admin.queue_manual_run')
    def test_the_admin_runs_the_agent_again(self, queue: MagicMock) -> None:
        admin_user = User.objects.create_superuser(
            username=str(uuid4()), email='admin@voct.test', password='pw12345678',
        )
        self.client.force_login(admin_user)

        with override_settings(ANTHROPIC_API_KEY='sk-test'):
            response = self.client.post('/admin/core/feedbackreport/', {
                'action': 'run_agent_again', '_selected_action': [str(self.report.pk)],
            })

        self.assertEqual(response.status_code, 302)
        queue.assert_called_once_with(self.report)
        SupportRun.objects.create(report=self.report, trigger=SupportRunTrigger.AUTO, result=SupportRunResult.SILENT)
        page = self.client.get(f'/admin/core/feedbackreport/{self.report.pk}/change/')
        self.assertContains(page, 'No reply')

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


@skipUnless(shutil.which('git'), 'git is not available')
class CodeVersionTests(SimpleTestCase):
    """The panel's stamp names its last frontend commit; the backend behind it is HEAD."""
    _folder: tempfile.TemporaryDirectory[str]
    repo: Path
    old_panel: str
    panel: str
    deployed: str

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls._folder = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        cls.repo = Path(cls._folder.name)
        _git(cls.repo, 'init', '-q')
        cls.old_panel = cls._commit('frontend/src/app.tsx', 'panel 1\n')
        cls.panel = cls._commit('frontend/src/app.tsx', 'panel 2\n')
        cls.deployed = cls._commit('backend/core/views.py', 'backend 2\n')

    @classmethod
    def tearDownClass(cls) -> None:
        cls._folder.cleanup()
        super().tearDownClass()

    @classmethod
    def _commit(cls, path: str, text: str) -> str:
        _write(cls.repo, path, text)
        _git(cls.repo, 'add', '-A')
        _git(cls.repo, 'commit', '-q', '-m', path)
        return _git(cls.repo, 'rev-parse', 'HEAD')

    def _commit_read_for(self, stamp: str) -> str:
        report = FeedbackReport(context={'app_version': f'2026-11-10 18:00 · {stamp}'})
        return code_reader_for(report, self.repo).commit

    def test_a_current_panel_reads_the_deployed_backend(self) -> None:
        self.assertEqual(self._commit_read_for(self.panel[:8]), self.deployed)

    def test_an_outdated_panel_reads_its_own_commit(self) -> None:
        self.assertEqual(self._commit_read_for(self.old_panel[:8]), self.old_panel)

    def test_a_stamp_without_a_commit_reads_head(self) -> None:
        self.assertEqual(self._commit_read_for('dev'), self.deployed)
