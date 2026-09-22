"""
The personal scratchpad — private by construction, offline-safe by the same
client-minted-id mechanism as score annotations.

Two things pull in opposite directions here, same as the annotations queue:
a note must never be visible to anyone but its owner (cross-user read is a
404, not a 403 — a private resource must not confirm the row exists), and a
client-chosen id must never be a way to reach into somebody else's row.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.dtos import UserAccountDeletionDTO
from core.models import Note, UserProfile
from core.serializers import MAX_NOTE_BODY_LENGTH
from core.services import UserIdentityService, UserPreferencesService
from core.tasks import purge_completed_notes

_ENDPOINT = "/api/notes/"


class NoteApiTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.owner = User.objects.create_user(
            "note-owner", "note-owner@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.owner, role=AppRole.ARTIST)
        self.other = User.objects.create_user(
            "note-other", "note-other@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.other, role=AppRole.ARTIST)

    def test_create_and_list_own_notes(self) -> None:
        self.client.force_authenticate(self.owner)
        response = self.client.post(_ENDPOINT, {"body": "Call Marek"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["body"], "Call Marek")
        self.assertFalse(response.json()["is_done"])
        self.assertIsNone(response.json()["done_at"])

        listing = self.client.get(_ENDPOINT)
        self.assertEqual(len(listing.json()), 1)

    def test_owner_is_not_read_from_the_payload(self) -> None:
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            _ENDPOINT, {"body": "note", "owner": self.other.id}, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Note.objects.get().owner_id, self.owner.id)

    def test_empty_body_is_rejected(self) -> None:
        self.client.force_authenticate(self.owner)
        response = self.client.post(_ENDPOINT, {"body": "   "}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cross_user_read_is_404_not_403(self) -> None:
        note = Note.objects.create(owner=self.other, body="Not yours")
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"{_ENDPOINT}{note.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_cross_user_replay_of_a_known_id_is_403(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.owner)
        self.client.post(_ENDPOINT, {"id": chosen, "body": "mine"}, format="json")

        self.client.force_authenticate(self.other)
        response = self.client.post(
            _ENDPOINT, {"id": chosen, "body": "steal it"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        note = Note.objects.get(pk=chosen)
        self.assertEqual(note.owner_id, self.owner.id)
        self.assertEqual(note.body, "mine")

    def test_same_user_replay_is_idempotent(self) -> None:
        chosen = str(uuid.uuid4())
        body = {"id": chosen, "body": "mine"}
        self.client.force_authenticate(self.owner)
        first = self.client.post(_ENDPOINT, body, format="json")
        second = self.client.post(_ENDPOINT, body, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["id"], chosen)
        self.assertEqual(Note.objects.filter(pk=chosen).count(), 1)

    def test_an_edit_cannot_move_a_note_onto_another_key(self) -> None:
        self.client.force_authenticate(self.owner)
        created = self.client.post(_ENDPOINT, {"body": "mine"}, format="json").json()
        response = self.client.patch(
            f"{_ENDPOINT}{created['id']}/",
            {"id": str(uuid.uuid4()), "body": "edited"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], created["id"])
        self.assertEqual(Note.objects.get().body, "edited")

    def test_done_at_is_set_and_cleared_on_the_transition(self) -> None:
        self.client.force_authenticate(self.owner)
        created = self.client.post(_ENDPOINT, {"body": "mine"}, format="json").json()
        note_url = f"{_ENDPOINT}{created['id']}/"

        done = self.client.patch(note_url, {"is_done": True}, format="json")
        self.assertIsNotNone(done.json()["done_at"])

        # A replay of the same state must not disturb the timestamp.
        stamp = Note.objects.get(pk=created["id"]).done_at
        self.client.patch(note_url, {"is_done": True}, format="json")
        self.assertEqual(Note.objects.get(pk=created["id"]).done_at, stamp)

        reopened = self.client.patch(note_url, {"is_done": False}, format="json")
        self.assertIsNone(reopened.json()["done_at"])

    def test_delete_is_soft(self) -> None:
        self.client.force_authenticate(self.owner)
        created = self.client.post(_ENDPOINT, {"body": "mine"}, format="json").json()
        response = self.client.delete(f"{_ENDPOINT}{created['id']}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Note.objects.filter(pk=created["id"]).exists())
        self.assertTrue(Note.all_objects.get(pk=created["id"]).is_deleted)

    def test_cross_user_write_and_delete_are_404(self) -> None:
        # The queryset is the whole ownership boundary, so every verb that
        # resolves an object has to fall off it — not just the read.
        note = Note.objects.create(owner=self.other, body="Not yours")
        self.client.force_authenticate(self.owner)
        patched = self.client.patch(
            f"{_ENDPOINT}{note.pk}/", {"body": "taken"}, format="json",
        )
        deleted = self.client.delete(f"{_ENDPOINT}{note.pk}/")
        self.assertEqual(patched.status_code, 404)
        self.assertEqual(deleted.status_code, 404)
        note.refresh_from_db()
        self.assertEqual(note.body, "Not yours")
        self.assertFalse(note.is_deleted)

    def test_list_is_open_first_then_newest(self) -> None:
        # The ordering IS the list endpoint's contract — there is no client-side
        # sort and no pagination to re-impose one.
        self.client.force_authenticate(self.owner)
        self.client.post(_ENDPOINT, {"body": "first"}, format="json")
        second = self.client.post(_ENDPOINT, {"body": "second"}, format="json").json()
        self.client.post(_ENDPOINT, {"body": "third"}, format="json")
        self.client.patch(f"{_ENDPOINT}{second['id']}/", {"is_done": True}, format="json")

        bodies = [row["body"] for row in self.client.get(_ENDPOINT).json()]
        self.assertEqual(bodies, ["third", "first", "second"])

    def test_an_overlong_body_is_truncated_not_rejected(self) -> None:
        self.client.force_authenticate(self.owner)
        response = self.client.post(_ENDPOINT, {"body": "x" * 2500}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["body"]), MAX_NOTE_BODY_LENGTH)

    def test_put_is_not_exposed(self) -> None:
        # Every writable field has a default, so a whole-object replace would be
        # an accidental second spelling of PATCH rather than a distinct verb.
        self.client.force_authenticate(self.owner)
        created = self.client.post(_ENDPOINT, {"body": "mine"}, format="json").json()
        response = self.client.put(
            f"{_ENDPOINT}{created['id']}/", {"body": "replaced"}, format="json",
        )
        self.assertEqual(response.status_code, 405)


class NoteRetentionTaskTests(TestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.owner = User.objects.create_user(
            "note-retain", "note-retain@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.owner, role=AppRole.ARTIST)

    def test_purges_only_rows_past_the_retention_window(self) -> None:
        now = timezone.now()
        stale = Note.objects.create(
            owner=self.owner, body="old", is_done=True, done_at=now - timedelta(days=31),
        )
        recent = Note.objects.create(
            owner=self.owner, body="recent", is_done=True, done_at=now - timedelta(days=1),
        )
        still_open = Note.objects.create(owner=self.owner, body="open")

        deleted = purge_completed_notes()

        self.assertEqual(deleted, 1)
        self.assertFalse(Note.all_objects.filter(pk=stale.pk).exists())
        self.assertTrue(Note.objects.filter(pk=recent.pk).exists())
        self.assertTrue(Note.objects.filter(pk=still_open.pk).exists())


class NoteGdprTests(TestCase):
    """
    The two halves of the subject's rights over a scratchpad nobody else reads:
    erasure has to destroy it, portability has to hand it back.
    """

    def setUp(self) -> None:
        User = get_user_model()
        self.user = User.objects.create_user(
            "note-gdpr", "note-gdpr@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)

    def test_erasure_destroys_notes_although_the_auth_row_survives(self) -> None:
        # `Note.owner` is CASCADE, but erasure anonymizes the auth row instead of
        # deleting it, so the cascade never fires. Without the explicit purge the
        # free text — which routinely names third parties — outlives the account.
        kept = Note.objects.create(owner=self.user, body="Call Marek about his results")
        erased_while_deleted = Note.objects.create(owner=self.user, body="already binned")
        erased_while_deleted.delete()

        UserIdentityService.process_account_soft_deletion(
            self.user, UserAccountDeletionDTO(current_password="pw123456"),
        )

        self.assertTrue(get_user_model().objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Note.all_objects.filter(pk=kept.pk).exists())
        self.assertFalse(Note.all_objects.filter(pk=erased_while_deleted.pk).exists())

    def test_portability_export_carries_open_notes_only(self) -> None:
        Note.objects.create(owner=self.user, body="still open")
        done = Note.objects.create(owner=self.user, body="finished", is_done=True)
        done.done_at = timezone.now()
        done.save(update_fields=["done_at"])
        binned = Note.objects.create(owner=self.user, body="binned")
        binned.delete()

        export = UserPreferencesService.generate_gdpr_export(self.user, {})

        bodies = {row["body"] for row in export["notes"]}
        self.assertEqual(bodies, {"still open", "finished"})
        self.assertIsNotNone(
            next(row for row in export["notes"] if row["body"] == "finished")["done_at"]
        )

    def test_another_persons_notes_never_reach_the_export(self) -> None:
        User = get_user_model()
        stranger = User.objects.create_user(
            "note-stranger", "note-stranger@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=stranger, role=AppRole.ARTIST)
        Note.objects.create(owner=stranger, body="not in anyone else's export")
        Note.objects.create(owner=self.user, body="mine")

        export = UserPreferencesService.generate_gdpr_export(self.user, {})

        self.assertEqual([row["body"] for row in export["notes"]], ["mine"])
