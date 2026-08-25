"""
@file test_annotation_offline.py
@description What has to be true for a mark drawn WITHOUT SIGNAL to survive.

    The panel mints a mark's id on the device, so a stroke made in a basement
    owns its identity before the server has heard of it — that is what lets the
    reader edit and erase it while still offline, and what makes the replayed
    POST idempotent when the network finally returns. Two things must hold or
    that whole arrangement quietly corrupts: a replay must NOT leave two copies
    of one pencil line, and a chosen key must never be a way to reach into
    somebody else's row.

    The fingerprint is here for the other half of the same story: an open score
    stand polls it through a whole rehearsal, so it has to answer "did MY view
    change" — never leaking the existence of another singer's private marks.

@architecture Enterprise SaaS 2026
@module archive/test_annotation_offline
"""

from __future__ import annotations

import tempfile
import uuid
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from pypdf import PdfWriter
from rest_framework.test import APITestCase

from archive.models import (
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
    Composer,
    Piece,
    ScoreEdition,
)
from core.constants import AppRole
from core.models import UserProfile
from roster.models import Artist, Participation, ProgramItem, Project, VoiceType

_MEDIA = tempfile.mkdtemp(prefix="vm_offline_marks_test_")

_ENDPOINT = "/api/archive/annotations/"
_PENCIL = "#1F2933"
_CONDUCTOR_INK = "#DC2626"


