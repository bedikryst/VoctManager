"""
How long an attendance row stays the singer's own — `/api/attendances/`.

Attendance has two authors. A singer *reports*: they say what they are going to
do, and they may keep saying it until the evening in question is out. A manager
*records*: the roll call is the choir's account of what happened, and correcting
it afterwards is their job alone. Nothing enforced that split until now — a
member could mark last season's rehearsal PRESENT today, through the create path
or by editing a row of their own, and the roster read as fact.

Every date is an offset from the day the suite runs; a fixed one would drift into
the past and quietly start asserting the opposite rule.
"""

import zoneinfo
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile

from .models import Artist, Attendance, Participation, Project, Rehearsal, VoiceType

LIST_URL = "/api/attendances/"
WARSAW = zoneinfo.ZoneInfo("Europe/Warsaw")


class SelfReportWindowTests(APITestCase):
    def _rehearsal(self, day_offset: int, hour: int = 19) -> Rehearsal:
        day = timezone.localtime(timezone.now(), WARSAW).date() + timedelta(
            days=day_offset
        )
        return Rehearsal.objects.create(
            project=self.project,
            date_time=datetime(day.year, day.month, day.day, hour, tzinfo=WARSAW),
            timezone="Europe/Warsaw",
        )

    def setUp(self) -> None:
        User = get_user_model()

        self.singer_user = User.objects.create_user(
            username="win-singer", email="win-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Wera", last_name="Window",
            email="win-singer@test.pl", voice_type=VoiceType.SOPRANO,
        )

        self.other_user = User.objects.create_user(
            username="win-other", email="win-other@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.other_user, role=AppRole.ARTIST)
        self.other = Artist.objects.create(
            user=self.other_user, first_name="Olga", last_name="Other",
            email="win-other@test.pl", voice_type=VoiceType.ALTO,
        )

        self.manager_user = User.objects.create_user(
            username="win-mgr", email="win-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Adwentowe Nieszpory",
            date_time=timezone.now() + timedelta(days=40),
            status=Project.Status.ACTIVE,
        )
        self.seat = Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.other_seat = Participation.objects.create(
            artist=self.other, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

        self.held = self._rehearsal(-30)
        self.tonight = self._rehearsal(0, hour=8)
        self.ahead = self._rehearsal(7)

    def _report(self, user, rehearsal, status="PRESENT"):
        self.client.force_authenticate(user=user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                LIST_URL,
                {
                    "rehearsal": str(rehearsal.id),
                    "participation": str(self.seat.id),
                    "status": status,
                    "excuse_note": "",
                },
                format="json",
            )

    # ── The create path ──────────────────────────────────────────────────

    def test_a_singer_cannot_mark_a_rehearsal_that_has_been_held(self) -> None:
        response = self._report(self.singer_user, self.held)

        self.assertEqual(response.status_code, 403)
        # The same coded refusal an edit gets, so the panel says why rather than
        # falling back to "you do not have access".
        self.assertEqual(response.data["error_code"], "attendance_window_closed")
        self.assertFalse(Attendance.objects.exists())

    def test_a_singer_may_still_answer_for_an_evening_under_way(self) -> None:
        # 8 a.m. today. "I'm running late" and "I never made it" are both reports
        # a singer files after the downbeat, so the day — not the hour — is the line.
        response = self._report(self.singer_user, self.tonight, status="LATE")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Attendance.objects.get().rehearsal_id, self.tonight.id)

    def test_a_manager_may_record_a_rehearsal_that_has_been_held(self) -> None:
        response = self._report(self.manager_user, self.held)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Attendance.objects.get().rehearsal_id, self.held.id)

    # ── The edit path (where the create gate was walked around) ──────────

    def test_a_singer_cannot_edit_their_own_row_on_a_rehearsal_held(self) -> None:
        row = Attendance.objects.create(
            rehearsal=self.held, participation=self.seat, status="ABSENT"
        )

        self.client.force_authenticate(user=self.singer_user)
        response = self.client.patch(
            f"{LIST_URL}{row.id}/", {"status": "PRESENT"}, format="json"
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error_code"], "attendance_window_closed")
        row.refresh_from_db()
        self.assertEqual(row.status, "ABSENT")

    def test_a_singer_cannot_delete_their_record_of_a_rehearsal_held(self) -> None:
        row = Attendance.objects.create(
            rehearsal=self.held, participation=self.seat, status="ABSENT"
        )

        self.client.force_authenticate(user=self.singer_user)
        response = self.client.delete(f"{LIST_URL}{row.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Attendance.objects.filter(id=row.id).exists())

    def test_a_singer_may_still_edit_their_report_for_an_evening_ahead(self) -> None:
        row = Attendance.objects.create(
            rehearsal=self.ahead, participation=self.seat, status="ABSENT",
            excuse_note="Wyjazd",
        )

        self.client.force_authenticate(user=self.singer_user)
        response = self.client.patch(
            f"{LIST_URL}{row.id}/",
            {"status": "PRESENT", "excuse_note": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, "PRESENT")

    def test_a_manager_may_correct_a_row_on_a_rehearsal_held(self) -> None:
        row = Attendance.objects.create(
            rehearsal=self.held, participation=self.seat, status="ABSENT"
        )

        self.client.force_authenticate(user=self.manager_user)
        response = self.client.patch(
            f"{LIST_URL}{row.id}/", {"status": "PRESENT"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.status, "PRESENT")

    def test_an_edit_cannot_re_point_a_row_at_somebody_else(self) -> None:
        # The queryset scopes a singer to rows of their own; without this, one of
        # those rows was a writable pointer to any seat in the choir.
        row = Attendance.objects.create(
            rehearsal=self.ahead, participation=self.seat, status="ABSENT"
        )

        self.client.force_authenticate(user=self.singer_user)
        response = self.client.patch(
            f"{LIST_URL}{row.id}/",
            {"participation": str(self.other_seat.id), "status": "ABSENT"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        row.refresh_from_db()
        self.assertEqual(row.participation_id, self.seat.id)
        self.assertFalse(
            Attendance.objects.filter(participation=self.other_seat).exists()
        )
