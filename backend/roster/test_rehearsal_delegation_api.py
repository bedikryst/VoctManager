"""
@file test_rehearsal_delegation_api.py
@description The manager's list of who may run a project's rehearsals.

    Granting one is handing out the conductor's markings and the choir's
    attendance record, so the endpoint is manager-only and the row records who
    did it. Two shapes are pinned here because both are easy to get wrong: a
    re-grant after a revoke must work (the uniqueness constraint only covers
    live rows, so "this person leads it" cannot depend on whether anyone ever
    revoked one), and an edit must never be able to move a grant onto a
    different person — that would leave the audit line describing the wrong
    hand-over.

@architecture Enterprise SaaS 2026
@module roster/test_rehearsal_delegation_api
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from notifications.models import NotificationType
from roster.models import (
    Artist,
    Participation,
    Project,
    Rehearsal,
    RehearsalDelegate,
    VoiceType,
)
from roster.services import RehearsalDelegationService

TASK = "roster.services.send_notification_task"


class RehearsalDelegationApiTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Adwent", status=Project.Status.ACTIVE,
        )
        self.deputy_user, self.deputy = self._member("deputy", "Kasia", "Nowak")
        self.other_user, self.other = self._member("other", "Ewa", "Zielinska")

        self.endpoint = f"/api/projects/{self.project.pk}/delegates/"

    def _member(self, handle: str, first: str, last: str):
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
        Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        return user, artist

    def _grant(self, artist=None, **body):
        return self.client.post(
            self.endpoint,
            {"artist": str((artist or self.deputy).pk), **body},
            format="json",
        )

    def test_a_manager_grants_and_the_row_records_who_did(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self._grant(note="Wyjazd dyrygenta")
        self.assertEqual(response.status_code, 201)
        row = RehearsalDelegate.objects.get(project=self.project, artist=self.deputy)
        self.assertEqual(row.granted_by, self.manager)
        self.assertEqual(row.note, "Wyjazd dyrygenta")

    def test_a_singer_cannot_hand_the_project_to_anyone(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        self.assertEqual(self._grant().status_code, 403)
        self.assertEqual(self.client.get(self.endpoint).status_code, 403)

    def test_the_list_shows_live_grants_only(self) -> None:
        self.client.force_authenticate(self.manager)
        self._grant()
        revoked = self._grant(artist=self.other).json()
        self.client.delete(f"{self.endpoint}{revoked['id']}/")

        rows = self.client.get(self.endpoint).json()
        self.assertEqual(
            {row["artist"] for row in rows}, {str(self.deputy.pk)},
        )

    def test_granting_again_after_a_revoke_works(self) -> None:
        self.client.force_authenticate(self.manager)
        first = self._grant().json()
        self.client.delete(f"{self.endpoint}{first['id']}/")
        second = self._grant(can_take_roll_call=False)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            RehearsalDelegate.objects.filter(
                project=self.project, artist=self.deputy, is_deleted=False,
            ).count(),
            1,
        )
        self.assertFalse(second.json()["can_take_roll_call"])

    def test_narrowing_a_scope_leaves_the_person_alone(self) -> None:
        self.client.force_authenticate(self.manager)
        granted = self._grant().json()
        response = self.client.patch(
            f"{self.endpoint}{granted['id']}/",
            {"can_see_leader_marks": False, "artist": str(self.other.pk)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        row = RehearsalDelegate.objects.get(pk=granted["id"])
        self.assertFalse(row.can_see_leader_marks)
        # The `artist` in the body was ignored, not honoured.
        self.assertEqual(row.artist_id, self.deputy.pk)

    def test_the_suggestion_is_the_last_leader_who_does_not_lead_this_yet(self) -> None:
        """The add form pre-selects the most recently appointed leader anywhere.
        A suggestion, not a grant: nothing is written by asking. Somebody who
        already leads this project is not suggested for it again, and a revoked
        grant elsewhere still counts — it says who was last trusted."""
        suggested_url = f"{self.endpoint}suggested/"
        self.client.force_authenticate(self.manager)

        self.assertIsNone(self.client.get(suggested_url).json()["artist"])

        other_project = Project.objects.create(
            title="Wielkanoc", status=Project.Status.ACTIVE,
        )
        RehearsalDelegate.objects.create(
            project=other_project, artist=self.deputy, granted_by=self.manager,
        )
        self.assertEqual(
            self.client.get(suggested_url).json()["artist"], str(self.deputy.pk),
        )
        self.assertFalse(
            RehearsalDelegate.objects.filter(project=self.project).exists(),
        )

        self._grant(artist=self.deputy)
        self.assertIsNone(self.client.get(suggested_url).json()["artist"])

        # `all_objects`: the row for the other project being revoked does not
        # forget who led it, but a live grant here still keeps them off.
        RehearsalDelegate.objects.get(project=other_project).delete()
        self.assertIsNone(self.client.get(suggested_url).json()["artist"])

    def test_the_project_names_its_live_leaders(self) -> None:
        """`leaders` on the project is the fact beside "Conductor": live rows
        only, so a revoked leader disappears from the card at once."""
        self.client.force_authenticate(self.manager)
        granted = self._grant(artist=self.deputy).json()
        project_url = f"/api/projects/{self.project.pk}/"

        leaders = self.client.get(project_url).json()["leaders"]
        self.assertEqual(
            leaders, [{"artist_id": str(self.deputy.pk), "name": "Kasia Nowak"}],
        )

        self.client.delete(f"{self.endpoint}{granted['id']}/")
        self.assertEqual(self.client.get(project_url).json()["leaders"], [])

    def test_the_suggestion_is_manager_only(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"{self.endpoint}suggested/")
        self.assertEqual(response.status_code, 403)

    def test_a_delegate_of_another_project_is_not_reachable_here(self) -> None:
        other_project = Project.objects.create(
            title="Wielkanoc", status=Project.Status.ACTIVE,
        )
        foreign = RehearsalDelegate.objects.create(
            project=other_project, artist=self.deputy, granted_by=self.manager,
        )
        self.client.force_authenticate(self.manager)
        response = self.client.delete(f"{self.endpoint}{foreign.pk}/")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(RehearsalDelegate.objects.get(pk=foreign.pk).is_deleted)


class RehearsalLedByTests(APITestCase):
    """`Rehearsal.led_by` — who stands in front of one evening.

    An announcement, not a permission: the serializer accepts only somebody the
    register would already let in (the conductor, or a live leader with the
    roll call), and a revoked leader is taken off the evenings still ahead
    while the ones already held keep the name.
    """

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.conductor = Artist.objects.create(
            first_name="Florent", last_name="Dyrygent",
            email="dir@test.pl", voice_type=VoiceType.CONDUCTOR,
        )
        self.project = Project.objects.create(
            title="Adwent", status=Project.Status.ACTIVE, conductor=self.conductor,
        )
        self.leader_user, self.leader = self._member("leader", "Kasia", "Nowak")
        self.singer_user, self.singer = self._member("singer", "Ewa", "Zielinska")
        self.grant = RehearsalDelegate.objects.create(
            project=self.project, artist=self.leader, granted_by=self.manager,
        )

        self.upcoming = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2),
        )
        self.held = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() - timedelta(days=3),
            led_by=self.leader,
        )

    def _member(self, handle: str, first: str, last: str):
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456",
            first_name=first, last_name=last,
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=first, last_name=last,
            email=f"{handle}@test.pl", voice_type=VoiceType.SOPRANO,
        )
        Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        return user, artist

    def _set_lead(self, artist, rehearsal=None):
        return self.client.patch(
            f"/api/rehearsals/{(rehearsal or self.upcoming).pk}/",
            {"led_by_id": str(artist.pk) if artist else None},
            format="json",
        )

    def test_a_leader_with_the_roll_call_can_be_named(self) -> None:
        self.client.force_authenticate(self.manager)
        with patch(TASK):
            response = self._set_lead(self.leader)
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["led_by_artist_id"], str(self.leader.pk))
        # The bare name, as under the debrief: this line names an appointment,
        # not a seat in a section.
        self.assertEqual(body["led_by_name"], "Kasia Nowak")

    def test_the_conductor_can_be_named_explicitly(self) -> None:
        self.client.force_authenticate(self.manager)
        with patch(TASK):
            response = self._set_lead(self.conductor)
        self.assertEqual(response.status_code, 200, response.content)

    def test_a_singer_without_a_grant_is_refused(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self._set_lead(self.singer)
        self.assertEqual(response.status_code, 400)
        self.assertIn("led_by_id", response.json()["errors"])

    def test_a_grant_without_the_roll_call_does_not_qualify(self) -> None:
        self.grant.can_take_roll_call = False
        self.grant.save()
        self.client.force_authenticate(self.manager)
        response = self._set_lead(self.leader)
        self.assertEqual(response.status_code, 400)

    def test_null_hands_the_evening_back_and_tells_nobody(self) -> None:
        self.upcoming.led_by = self.leader
        self.upcoming.save()
        self.client.force_authenticate(self.manager)
        with patch(TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self._set_lead(None)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(response.json()["led_by_artist_id"])
        task.delay.assert_not_called()

    def test_naming_a_leader_tells_them_which_evening(self) -> None:
        self.client.force_authenticate(self.manager)
        with patch(TASK) as task, self.captureOnCommitCallbacks(execute=True):
            self._set_lead(self.leader)
        task.delay.assert_called_once()
        kwargs = task.delay.call_args.kwargs
        self.assertEqual(kwargs["recipient_id"], str(self.leader_user.pk))
        self.assertEqual(
            kwargs["notification_type"], NotificationType.REHEARSAL_LEAD_ASSIGNED,
        )
        self.assertEqual(kwargs["metadata"]["rehearsal_id"], str(self.upcoming.pk))
        self.assertEqual(kwargs["metadata"]["sections"], [])

    def test_a_sectional_names_its_sections_in_the_push(self) -> None:
        self.client.force_authenticate(self.manager)
        soprano_seat = Participation.objects.get(artist=self.singer)
        with patch(TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/rehearsals/{self.upcoming.pk}/",
                {
                    "led_by_id": str(self.leader.pk),
                    "invited_participations": [str(soprano_seat.pk)],
                },
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(task.delay.call_args.kwargs["metadata"]["sections"], ["S"])

    def test_revoking_clears_future_evenings_and_keeps_held_ones(self) -> None:
        self.upcoming.led_by = self.leader
        self.upcoming.save()
        with patch(TASK), self.captureOnCommitCallbacks(execute=True):
            RehearsalDelegationService.revoke(self.grant, revoked_by=self.manager)
        self.upcoming.refresh_from_db()
        self.held.refresh_from_db()
        self.assertIsNone(self.upcoming.led_by_id)
        self.assertEqual(self.held.led_by_id, self.leader.pk)

    def test_taking_the_register_back_clears_future_evenings_too(self) -> None:
        """Narrowing the scope ends the power, so it ends the announcement.

        The same rule as a revocation, reached the other way: a leader who may
        no longer take the roll cannot be the one standing in front of it.
        """
        self.upcoming.led_by = self.leader
        self.upcoming.save()
        self.client.force_authenticate(self.manager)
        with patch(TASK), self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/projects/{self.project.pk}/delegates/{self.grant.pk}/",
                {"can_take_roll_call": False},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.upcoming.refresh_from_db()
        self.held.refresh_from_db()
        self.assertIsNone(self.upcoming.led_by_id)
        self.assertEqual(self.held.led_by_id, self.leader.pk)

    def test_an_evening_whose_leader_lapsed_can_still_be_edited(self) -> None:
        """A name that does not change announces nothing, so it is not re-judged.

        The rehearsal form re-sends `led_by_id` on every save. Judging it there
        would leave an evening unmovable — not even its hour — the moment the
        grant behind the name ran out on the clock, with no control on screen
        to take the name off.
        """
        self.upcoming.led_by = self.leader
        self.upcoming.save()
        RehearsalDelegate.objects.filter(pk=self.grant.pk).update(
            expires_at=timezone.now() - timedelta(hours=1),
        )
        moved = timezone.now() + timedelta(days=4)

        self.client.force_authenticate(self.manager)
        with patch(TASK):
            response = self.client.patch(
                f"/api/rehearsals/{self.upcoming.pk}/",
                {"led_by_id": str(self.leader.pk), "date_time": moved.isoformat()},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.content)

        # Naming somebody NEW off a lapsed grant is still refused.
        with patch(TASK):
            refused = self._set_lead(self.singer)
        self.assertEqual(refused.status_code, 400)


class LeadSheetFocusTests(APITestCase):
    """PATCH `/lead-sheet/` — the one thing a leader may change about an
    evening is what it is about, behind the same authority as the read."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.project = Project.objects.create(title="Adwent", status=Project.Status.ACTIVE)

        self.leader_user = User.objects.create_user(
            "leader", "leader@test.pl", "pw123456", first_name="Kasia", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.leader_user, role=AppRole.ARTIST)
        self.leader = Artist.objects.create(
            user=self.leader_user, first_name="Kasia", last_name="Nowak",
            email="leader@test.pl", voice_type=VoiceType.SOPRANO,
        )
        self.singer_user = User.objects.create_user("singer", "singer@test.pl", "pw123456")
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        singer = Artist.objects.create(
            user=self.singer_user, first_name="Ewa", last_name="Zielinska",
            email="singer@test.pl", voice_type=VoiceType.ALTO,
        )
        Participation.objects.create(
            artist=singer, project=self.project, status=Participation.Status.CONFIRMED,
        )
        self.grant = RehearsalDelegate.objects.create(
            project=self.project, artist=self.leader, granted_by=self.manager,
        )
        self.rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2),
            focus="Kyrie",
        )
        self.url = f"/api/rehearsals/{self.rehearsal.pk}/lead-sheet/"

    def test_the_leader_sets_the_plan_and_gets_the_sheet_back(self) -> None:
        self.client.force_authenticate(self.leader_user)
        with patch(TASK):
            response = self.client.patch(self.url, {"focus": "Gloria, takty 1-40"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["rehearsal"]["focus"], "Gloria, takty 1-40")
        self.assertIn("cast", body)
        self.rehearsal.refresh_from_db()
        self.assertEqual(self.rehearsal.focus, "Gloria, takty 1-40")

    def test_null_clears_the_plan(self) -> None:
        self.client.force_authenticate(self.leader_user)
        with patch(TASK):
            response = self.client.patch(self.url, {"focus": None}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.rehearsal.refresh_from_db()
        self.assertEqual(self.rehearsal.focus, "")

    def test_a_grant_without_the_roll_call_cannot_write_it(self) -> None:
        self.grant.can_take_roll_call = False
        self.grant.save()
        self.client.force_authenticate(self.leader_user)
        response = self.client.patch(self.url, {"focus": "Gloria"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.rehearsal.refresh_from_db()
        self.assertEqual(self.rehearsal.focus, "Kyrie")

    def test_a_singer_cannot_write_it(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.patch(self.url, {"focus": "Gloria"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_only_the_plan_is_writable_here(self) -> None:
        self.client.force_authenticate(self.leader_user)
        response = self.client.patch(
            self.url, {"focus": "Gloria", "is_mandatory": False}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.rehearsal.refresh_from_db()
        self.assertTrue(self.rehearsal.is_mandatory)
        self.assertEqual(self.rehearsal.focus, "Kyrie")

    def test_an_empty_patch_is_refused(self) -> None:
        self.client.force_authenticate(self.leader_user)
        response = self.client.patch(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)


BULK_TASK = "roster.services.send_bulk_notifications_task"


class LeadSheetDebriefTests(APITestCase):
    """PATCH `/lead-sheet/ {debrief}` — the evening handed back in writing.
    Refused before the start; stamped with the writer; the managers are told
    of a first write and of a change, never of a wipe or of their own."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user(
            "mgr", "mgr@test.pl", "pw123456", first_name="Tomasz", last_name="Kuras",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.other_manager = User.objects.create_user("mgr2", "mgr2@test.pl", "pw123456")
        UserProfile.objects.create(user=self.other_manager, role=AppRole.MANAGER)
        self.project = Project.objects.create(title="Adwent", status=Project.Status.ACTIVE)

        self.leader_user = User.objects.create_user(
            "leader", "leader@test.pl", "pw123456", first_name="Kasia", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.leader_user, role=AppRole.ARTIST)
        self.leader = Artist.objects.create(
            user=self.leader_user, first_name="Kasia", last_name="Nowak",
            email="leader@test.pl", voice_type=VoiceType.SOPRANO,
        )
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.leader, granted_by=self.manager,
        )
        self.past = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() - timedelta(hours=2),
        )
        self.future = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2),
        )

    @staticmethod
    def _url(rehearsal: Rehearsal) -> str:
        return f"/api/rehearsals/{rehearsal.pk}/lead-sheet/"

    def test_the_leader_writes_it_up_and_the_managers_are_told(self) -> None:
        self.client.force_authenticate(self.leader_user)
        with patch(BULK_TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self._url(self.past), {"debrief": "Gloria stoi. Kyrie do powtórki."},
                format="json",
            )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()["rehearsal"]
        self.assertEqual(body["debrief"], "Gloria stoi. Kyrie do powtórki.")
        self.assertEqual(body["debrief_by_name"], "Kasia Nowak")
        self.assertIsNotNone(body["debrief_at"])

        self.past.refresh_from_db()
        self.assertEqual(self.past.debrief_by_id, self.leader.pk)

        task.delay.assert_called_once()
        kwargs = task.delay.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_DEBRIEF_POSTED)
        self.assertCountEqual(
            kwargs["recipient_ids"], [str(self.manager.pk), str(self.other_manager.pk)],
        )
        self.assertEqual(kwargs["metadata"]["author_name"], "Kasia Nowak")
        self.assertEqual(kwargs["metadata"]["excerpt"], "Gloria stoi. Kyrie do powtórki.")
        self.assertEqual(kwargs["metadata"]["rehearsal_id"], str(self.past.pk))

    def test_refused_before_the_rehearsal_has_started(self) -> None:
        self.client.force_authenticate(self.leader_user)
        with patch(BULK_TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self._url(self.future), {"debrief": "Za wcześnie"}, format="json",
            )
        self.assertEqual(response.status_code, 400)
        self.future.refresh_from_db()
        self.assertEqual(self.future.debrief, "")
        self.assertIsNone(self.future.debrief_at)
        task.delay.assert_not_called()

    def test_a_manager_writing_it_is_stamped_and_not_told_of_their_own(self) -> None:
        Artist.objects.create(
            user=self.manager, first_name="Tomasz", last_name="Kuras",
            email="mgr@test.pl", voice_type=VoiceType.BASS,
        )
        self.client.force_authenticate(self.manager)
        with patch(BULK_TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self._url(self.past), {"debrief": "Byłem sam."}, format="json",
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["rehearsal"]["debrief_by_name"], "Tomasz Kuras")
        kwargs = task.delay.call_args.kwargs
        self.assertEqual(kwargs["recipient_ids"], [str(self.other_manager.pk)])

    def test_a_change_is_announced_again_but_a_wipe_and_a_repeat_are_silent(self) -> None:
        self.client.force_authenticate(self.leader_user)
        with patch(BULK_TASK) as task, self.captureOnCommitCallbacks(execute=True):
            self.client.patch(self._url(self.past), {"debrief": "Pierwsza wersja"}, format="json")
            self.client.patch(self._url(self.past), {"debrief": "Pierwsza wersja"}, format="json")
            self.client.patch(self._url(self.past), {"debrief": "Druga wersja"}, format="json")
            self.client.patch(self._url(self.past), {"debrief": ""}, format="json")
        self.assertEqual(task.delay.call_count, 2)
        self.past.refresh_from_db()
        self.assertEqual(self.past.debrief, "")
        # The stamp survives the wipe: who cleared it, and when, is still a fact.
        self.assertEqual(self.past.debrief_by_id, self.leader.pk)

    def test_a_singer_cannot_write_it(self) -> None:
        User = get_user_model()
        singer_user = User.objects.create_user("singer", "singer@test.pl", "pw123456")
        UserProfile.objects.create(user=singer_user, role=AppRole.ARTIST)
        self.client.force_authenticate(singer_user)
        response = self.client.patch(self._url(self.past), {"debrief": "Nie"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_the_cast_does_not_read_the_report_written_about_them(self) -> None:
        """The rehearsal list is served to singers too, and a debrief says how
        a section sang and who was missing. It goes to the managers and to
        whoever ran the evening — not to everybody called to it."""
        User = get_user_model()
        singer_user = User.objects.create_user("singer", "singer@test.pl", "pw123456")
        UserProfile.objects.create(user=singer_user, role=AppRole.ARTIST)
        singer = Artist.objects.create(
            user=singer_user, first_name="Ewa", last_name="Zielinska",
            email="singer@test.pl", voice_type=VoiceType.ALTO,
        )
        seat = Participation.objects.create(
            artist=singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.past.invited_participations.set([seat])

        self.client.force_authenticate(self.leader_user)
        with patch(BULK_TASK), self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                self._url(self.past), {"debrief": "Alty się rozjechały."}, format="json",
            )

        self.client.force_authenticate(singer_user)
        rows = self.client.get(f"/api/rehearsals/?project={self.project.pk}").json()
        row = next(r for r in rows if r["id"] == str(self.past.pk))
        for field in ("debrief", "debrief_by_name", "debrief_at"):
            self.assertNotIn(field, row)
        # The plan for the evening is still everybody's business.
        self.assertIn("focus", row)

        self.client.force_authenticate(self.manager)
        rows = self.client.get(f"/api/rehearsals/?project={self.project.pk}").json()
        row = next(r for r in rows if r["id"] == str(self.past.pk))
        self.assertEqual(row["debrief"], "Alty się rozjechały.")

        # And the leader reads their own text back where they wrote it.
        self.client.force_authenticate(self.leader_user)
        sheet = self.client.get(self._url(self.past)).json()
        self.assertEqual(sheet["rehearsal"]["debrief"], "Alty się rozjechały.")

    def test_the_dossier_counts_the_written_ones(self) -> None:
        from roster.queries.dossier_queries import get_artist_dossier

        self.client.force_authenticate(self.leader_user)
        with patch(BULK_TASK):
            self.client.patch(self._url(self.past), {"debrief": "Napisane"}, format="json")
        self.assertEqual(
            get_artist_dossier(self.leader)["leadership"]["debriefs_written"], 1,
        )