def _pdf_bytes(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@override_settings(MEDIA_ROOT=_MEDIA)
class ClientMintedIdTests(APITestCase):
    """The create endpoint, asked the same thing twice."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.singer_user = User.objects.create_user(
            "singer", "singer@test.pl", "pw123456",
            first_name="Jan", last_name="Kowalski",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.other_user = User.objects.create_user(
            "other", "other@test.pl", "pw123456",
            first_name="Ewa", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.other_user, role=AppRole.ARTIST)

        self.project = Project.objects.create(
            title="Koncert Maryjny", status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        for user, first, last, email in (
            (self.singer_user, "Jan", "Kowalski", "singer@test.pl"),
            (self.other_user, "Ewa", "Nowak", "other@test.pl"),
        ):
            artist = Artist.objects.create(
                user=user, first_name=first, last_name=last,
                email=email, voice_type=VoiceType.TENOR,
            )
            Participation.objects.create(
                artist=artist, project=self.project,
                status=Participation.Status.CONFIRMED,
            )

        self.edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="score.pdf",
            page_count=2, is_default=True, sha256="a" * 64,
        )
        self.edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(2)), save=True)

    def _body(self, **overrides) -> dict:
        return {
            "edition": str(self.edition.pk),
            "page_number": 1,
            "annotation_type": AnnotationType.FREEHAND,
            "payload": {"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004},
            "layer_name": PERSONAL_ANNOTATION_LAYER,
            "color": _PENCIL,
            **overrides,
        }

    def test_the_clients_id_is_the_rows_key(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(
            _ENDPOINT, self._body(id=chosen), format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], chosen)
        self.assertTrue(Annotation.objects.filter(pk=chosen).exists())

    def test_a_replayed_create_does_not_double_the_mark(self) -> None:
        chosen = str(uuid.uuid4())
        body = self._body(id=chosen)
        self.client.force_authenticate(self.singer_user)
        first = self.client.post(_ENDPOINT, body, format="json")
        second = self.client.post(_ENDPOINT, body, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["id"], chosen)
        self.assertEqual(Annotation.objects.filter(pk=chosen).count(), 1)

    def test_a_replay_never_resurrects_an_erased_mark(self) -> None:
        # The queue replays create-then-erase in order. If the create un-deleted
        # the row, the erase that follows would be undone by the very write it
        # was queued behind — and the mark would come back from the dead.
        chosen = str(uuid.uuid4())
        body = self._body(id=chosen)
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, body, format="json")
        self.client.delete(f"{_ENDPOINT}{chosen}/")
        self.client.post(_ENDPOINT, body, format="json")
        self.assertTrue(Annotation.all_objects.get(pk=chosen).is_deleted)
        self.assertFalse(Annotation.objects.filter(pk=chosen).exists())

    def test_a_chosen_id_cannot_reach_somebody_elses_row(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")

        self.client.force_authenticate(self.other_user)
        response = self.client.post(
            _ENDPOINT,
            self._body(id=chosen, payload={"paths": [[[0.9, 0.9]]], "width": 0.01}),
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        mark = Annotation.objects.get(pk=chosen)
        self.assertEqual(mark.created_by_id, self.singer_user.id)
        self.assertEqual(mark.payload["paths"], [[[0.2, 0.3], [0.6, 0.35]]])

    def test_an_edit_cannot_move_a_mark_onto_another_key(self) -> None:
        self.client.force_authenticate(self.singer_user)
        created = self.client.post(_ENDPOINT, self._body(), format="json").json()
        response = self.client.patch(
            f"{_ENDPOINT}{created['id']}/",
            {"id": str(uuid.uuid4()), "color": "#2563EB"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], created["id"])
        self.assertEqual(Annotation.objects.get().color, "#2563EB")

    def test_an_id_free_create_still_works(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(_ENDPOINT, self._body(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["id"])


@override_settings(MEDIA_ROOT=_MEDIA)
class MarkFingerprintTests(ClientMintedIdTests):
    """The pair an open score stand polls through a whole rehearsal."""

    def _fingerprint(self) -> dict:
        response = self.client.get(
            f"{_ENDPOINT}fingerprint/", {"edition": str(self.edition.pk)},
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_it_moves_when_the_conductor_writes(self) -> None:
        self.client.force_authenticate(self.singer_user)
        before = self._fingerprint()
        self.assertEqual(before["count"], 0)
        self.assertIsNone(before["latest"])

        Annotation.objects.create(
            edition=self.edition, page_number=2,
            annotation_type=AnnotationType.STAMP,
            payload={"x": 0.4, "y": 0.4, "symbol": "breath", "scale": 1.0},
            color=_CONDUCTOR_INK, layer_name=SHARED_ANNOTATION_LAYER,
            created_by=self.manager,
        )
        after = self._fingerprint()
        self.assertEqual(after["count"], 1)
        self.assertIsNotNone(after["latest"])

    def test_it_ignores_another_singers_private_marks(self) -> None:
        Annotation.objects.create(
            edition=self.edition, page_number=1,
            annotation_type=AnnotationType.STAMP,
            payload={"x": 0.1, "y": 0.1, "symbol": "breath", "scale": 1.0},
            color=_PENCIL, layer_name=PERSONAL_ANNOTATION_LAYER,
            created_by=self.other_user,
        )
        self.client.force_authenticate(self.singer_user)
        # Somebody else's pencil is not in this reader's view, so it must not
        # move their fingerprint either — a poll that ticked here would send the
        # stand refetching a list that never changed, forever.
        self.assertEqual(self._fingerprint()["count"], 0)

    def test_an_erase_moves_it_too(self) -> None:
        self.client.force_authenticate(self.singer_user)
        created = self.client.post(_ENDPOINT, self._body(), format="json").json()
        self.assertEqual(self._fingerprint()["count"], 1)
        self.client.delete(f"{_ENDPOINT}{created['id']}/")
        self.assertEqual(self._fingerprint()["count"], 0)

    def test_it_needs_a_real_edition_id(self) -> None:
        self.client.force_authenticate(self.singer_user)
        self.assertEqual(
            self.client.get(f"{_ENDPOINT}fingerprint/").status_code, 400,
        )
        self.assertEqual(
            self.client.get(
                f"{_ENDPOINT}fingerprint/", {"edition": "not-a-uuid"},
            ).status_code,
            400,
        )
