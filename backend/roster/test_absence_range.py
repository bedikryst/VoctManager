"""
Absence over a date range — `POST /api/attendances/range/` and the count a
caller is shown first, `GET /api/attendances/range-preview/`.

A singer away for three weeks states it once. The window is wall-clock and
inclusive, and it writes a row only where they actually hold a seat: a range
reaching across two productions must not mark them absent from a rehearsal they
were never invited to, from a project still in draft, called off, or one they
declined. The preview answers the same question through the same resolver, so
the number promised before sending is the number written.
"""

import zoneinfo
from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
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


class AbsenceRangeFixture(APITestCase):
    """
    One choir, one calendar — shared by the write and the preview, because a
    fixture each is how the two would come to disagree about what a span covers.

    Every date here is an offset from the day the suite runs, never a literal.
    The rule under test is itself about the clock — a singer may speak for the
    evenings ahead of them and not for the ones already held — so a fixture
    written in fixed dates would pass until it silently drifted into the past and
    started asserting the opposite rule.
    """

    URL = "/api/attendances/range/"
    WARSAW = zoneinfo.ZoneInfo("Europe/Warsaw")

    @classmethod
    def _day(cls, offset: int) -> date:
        return timezone.localtime(timezone.now(), cls.WARSAW).date() + timedelta(
            days=offset
        )

    @classmethod
    def _wall_clock(cls, offset: int, clock: str) -> str:
        return f"{cls._day(offset).isoformat()}T{clock}"

    def _window(self, start_offset: int = 2, end_offset: int = 20) -> dict[str, str]:
        return {
            "starts_at": self._wall_clock(start_offset, "00:00"),
            "ends_at": self._wall_clock(end_offset, "23:59"),
        }

    def _rehearsal(
        self, project, day_offset, invited=None, hour=19, minute=0
    ) -> Rehearsal:
        day = self._day(day_offset)
        rehearsal = Rehearsal.objects.create(
            project=project,
            date_time=datetime(
                day.year, day.month, day.day, hour, minute, tzinfo=self.WARSAW
            ),
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

        concert_day = timezone.now() + timedelta(days=60)

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

        # A production that was called off. Nobody has to be absent from it.
        self.project_cancelled = Project.objects.create(
            title="Scrapped Gala", date_time=concert_day,
            status=Project.Status.CANCELLED,
        )
        Participation.objects.create(
            artist=self.singer, project=self.project_cancelled,
            status=Participation.Status.CONFIRMED,
        )

        # Seven rehearsals inside the window; the singer takes part in four.
        self.reh_tutti = self._rehearsal(self.project_a, 3)
        self.reh_others_only = self._rehearsal(
            self.project_a, 5, invited=[self.part_a_other]
        )
        self.reh_invited = self._rehearsal(self.project_a, 10, invited=[self.part_a])
        self.reh_other_project = self._rehearsal(self.project_b, 12)
        self.reh_other_project_invited = self._rehearsal(
            self.project_b, 17, invited=[self.part_b]
        )
        self.reh_draft = self._rehearsal(self.project_draft, 11)
        self.reh_declined = self._rehearsal(self.project_declined, 13)
        self.reh_cancelled = self._rehearsal(self.project_cancelled, 14)

        # Outside the window, on the near side and the far side.
        self.reh_before = self._rehearsal(self.project_a, 1)
        self.reh_after = self._rehearsal(self.project_a, 21)

        # Already held: the singer's seat, but the roll call's record.
        self.reh_last_week = self._rehearsal(self.project_a, -7)
        self.reh_yesterday = self._rehearsal(self.project_b, -1)
        # Earlier today — still theirs to answer for until the day is out.
        self.reh_this_morning = self._rehearsal(self.project_a, 0, hour=8)

        self.mine = {
            self.reh_tutti.id,
            self.reh_invited.id,
            self.reh_other_project.id,
            self.reh_other_project_invited.id,
        }
        self.mine_already_held = {self.reh_last_week.id, self.reh_yesterday.id}

    def _post(self, user, **overrides):
        self.client.force_authenticate(user=user)
        payload = {
            "artist": str(self.singer.id),
            **self._window(),
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


class AbsenceRangeTests(AbsenceRangeFixture):
    """The write itself: which rows a span reaches, and who it tells."""

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
        # 00:30 in Warsaw on the day after the window closes is still inside it
        # in UTC. The singer named the calendar they read, not UTC.
        late_night = self._rehearsal(self.project_a, 21, hour=0, minute=30)

        self._post(self.singer_user)

        self.assertNotIn(late_night.id, self._written_rehearsal_ids())

    @patch(NOTIFY_MANAGERS)
    def test_a_window_with_no_rehearsals_writes_nothing(self, notify) -> None:
        response = self._post(
            self.singer_user,
            starts_at=self._wall_clock(200, "00:00"),
            ends_at=self._wall_clock(230, "23:59"),
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
            self.singer_user,
            starts_at=self._wall_clock(20, "00:00"),
            ends_at=self._wall_clock(2, "23:59"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    @patch(NOTIFY_MANAGERS)
    def test_a_window_longer_than_a_year_is_refused(self, _notify) -> None:
        # A mistyped year would otherwise reach back over a whole career.
        response = self._post(
            self.singer_user,
            starts_at=self._wall_clock(-2000, "00:00"),
            ends_at=self._wall_clock(20, "23:59"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Attendance.objects.exists())

    @patch(NOTIFY_MANAGERS)
    def test_a_singer_cannot_reach_back_over_rehearsals_already_held(
        self, _notify
    ) -> None:
        # The span opens a week ago and runs three weeks out. Everything from
        # today on is theirs to declare; the two evenings behind them are not.
        response = self._post(
            self.singer_user, starts_at=self._wall_clock(-7, "00:00")
        )

        self.assertEqual(response.status_code, 200)
        written = self._written_rehearsal_ids()
        self.assertEqual(written & self.mine_already_held, set())
        self.assertEqual(response.data["updated"], len(written))
        self.assertIn(self.reh_this_morning.id, written)

    @patch(ARTIST_NOTIFICATION)
    def test_a_manager_may_still_correct_a_rehearsal_already_held(self, _notify) -> None:
        response = self._post(
            self.manager_user,
            status="EXCUSED",
            starts_at=self._wall_clock(-7, "00:00"),
        )

        self.assertEqual(response.status_code, 200)
        # The manager's window is the whole span they named: the roll call is
        # theirs to correct, which is the difference this rule turns on.
        self.assertTrue(self.mine_already_held <= self._written_rehearsal_ids())

    @patch(NOTIFY_MANAGERS)
    def test_a_called_off_production_is_not_something_to_be_absent_from(
        self, _notify
    ) -> None:
        # It is off the singer's schedule, so it must be off the range too —
        # the two read the same seat query for exactly this reason.
        self._post(self.singer_user)

        self.assertNotIn(self.reh_cancelled.id, self._written_rehearsal_ids())

    @patch(NOTIFY_MANAGERS)
    def test_todays_rehearsal_is_still_the_singers_to_answer_for(self, _notify) -> None:
        # 8 a.m. today, reported at whatever hour the suite runs: an evening
        # under way is still a report, not a rewrite of the record.
        response = self._post(
            self.singer_user,
            starts_at=self._wall_clock(0, "00:00"),
            ends_at=self._wall_clock(0, "23:59"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 1)
        self.assertEqual(self._written_rehearsal_ids(), {self.reh_this_morning.id})


class AbsenceRangePreviewTests(AbsenceRangeFixture):
    """
    The count stated before the send — `GET /api/attendances/range-preview/`.

    A chorister needs no round trip: their own schedule read-model already is the
    set, and resolving it on the client keeps the number honest offline. A manager
    excusing somebody else holds no such list, and rebuilding the seat rule in the
    browser is how the number shown and the rows written begin to disagree. So
    these assert one thing above all: the preview and the write answer with the
    same rehearsals, for the same caller.
    """

    PREVIEW_URL = "/api/attendances/range-preview/"

    def _preview(self, user, **overrides):
        self.client.force_authenticate(user=user)
        return self.client.get(
            self.PREVIEW_URL,
            {"artist": str(self.singer.id), **self._window(), **overrides},
        )

    def _preview_ids(self, response) -> set:
        return {row["id"] for row in response.data["rehearsals"]}

    @patch(NOTIFY_MANAGERS)
    def test_the_preview_names_exactly_what_the_write_would_touch(self, _notify) -> None:
        preview = self._preview(self.manager_user)
        written = self._post(self.manager_user, status="EXCUSED")

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["count"], written.data["updated"])
        self.assertEqual(
            self._preview_ids(preview), {str(rid) for rid in self._written_rehearsal_ids()}
        )

    def test_the_preview_carries_the_production_and_what_is_already_written(
        self,
    ) -> None:
        Attendance.objects.create(
            rehearsal=self.reh_tutti, participation=self.part_a, status="PRESENT"
        )

        response = self._preview(self.manager_user)

        rows = {row["id"]: row for row in response.data["rehearsals"]}
        marked = rows[str(self.reh_tutti.id)]
        self.assertEqual(marked["project_title"], self.project_a.title)
        # A manager needs to see which evenings a span would overwrite rather
        # than fill in — an excusal is not always a blank line.
        self.assertEqual(marked["current_status"], "PRESENT")
        self.assertIsNone(rows[str(self.reh_invited.id)]["current_status"])

    def test_a_singers_preview_stops_where_their_write_stops(self) -> None:
        response = self._preview(
            self.singer_user, starts_at=self._wall_clock(-7, "00:00")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._preview_ids(response) & {
            str(rid) for rid in self.mine_already_held
        }, set())
        self.assertIn(str(self.reh_this_morning.id), self._preview_ids(response))

    def test_a_singer_cannot_preview_somebody_elses_schedule(self) -> None:
        # The preview is a read of one person's diary; the gate is the same one
        # the write uses, because otherwise it becomes a way to browse them.
        response = self._preview(self.outsider_user)

        self.assertEqual(response.status_code, 400)

    def test_a_malformed_window_is_refused_rather_than_previewed(self) -> None:
        response = self._preview(self.manager_user, ends_at="not-a-date")

        self.assertEqual(response.status_code, 400)
        self.assertIn("validation_errors", response.data)
