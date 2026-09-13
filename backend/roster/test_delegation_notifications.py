"""
@file test_delegation_notifications.py
@description Whether the stand-in is actually told.

    Before these, a delegation was a database row and a line in a log: the person
    handed a programme discovered it by noticing that somebody else's music had
    opened. The tests that matter are about WHEN the announcement fires, because
    the write it hangs off is an upsert — one gesture that means three different
    things depending on what was there before.

    The dispatch is asserted at the task boundary (`send_notification_task.delay`)
    rather than through Celery: what is being pinned is the decision to speak,
    the recipient and the payload, all of which are this module's business. How
    the message then becomes a push and an e-mail is the notification router's,
    and it has its own tests.

@architecture Enterprise SaaS 2026
@module roster/test_delegation_notifications
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from core.constants import AppRole
from core.models import UserProfile
from notifications.models import NotificationType
from roster.models import Artist, Project, Rehearsal, RehearsalDelegate, VoiceType
from roster.services import RehearsalDelegationService

TASK = "roster.services.send_notification_task"


class DelegationNotificationTests(TestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user(
            "mgr", "mgr@test.pl", "pw123456",
            first_name="Tomasz", last_name="Kuras",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Adwent", status=Project.Status.ACTIVE,
        )
        self.deputy_user = User.objects.create_user(
            "deputy", "deputy@test.pl", "pw123456",
            first_name="Kasia", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.deputy_user, role=AppRole.ARTIST)
        self.deputy = Artist.objects.create(
            user=self.deputy_user, first_name="Kasia", last_name="Nowak",
            email="deputy@test.pl", voice_type=VoiceType.SOPRANO,
        )

    # Both writes hand the dispatch to `transaction.on_commit`, so the commit
    # has to actually be reached: inside a TestCase's own transaction the
    # callbacks are queued and then rolled away with everything else, and the
    # announcement would look absent when it is merely unflushed.
    def _grant(self, artist=None, granted_by="manager", **scopes):
        defaults = {
            "can_see_leader_marks": True,
            "can_take_roll_call": True,
            "can_open_materials": True,
        }
        actor = self.manager if granted_by == "manager" else granted_by
        with self.captureOnCommitCallbacks(execute=True):
            return RehearsalDelegationService.grant(
                project=self.project,
                granted_by=actor,
                artist=artist or self.deputy,
                **{**defaults, **scopes},
            )

    def _revoke(self, delegate):
        with self.captureOnCommitCallbacks(execute=True):
            RehearsalDelegationService.revoke(delegate, revoked_by=self.manager)

    # --- granting ---------------------------------------------------------

    def test_granting_tells_the_stand_in_what_it_opens(self) -> None:
        with patch(TASK) as task:
            self._grant()
        task.delay.assert_called_once()
        kwargs = task.delay.call_args.kwargs
        self.assertEqual(kwargs["recipient_id"], str(self.deputy_user.pk))
        self.assertEqual(
            kwargs["notification_type"], NotificationType.REHEARSAL_DELEGATED,
        )
        metadata = kwargs["metadata"]
        self.assertEqual(metadata["project_name"], "Adwent")
        self.assertEqual(metadata["granted_by_name"], "Tomasz Kuras")
        # Every scope travels: the reader cannot be left guessing which of the
        # three doors was opened.
        self.assertTrue(metadata["can_see_leader_marks"])
        self.assertTrue(metadata["can_take_roll_call"])
        self.assertTrue(metadata["can_open_materials"])

    def test_a_withheld_scope_travels_as_false_rather_than_missing(self) -> None:
        with patch(TASK) as task:
            self._grant(can_see_leader_marks=False)
        metadata = task.delay.call_args.kwargs["metadata"]
        self.assertFalse(metadata["can_see_leader_marks"])
        self.assertTrue(metadata["can_take_roll_call"])

    def test_the_briefing_points_at_the_next_evening_when_there_is_one(self) -> None:
        rehearsal = Rehearsal.objects.create(
            project=self.project,
            date_time=timezone.now() + timedelta(days=3),
        )
        # A rehearsal already behind them is not "next".
        Rehearsal.objects.create(
            project=self.project,
            date_time=timezone.now() - timedelta(days=1),
        )
        with patch(TASK) as task:
            self._grant()
        upcoming = task.delay.call_args.kwargs["metadata"]["next_rehearsal"]
        self.assertEqual(upcoming["rehearsal_id"], str(rehearsal.pk))

    def test_a_grant_made_before_anything_is_scheduled_still_goes_out(self) -> None:
        with patch(TASK) as task:
            self._grant()
        self.assertIsNone(task.delay.call_args.kwargs["metadata"]["next_rehearsal"])

    def test_narrowing_a_live_delegation_says_nothing(self) -> None:
        with patch(TASK):
            self._grant()
        with patch(TASK) as task:
            self._grant(can_take_roll_call=False)
        # The person already knows they are running it; announcing a correction
        # would teach them to ignore the announcement that matters.
        task.delay.assert_not_called()

    def test_granting_again_after_a_revoke_is_news_again(self) -> None:
        with patch(TASK):
            delegate = self._grant()
            self._revoke(delegate)
        with patch(TASK) as task:
            self._grant()
        task.delay.assert_called_once()
        self.assertEqual(
            task.delay.call_args.kwargs["notification_type"],
            NotificationType.REHEARSAL_DELEGATED,
        )

    # --- revoking ---------------------------------------------------------

    def test_revoking_tells_them_too(self) -> None:
        with patch(TASK):
            delegate = self._grant()
        with patch(TASK) as task:
            self._revoke(delegate)
        task.delay.assert_called_once()
        kwargs = task.delay.call_args.kwargs
        self.assertEqual(
            kwargs["notification_type"],
            NotificationType.REHEARSAL_DELEGATION_ENDED,
        )
        self.assertEqual(kwargs["recipient_id"], str(self.deputy_user.pk))
        self.assertEqual(kwargs["metadata"]["revoked_by_name"], "Tomasz Kuras")

    # --- the person with no account --------------------------------------

    def test_a_singer_without_an_account_breaks_nothing(self) -> None:
        """The roster holds people, not logins. There is then nobody to tell,
        and that is a fact to log rather than an error to raise."""
        accountless = Artist.objects.create(
            first_name="Jan", last_name="Bez-Konta",
            email="jan@test.pl", voice_type=VoiceType.BASS,
        )
        with patch(TASK) as task:
            delegate = self._grant(artist=accountless)
            self._revoke(delegate)
        task.delay.assert_not_called()
        self.assertTrue(RehearsalDelegate.all_objects.filter(pk=delegate.pk).exists())

    def test_an_unnamed_actor_leaves_the_name_blank_not_broken(self) -> None:
        with patch(TASK) as task:
            self._grant(granted_by=None)
        self.assertEqual(
            task.delay.call_args.kwargs["metadata"]["granted_by_name"], "",
        )
