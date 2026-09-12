"""
@file test_delegate_attendance.py
@description The roll call in a stand-in's hands.

    Attendance has two authors: the singer, who REPORTS what they are going to
    do, and whoever takes the roll call, whose record is the choir's. A
    delegation moves one person across that line for one project — and the tests
    here pin what it does not move with them.

    Three things matter. The stand-in must be able to write other people's rows,
    or they cannot take a roll call at all. They must NOT be able to do it on a
    project nobody handed them. And marking somebody ABSENT in front of the choir
    must not reach that singer as a verdict on an excuse they never filed — that
    is a manager's answer to a request, not an observation of who turned up.

@architecture Enterprise SaaS 2026
@module roster/test_delegate_attendance
"""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from notifications.models import Notification
from roster.models import (
    Artist,
    Attendance,
    Participation,
    Project,
    Rehearsal,
    RehearsalDelegate,
    VoiceType,
)

_ENDPOINT = "/api/attendances/"


class DelegateRollCallTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Adwent", status=Project.Status.ACTIVE,
        )
        self.other_project = Project.objects.create(
            title="Wielkanoc", status=Project.Status.ACTIVE,
        )

        self.deputy_user, self.deputy, self.deputy_seat = self._member(
            "deputy", "Kasia", "Nowak", self.project,
        )
        self.singer_user, self.singer, self.singer_seat = self._member(
            "singer", "Jan", "Kowalski", self.project,
        )
        _, _, self.outsider_seat = self._member(
            "outsider", "Ewa", "Zielinska", self.other_project,
        )

        self.rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2),
        )
        self.other_rehearsal = Rehearsal.objects.create(
            project=self.other_project, date_time=timezone.now() + timedelta(days=2),
        )
        self.held_rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() - timedelta(days=3),
        )

    def _member(self, handle: str, first: str, last: str, project: Project):
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456",
            first_name=first, last_name=last,
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=first, last_name=last,
            email=f"{handle}@test.pl", voice_type=VoiceType.TENOR,
        )
        seat = Participation.objects.create(
            artist=artist, project=project,
            status=Participation.Status.CONFIRMED,
        )
        return user, artist, seat

    def _grant(self, **overrides) -> RehearsalDelegate:
        return RehearsalDelegate.objects.create(
            project=self.project, artist=self.deputy,
            granted_by=self.manager, **overrides,
        )

    def _record(self, *, rehearsal, participation, status="PRESENT"):
        return self.client.post(
            _ENDPOINT,
            {
                "rehearsal": str(rehearsal.pk),
                "participation": str(participation.pk),
                "status": status,
            },
            format="json",
        )

    # --- the roll call itself -------------------------------------------------

    def test_a_singer_cannot_mark_a_colleague(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.rehearsal, participation=self.singer_seat,
        )
        self.assertEqual(response.status_code, 400)

    def test_a_delegate_marks_the_whole_section(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.rehearsal, participation=self.singer_seat,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Attendance.objects.get(
                rehearsal=self.rehearsal, participation=self.singer_seat,
            ).status,
            "PRESENT",
        )

    def test_a_delegate_reads_the_sheet_they_are_filling_in(self) -> None:
        # A stand-in shown one name — their own — could not take a roll call.
        self._grant()
        Attendance.objects.create(
            rehearsal=self.rehearsal, participation=self.singer_seat, status="PRESENT",
        )
        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"{_ENDPOINT}?rehearsal={self.rehearsal.pk}")
        self.assertEqual(response.status_code, 200)
        rows = response.json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(
            {row["participation"] for row in rows}, {str(self.singer_seat.pk)},
        )

    def test_the_roll_call_scope_can_be_withheld_while_the_grant_stands(self) -> None:
        self._grant(can_take_roll_call=False)
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.rehearsal, participation=self.singer_seat,
        )
        self.assertEqual(response.status_code, 400)

    def test_a_delegate_may_correct_the_record_after_the_evening(self) -> None:
        # The self-report window closes at the end of the rehearsal's own day;
        # whoever takes the roll call is never asked that question.
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.held_rehearsal, participation=self.singer_seat,
            status="ABSENT",
        )
        self.assertEqual(response.status_code, 201)

    def test_an_expired_grant_takes_the_roll_call_with_it(self) -> None:
        self._grant(expires_at=timezone.now() - timedelta(hours=1))
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.rehearsal, participation=self.singer_seat,
        )
        self.assertEqual(response.status_code, 400)

    # --- what the grant does not reach ---------------------------------------

    def test_a_grant_on_one_project_does_not_reach_another_s_rehearsal(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self._record(
            rehearsal=self.other_rehearsal, participation=self.outsider_seat,
        )
        self.assertEqual(response.status_code, 400)

    def test_a_delegate_does_not_get_the_span_excusal(self) -> None:
        # Excusing somebody across a fortnight is a decision about their standing
        # in the choir, not part of running one evening.
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self.client.post(
            f"{_ENDPOINT}range/",
            {
                "artist": str(self.singer.pk),
                "starts_at": (timezone.now() + timedelta(days=1)).strftime(
                    "%Y-%m-%dT%H:%M",
                ),
                "ends_at": (timezone.now() + timedelta(days=5)).strftime(
                    "%Y-%m-%dT%H:%M",
                ),
                "status": "EXCUSED",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    # --- what the roll call must not say -------------------------------------
    #
    # Every one of these runs inside `captureOnCommitCallbacks(execute=True)`.
    # Notifications are dispatched from `transaction.on_commit`, which never
    # fires under a TestCase's rolled-back transaction — so without it the two
    # "nothing was sent" assertions below would pass against any implementation
    # at all, including a broken one.

    def _record_on_commit(self, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            return self._record(**kwargs)

    def test_a_singer_reporting_themselves_raises_one(self) -> None:
        # The control: this is the signal the two tests below assert the ABSENCE
        # of, so it has to be shown to fire in the first place.
        self.client.force_authenticate(self.singer_user)
        response = self._record_on_commit(
            rehearsal=self.rehearsal, participation=self.singer_seat, status="ABSENT",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Notification.objects.filter(recipient=self.manager).exists(),
        )

    def test_a_roll_call_does_not_answer_an_excuse_nobody_filed(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        self._record_on_commit(
            rehearsal=self.rehearsal, participation=self.singer_seat, status="ABSENT",
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.singer_user).exists(),
        )

    def test_a_roll_call_is_not_forty_absence_requests(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        self._record_on_commit(
            rehearsal=self.rehearsal, participation=self.singer_seat, status="PRESENT",
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.manager).exists(),
        )

    # --- the evening has to be findable at all --------------------------------

    def test_the_roll_call_alone_still_puts_the_evening_on_the_timeline(self) -> None:
        # Every capability needs a project to hang off. Project visibility once
        # asked the MATERIALS scope, which made "opens materials" a silent
        # prerequisite: a manager who granted only the roll call handed out a
        # sheet with no way to reach it.
        RehearsalDelegate.objects.create(
            project=self.other_project, artist=self.deputy,
            granted_by=self.manager,
            can_see_leader_marks=False,
            can_open_materials=False,
            can_take_roll_call=True,
        )
        self.client.force_authenticate(self.deputy_user)

        timeline = self.client.get("/api/participations/schedule-dashboard/").json()
        leading = [
            row for row in timeline
            if row["type"] == "REHEARSAL"
            and row["rehearsal"]["id"] == str(self.other_rehearsal.pk)
        ]
        self.assertEqual(len(leading), 1)
        self.assertTrue(leading[0]["i_lead"])

        projects = self.client.get("/api/projects/").json()
        rows = projects["results"] if isinstance(projects, dict) else projects
        self.assertIn(str(self.other_project.pk), {row["id"] for row in rows})

    # --- the sheet itself -----------------------------------------------------

    def _sheet(self, rehearsal=None):
        return self.client.get(
            f"/api/rehearsals/{(rehearsal or self.rehearsal).pk}/lead-sheet/",
        )

    def test_a_delegate_is_handed_the_whole_choir_to_call_over(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self._sheet()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(
            {row["id"] for row in body["cast"]},
            {str(self.deputy_seat.pk), str(self.singer_seat.pk)},
        )
        # Not a manager, and the page must be told so rather than inferring it
        # from the read having worked.
        self.assertFalse(body["is_manager"])

    def test_the_sheet_carries_no_contact_details(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        artist = self._sheet().json()["cast"][0]["artist_detail"]
        self.assertNotIn("email", artist)
        self.assertNotIn("phone_number", artist)
        # …but enough to call a name and read a section off the sheet.
        self.assertTrue(artist["last_name"])
        self.assertTrue(artist["voice_type"])

    def test_a_singer_with_no_grant_is_told_nothing(self) -> None:
        self.client.force_authenticate(self.singer_user)
        self.assertEqual(self._sheet().status_code, 404)

    def test_a_grant_without_the_roll_call_does_not_open_the_sheet(self) -> None:
        # The marks and the register are separate keys; holding one is not
        # holding the other.
        self._grant(can_take_roll_call=False)
        self.client.force_authenticate(self.deputy_user)
        self.assertEqual(self._sheet().status_code, 404)

    def test_a_sectional_call_lists_only_who_was_summoned(self) -> None:
        self.rehearsal.invited_participations.set([self.singer_seat])
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        self.assertEqual(
            [row["id"] for row in self._sheet().json()["cast"]],
            [str(self.singer_seat.pk)],
        )

    def test_a_declined_seat_is_not_a_name_to_chase_at_the_door(self) -> None:
        self.singer_seat.status = Participation.Status.DECLINED
        self.singer_seat.save(update_fields=["status"])
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        self.assertEqual(
            [row["id"] for row in self._sheet().json()["cast"]],
            [str(self.deputy_seat.pk)],
        )

    def test_a_manager_reads_the_same_sheet_and_is_named_as_one(self) -> None:
        self.client.force_authenticate(self.manager)
        body = self._sheet().json()
        self.assertTrue(body["is_manager"])
        self.assertEqual(len(body["cast"]), 2)

    def test_a_manager_marking_absent_does_answer_the_singer(self) -> None:
        # The other half of the same distinction: a manager's ABSENT IS a verdict
        # and still reaches the singer. Only the stand-in's is silent.
        self.client.force_authenticate(self.manager)
        self._record_on_commit(
            rehearsal=self.rehearsal, participation=self.singer_seat, status="ABSENT",
        )
        self.assertTrue(
            Notification.objects.filter(recipient=self.singer_user).exists(),
        )
