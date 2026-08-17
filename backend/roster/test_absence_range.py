"""
Absence over a date range — `POST /api/attendances/range/`.

A singer away for three weeks states it once. The window is wall-clock and
inclusive, and it writes a row only where they actually hold a seat: a range
reaching across two productions must not mark them absent from a rehearsal they
were never invited to, from a project still in draft, or from one they declined.
"""

import zoneinfo
from datetime import datetime
from typing import ClassVar
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from notifications.models import NotificationType

from .models import (
    Artist,
    Attendance,
    Participation,
    Project,
    Rehearsal,
    VoiceType,
)

NOTIFY_MANAGERS = "roster.services.ManagerNotificationHelper.notify_managers"
ARTIST_NOTIFICATION = "roster.services.send_notification_task.delay"


class AbsenceRangeTests(APITestCase):
    URL = "/api/attendances/range/"
    WARSAW = zoneinfo.ZoneInfo("Europe/Warsaw")
    WINDOW: ClassVar[dict[str, str]] = {
        "starts_at": "2026-08-03T00:00",
        "ends_at": "2026-08-21T23:59",
    }

    def _rehearsal(self, project, day, invited=None) -> Rehearsal:
        rehearsal = Rehearsal.objects.create(
            project=project,
            date_time=datetime(2026, 8, day, 19, tzinfo=self.WARSAW),
            timezone="Europe/Warsaw",
        )
        if invited is not None:
            rehearsal.invited_participations.set(invited)
        return rehearsal

    def setUp(self) -> None:
        User = get_user_model()

        self.singer_user = User.objects.create_user(
            username="rng-singer", email="rng-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Rena", last_name="Range",
            email="rng-singer@test.pl", voice_type=VoiceType.ALTO,
        )

        self.outsider_user = User.objects.create_user(
            username="rng-out", email="rng-out@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.outsider_user, role=AppRole.ARTIST)
        self.outsider = Artist.objects.create(
            user=self.outsider_user, first_name="Otto", last_name="Outsider",
            email="rng-out@test.pl", voice_type=VoiceType.BASS,
        )

        self.manager_user = User.objects.create_user(
            username="rng-mgr", email="rng-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        concert_day = datetime(2026, 9, 1, 19, tzinfo=self.WARSAW)

        # Two live productions the singer is cast in — the range crosses them.
        self.project_a = Project.objects.create(
            title="August Vespers", date_time=concert_day, status=Project.Status.ACTIVE
        )
        self.part_a = Participation.objects.create(
            artist=self.singer, project=self.project_a,
            status=Participation.Status.CONFIRMED,
        )
        self.part_a_other = Participation.objects.create(
            artist=self.outsider, project=self.project_a,
            status=Participation.Status.CONFIRMED,
        )
        self.project_b = Project.objects.create(
            title="Harvest Mass", date_time=concert_day, status=Project.Status.ACTIVE
        )
        self.part_b = Participation.objects.create(
            artist=self.singer, project=self.project_b,
            status=Participation.Status.CONFIRMED,
        )

        # A draft the singer is cast in — unpublished, so it is not their schedule.
        self.project_draft = Project.objects.create(
            title="Unannounced Gala", date_time=concert_day, status=Project.Status.DRAFT
        )
        Participation.objects.create(
            artist=self.singer, project=self.project_draft,
            status=Participation.Status.CONFIRMED,
        )

        # A production the singer turned down.
        self.project_declined = Project.objects.create(
            title="Passed Up", date_time=concert_day, status=Project.Status.ACTIVE
        )
        Participation.objects.create(
            artist=self.singer, project=self.project_declined,
            status=Participation.Status.DECLINED,
        )

        # Seven rehearsals inside the window; the singer takes part in four.
        self.reh_tutti = self._rehearsal(self.project_a, 4)
        self.reh_others_only = self._rehearsal(
            self.project_a, 6, invited=[self.part_a_other]
        )
        self.reh_invited = self._rehearsal(self.project_a, 11, invited=[self.part_a])
        self.reh_other_project = self._rehearsal(self.project_b, 13)
        self.reh_other_project_invited = self._rehearsal(
            self.project_b, 18, invited=[self.part_b]
        )
        self.reh_draft = self._rehearsal(self.project_draft, 12)
        self.reh_declined = self._rehearsal(self.project_declined, 14)

        # Outside the window, on the near side and the far side.
        self.reh_before = self._rehearsal(self.project_a, 2)
        self.reh_after = self._rehearsal(self.project_a, 22)

        self.mine = {
            self.reh_tutti.id,
            self.reh_invited.id,
            self.reh_other_project.id,
            self.reh_other_project_invited.id,
        }

    def _post(self, user, **overrides):
        self.client.force_authenticate(user=user)
        payload = {
            "artist": str(self.singer.id),
            **self.WINDOW,
            "status": "ABSENT",
            "excuse_note": "Rodzinny wyjazd",
            **overrides,
        }
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(self.URL, payload, format="json")

    def _written_rehearsal_ids(self) -> set:
        return set(
            Attendance.objects.filter(participation__artist=self.singer).values_list(
                "rehearsal_id", flat=True
            )
        )

    @patch(NOTIFY_MANAGERS)
    def test_range_writes_only_rehearsals_the_artist_takes_part_in(self, _notify) -> None:
        response = self._post(self.singer_user)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 4)
        self.assertEqual(self._written_rehearsal_ids(), self.mine)

        rows = Attendance.objects.filter(participation__artist=self.singer)
        self.assertTrue(all(row.status == "ABSENT" for row in rows))
        self.assertTrue(all(row.excuse_note == "Rodzinny wyjazd" for row in rows))
        # Nobody else was touched by a range stated about one singer.
        self.assertFalse(
            Attendance.objects.filter(participation__artist=self.outsider).exists()
        )

    @patch(NOTIFY_MANAGERS)
    def test_the_same_range_twice_leaves_the_same_rows(self, _notify) -> None:
        first = self._post(self.singer_user)
        after_first = Attendance.objects.count()

        second = self._post(self.singer_user, excuse_note="Wyjazd — przedłużony")

        self.assertEqual(first.data["updated"], second.data["updated"])
        self.assertEqual(Attendance.objects.count(), after_first)
        self.assertEqual(self._written_rehearsal_ids(), self.mine)
        # The repeat is an update, so the newer note is the one that stands.
        self.assertEqual(
            set(
                Attendance.objects.filter(participation__artist=self.singer).values_list(
                    "excuse_note", flat=True
                )
            ),
            {"Wyjazd — przedłużony"},
        )

    @patch(NOTIFY_MANAGERS)
    def test_a_singer_cannot_state_someone_elses_absence(self, notify) -> None:
        response = self._post(self.outsider_user)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.exists())
        notify.assert_not_called()

    @patch(ARTIST_NOTIFICATION)
    def test_a_manager_may_state_it_for_the_singer(self, notify) -> None:
        response = self._post(self.manager_user, status="EXCUSED")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 4)
        self.assertEqual(self._written_rehearsal_ids(), self.mine)
        # One decision per production, addressed to the singer.
        self.assertEqual(notify.call_count, 2)
        self.assertEqual(
            {call.kwargs["notification_type"] for call in notify.call_args_list},
            {NotificationType.ABSENCE_APPROVED},
        )

    @patch(NOTIFY_MANAGERS)
    def test_managers_hear_once_per_production_not_once_per_evening(self, notify) -> None:
        self._post(self.singer_user)

        self.assertEqual(notify.call_count, 2)
        counts = sorted(
            call.kwargs["metadata"]["rehearsal_count"] for call in notify.call_args_list
        )
        self.assertEqual(counts, [2, 2])
        for call in notify.call_args_list:
            metadata = call.kwargs["metadata"]
            self.assertEqual(
                call.kwargs["notification_type"], NotificationType.ABSENCE_REQUESTED
            )
            self.assertGreater(metadata["ends_at"], metadata["starts_at"])
            self.assertEqual(metadata["excuse_note"], "Rodzinny wyjazd")

    @patch(NOTIFY_MANAGERS)
    def test_the_window_is_read_on_the_rehearsals_own_clock(self, _notify) -> None:
        # 00:30 in Warsaw on the 22nd is still the 21st in UTC. The singer said
        # "until the 21st" about the calendar they read, not about UTC.
        late_night = Rehearsal.objects.create(
            project=self.project_a,
            date_time=datetime(2026, 8, 22, 0, 30, tzinfo=self.WARSAW),
            timezone="Europe/Warsaw",
        )

        self._post(self.singer_user)

        self.assertNotIn(late_night.id, self._written_rehearsal_ids())

    @patch(NOTIFY_MANAGERS)
    def test_a_window_with_no_rehearsals_writes_nothing(self, notify) -> None:
        response = self._post(
            self.singer_user, starts_at="2027-01-01T00:00", ends_at="2027-01-31T23:59"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 0)
        self.assertFalse(Attendance.objects.exists())
        notify.assert_not_called()

    @patch(NOTIFY_MANAGERS)
    def test_lateness_is_not_a_span(self, _notify) -> None:
        response = self._post(self.singer_user, status="LATE")

        self.assertEqual(response.status_code, 400)
        self.assertIn("validation_errors", response.data)
        self.assertFalse(Attendance.objects.exists())

    @patch(NOTIFY_MANAGERS)
    def test_a_backwards_window_is_refused(self, _notify) -> None:
        response = self._post(
            self.singer_user, starts_at="2026-08-21T00:00", ends_at="2026-08-03T23:59"
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    @patch(NOTIFY_MANAGERS)
    def test_a_window_longer_than_a_year_is_refused(self, _notify) -> None:
        # A mistyped year would otherwise reach back over a whole career.
        response = self._post(
            self.singer_user, starts_at="2020-08-03T00:00", ends_at="2026-08-21T23:59"
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.exists())
