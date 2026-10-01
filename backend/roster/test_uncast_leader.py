"""A leader without a seat gets what the cast gets about the evenings that
call them: the rehearsal page, the announcements, the cancellations, the
day-before reminder and the subscribed calendar — without a Participation.

The evenings that call such a leader are the ones announced for them
(`Rehearsal.led_by`) and every whole-cast evening. The fixture's assistant is
an alto, and the project has an alto sectional somebody else leads: their own
voice type must not call them to it.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.ical_service import ICalGeneratorService
from core.models import UserProfile
from notifications.announcement_queue import AnnouncementQueue, ResolvedAnnouncement
from notifications.models import (
    AnnouncementKind,
    AnnouncementSubject,
    NotificationLevel,
    NotificationType,
)
from roster.models import Artist, Participation, Project, Rehearsal, RehearsalDelegate, VoiceType
from roster.permissions import seatless_leader_user_ids

WARSAW = ZoneInfo("Europe/Warsaw")
BULK = "notifications.announcements.send_bulk_notifications_task.delay"


class UncastLeaderTests(APITestCase):
    def setUp(self) -> None:
        # The per-user throttle counts in the process cache, and SQLite hands the
        # same user ids to every test: earlier requests would count against these.
        cache.clear()
        User = get_user_model()
        self.manager = User.objects.create_user("mgr-lead", "mgr-lead@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Laudes creaturarum",
            date_time=timezone.now() + timedelta(days=40),
            status=Project.Status.ACTIVE,
        )
        self.soprano_user, soprano = self._person("sopran", VoiceType.SOPRANO)
        self.alto_user, alto = self._person("alt", VoiceType.ALTO)
        for artist in (soprano, alto):
            Participation.objects.create(
                artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
            )

        self.leader_user, self.leader = self._person("asystentka", VoiceType.ALTO)
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.leader, granted_by=self.manager,
        )

        week = (datetime.now(WARSAW) + timedelta(days=7)).replace(
            hour=18, minute=0, second=0, microsecond=0,
        )
        self.hers = self._evening(week, called_sections="S", led_by=self.leader)
        self.tutti = self._evening(week + timedelta(days=1))
        self.altos = self._evening(week + timedelta(days=2), called_sections="A")

        other = Project.objects.create(
            title="Other", date_time=timezone.now() + timedelta(days=50),
            status=Project.Status.ACTIVE,
        )
        self.elsewhere = Rehearsal.objects.create(
            project=other, date_time=week, timezone="Europe/Warsaw",
        )

    def _person(self, handle: str, voice_type: str) -> tuple[AbstractBaseUser, Artist]:
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456", first_name=handle, last_name="X",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=handle, last_name="X", email=f"{handle}@test.pl",
            voice_type=voice_type,
        )
        return user, artist

    def _evening(self, when: datetime, **fields: Any) -> Rehearsal:
        return Rehearsal.objects.create(
            project=self.project, date_time=when, timezone="Europe/Warsaw",
            duration_minutes=120, **fields,
        )

    @property
    def _her_id(self) -> str:
        return str(self.leader_user.pk)

    def _her_feed(self) -> str:
        """Her subscribed calendar, unfolded: an id may straddle a fold."""
        return ICalGeneratorService.generate_user_feed(self.leader_user).replace("\r\n ", "")

    def _moved(self, rehearsal: Rehearsal) -> list[str]:
        """Who the queue's broadcast about a move of ``rehearsal`` reaches."""
        return AnnouncementQueue.recipients_for(
            self.project,
            ResolvedAnnouncement(
                recipient_id=None,
                subject_type=AnnouncementSubject.REHEARSAL,
                subject_id=str(rehearsal.id),
                kind=AnnouncementKind.CHANGED,
                notification_type=NotificationType.REHEARSAL_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={},
                row_ids=(),
            ),
        )

    # --- the rehearsal page ------------------------------------------------

    def test_every_evening_of_her_project_opens_and_no_other(self) -> None:
        self.client.force_authenticate(user=self.leader_user)
        for evening in (self.hers, self.tutti, self.altos):
            with self.subTest(evening=str(evening.id)):
                response = self.client.get(f"/api/rehearsals/{evening.id}/")
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.data["my_plan_window"])
        self.assertEqual(
            self.client.get(f"/api/rehearsals/{self.elsewhere.id}/").status_code, 404,
        )
        # The list is the cast's view of the programme, and she is not in it.
        self.assertEqual(
            self.client.get(f"/api/rehearsals/?project={self.project.id}").data, [],
        )

    def test_a_revoked_grant_closes_the_page(self) -> None:
        RehearsalDelegate.objects.filter(artist=self.leader).update(is_deleted=True)
        self.client.force_authenticate(user=self.leader_user)
        self.assertEqual(self.client.get(f"/api/rehearsals/{self.tutti.id}/").status_code, 404)

    # --- announcements -----------------------------------------------------

    def test_the_queue_reaches_her_for_her_evening_and_the_tutti_only(self) -> None:
        self.assertIn(self._her_id, self._moved(self.hers))
        self.assertIn(self._her_id, self._moved(self.tutti))
        self.assertNotIn(self._her_id, self._moved(self.altos))
        self.assertIn(str(self.alto_user.pk), self._moved(self.altos))

        project_news = AnnouncementQueue.recipients_for(
            self.project,
            ResolvedAnnouncement(
                recipient_id=None,
                subject_type=AnnouncementSubject.PROJECT,
                subject_id=str(self.project.id),
                kind=AnnouncementKind.CHANGED,
                notification_type=NotificationType.PROJECT_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={},
                row_ids=(),
            ),
        )
        self.assertIn(self._her_id, project_news)

    def test_a_cast_leader_is_reached_once(self) -> None:
        Participation.objects.create(
            artist=self.leader, project=self.project, status=Participation.Status.CONFIRMED,
        )
        self.assertEqual(seatless_leader_user_ids(self.project), [])
        self.assertEqual(self._moved(self.tutti).count(self._her_id), 1)

    def test_a_declined_seat_does_not_silence_the_leader(self) -> None:
        """Declining to sing ends the seat's conversation, not the lead."""
        Participation.objects.create(
            artist=self.leader, project=self.project, status=Participation.Status.DECLINED,
        )
        self.assertIn(self._her_id, self._moved(self.hers))

    def test_a_completed_project_reaches_her_no_more(self) -> None:
        Project.objects.filter(pk=self.project.pk).update(status=Project.Status.COMPLETED)
        self.project.refresh_from_db()
        self.assertNotIn(self._her_id, self._moved(self.tutti))

    def test_cancelling_her_evening_tells_her(self) -> None:
        from roster.services import RehearsalOperationsService

        with patch(BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.delete_rehearsal(self.hers)
        bulk.assert_called_once()
        self.assertIn(self._her_id, bulk.call_args.kwargs["recipient_ids"])

        with patch(BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.delete_rehearsal(self.altos)
        self.assertNotIn(self._her_id, bulk.call_args.kwargs["recipient_ids"])

    def test_cancelling_the_project_tells_her(self) -> None:
        from roster.dtos import ProjectUpdateDTO
        from roster.services import ProjectManagementService

        with patch(BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.CANCELLED),
            )
        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.PROJECT_CANCELLED,
        )
        self.assertIn(self._her_id, bulk.call_args.kwargs["recipient_ids"])

    # --- the day-before reminder ----------------------------------------------

    def test_the_reminder_reaches_her_evening_without_a_window(self) -> None:
        from roster.tasks import _dispatch_rehearsal_reminders

        tomorrow = (datetime.now(WARSAW) + timedelta(days=1)).replace(
            hour=18, minute=0, second=0, microsecond=0,
        )
        Rehearsal.objects.filter(pk=self.hers.pk).update(date_time=tomorrow)
        Rehearsal.objects.filter(pk=self.altos.pk).update(date_time=tomorrow + timedelta(hours=3))
        with (
            override_settings(REHEARSAL_REMINDER_LEAD_HOURS=48),
            patch("roster.tasks.send_bulk_notifications_task.delay") as delay,
        ):
            _dispatch_rehearsal_reminders(timezone.now())

        reached: dict[str, list[dict[str, Any]]] = {}
        for call in delay.call_args_list:
            for recipient in call.kwargs["recipient_ids"]:
                reached.setdefault(recipient, []).append(call.kwargs["metadata"])
        hers = reached[self._her_id]
        self.assertEqual([meta["rehearsal_id"] for meta in hers], [str(self.hers.id)])
        self.assertIsNone(hers[0]["my_window"])

    # --- the subscribed calendar ------------------------------------------------

    def test_her_feed_carries_the_evenings_that_call_her(self) -> None:
        feed = self._her_feed()
        self.assertIn(str(self.hers.id), feed)
        self.assertIn(str(self.tutti.id), feed)
        self.assertNotIn(str(self.altos.id), feed)
        self.assertNotIn(str(self.elsewhere.id), feed)

    def test_a_seat_elsewhere_does_not_call_her_to_this_programmes_sectional(self) -> None:
        """The seat's own rule names no project in its tutti branch: an alto
        seat in another programme must not open this one's alto sectional."""
        Participation.objects.create(
            artist=self.leader, project=self.elsewhere.project,
            status=Participation.Status.CONFIRMED,
        )
        feed = self._her_feed()
        self.assertIn(str(self.elsewhere.id), feed)
        self.assertIn(str(self.hers.id), feed)
        self.assertNotIn(str(self.altos.id), feed)

    def test_a_draft_stays_out_of_her_feed(self) -> None:
        Project.objects.filter(pk=self.project.pk).update(status=Project.Status.DRAFT)
        self.assertNotIn(str(self.hers.id), self._her_feed())
