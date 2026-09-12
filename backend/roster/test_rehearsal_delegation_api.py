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

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from roster.models import (
    Artist,
    Participation,
    Project,
    RehearsalDelegate,
    VoiceType,
)


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
