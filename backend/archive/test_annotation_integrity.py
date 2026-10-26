"""
@file test_annotation_integrity.py
@description The write rules that keep a reader's marks where they left them.

    One predicate decides which layers a non-manager may write on an edition,
    and every write asks it: a mark's create, its edit (from both ends), its
    erase, a clear of the page and the restore that undoes one. These tests hold
    the bulk paths to the per-mark answer, the offline replay to "never a second
    copy, never a resurrection", the sanitizer to what print can draw, and the
    read scope to music that still exists.

@module archive/test_annotation_integrity
"""

from __future__ import annotations

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
    Composer,
    Piece,
    ScoreEdition,
)
from archive.views import AnnotationViewSet
from core.constants import AppRole
from core.models import UserProfile
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    RehearsalDelegate,
    VoiceType,
)

_ENDPOINT = "/api/archive/annotations/"
_PENCIL = "#1F2933"
_STROKE = {"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004}


class _MarksFixture(APITestCase):
    """A live project with two programmed editions, one edition outside it,
    two cast singers, a cast deputy and a manager."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Nieszpory", status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Claudio", last_name="Monteverdi")
        self.edition = self._edition(composer, "Dixit Dominus", pages=2, programmed=True)
        self.second_edition = self._edition(composer, "Laudate pueri", pages=3, programmed=True)
        self.foreign_edition = self._edition(composer, "Lauda Jerusalem", pages=2, programmed=False)

        self.singer_user = self._cast_member("singer", "Jan", "Kowalski")
        self.other_user = self._cast_member("other", "Ewa", "Nowak")
        self.deputy_user = self._cast_member("deputy", "Kasia", "Wiśniewska")

    def _edition(self, composer: Composer, title: str, *, pages: int, programmed: bool) -> ScoreEdition:
        piece = Piece.objects.create(title=title, composer=composer)
        if programmed:
            ProgramItem.objects.create(
                project=self.project, piece=piece,
                order=ProgramItem.objects.filter(project=self.project).count() + 1,
            )
        return ScoreEdition.objects.create(
            piece=piece, original_filename=f"{title}.pdf",
            page_count=pages, is_default=True, sha256=uuid.uuid4().hex * 2,
        )

    def _cast_member(self, username: str, first: str, last: str):
        user = get_user_model().objects.create_user(
            username, f"{username}@test.pl", "pw123456", first_name=first, last_name=last,
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=first, last_name=last,
            email=f"{username}@test.pl", voice_type=VoiceType.TENOR,
        )
        Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        return user

    def _grant_choir_marks(self) -> RehearsalDelegate:
        return RehearsalDelegate.objects.create(
            project=self.project, artist=self.deputy_user.artist_profile,
            granted_by=self.manager, can_mark_for_choir=True,
        )

    def _mark(self, user, layer: str, *, edition: ScoreEdition | None = None, **fields) -> Annotation:
        values = {
            "edition": edition or self.edition,
            "page_number": 1,
            "annotation_type": AnnotationType.FREEHAND,
            "payload": _STROKE,
            "color": _PENCIL,
            **fields,
        }
        return Annotation.objects.create(layer_name=layer, created_by=user, **values)

    def _body(self, **overrides) -> dict:
        return {
            "edition": str(self.edition.pk),
            "page_number": 1,
            "annotation_type": AnnotationType.FREEHAND,
            "payload": _STROKE,
            "layer_name": PERSONAL_ANNOTATION_LAYER,
            "color": _PENCIL,
            **overrides,
        }

    def _clear(self, **body):
        return self.client.post(
            f"{_ENDPOINT}clear/", {"edition": str(self.edition.pk), **body}, format="json",
        )

    @staticmethod
    def _live(mark: Annotation) -> bool:
        return Annotation.objects.filter(pk=mark.pk).exists()


class EditGateTests(_MarksFixture):
    """An edit is gated where the mark is and where the patch puts it."""

    def test_a_withdrawn_choir_grant_cannot_pull_own_marks_off_shared(self) -> None:
        grant = self._grant_choir_marks()
        self.client.force_authenticate(self.deputy_user)
        created = self.client.post(
            _ENDPOINT, self._body(layer_name=SHARED_ANNOTATION_LAYER), format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        grant.can_mark_for_choir = False
        grant.save(update_fields=["can_mark_for_choir"])

        response = self.client.patch(
            f"{_ENDPOINT}{created.json()['id']}/",
            {"layer_name": PERSONAL_ANNOTATION_LAYER}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            Annotation.objects.get(pk=created.json()["id"]).layer_name,
            SHARED_ANNOTATION_LAYER,
        )

    def test_a_mark_cannot_be_moved_onto_music_the_reader_cannot_open(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        self.client.force_authenticate(self.singer_user)
        response = self.client.patch(
            f"{_ENDPOINT}{mark.pk}/", {"edition": str(self.foreign_edition.pk)}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        mark.refresh_from_db()
        self.assertEqual(mark.edition_id, self.edition.pk)

    def test_a_mark_moves_between_editions_the_reader_may_write(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        self.client.force_authenticate(self.singer_user)
        response = self.client.patch(
            f"{_ENDPOINT}{mark.pk}/", {"edition": str(self.second_edition.pk)}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        mark.refresh_from_db()
        self.assertEqual(mark.edition_id, self.second_edition.pk)


class ClearTests(_MarksFixture):
    """The trash reaches what the pencil could, and only what the page showed."""

    def test_a_leaders_clear_honours_the_layer(self) -> None:
        self._grant_choir_marks()
        personal = self._mark(self.deputy_user, PERSONAL_ANNOTATION_LAYER)
        shared = self._mark(self.deputy_user, SHARED_ANNOTATION_LAYER)
        self.client.force_authenticate(self.deputy_user)

        response = self._clear(layer_name=PERSONAL_ANNOTATION_LAYER)
        self.assertEqual(response.json()["deleted"], 1)
        self.assertFalse(self._live(personal))
        self.assertTrue(self._live(shared))

        response = self._clear(layer_name=SHARED_ANNOTATION_LAYER)
        self.assertEqual(response.json()["deleted"], 1)
        self.assertFalse(self._live(shared))

    def test_ids_bound_the_wipe_to_the_marks_the_page_showed(self) -> None:
        shown = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        drawn_later = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        # A create still in the queue: its id was minted on the device and the
        # server has never seen it.
        queued = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)

        response = self._clear(ids=[str(shown.pk), queued])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"deleted": 1, "ids": [str(shown.pk)]})
        self.assertFalse(self._live(shown))
        self.assertTrue(self._live(drawn_later))

    def test_ids_never_reach_past_the_callers_scope(self) -> None:
        conductors = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        neighbours = self._mark(self.other_user, PERSONAL_ANNOTATION_LAYER)
        self.client.force_authenticate(self.singer_user)
        response = self._clear(ids=[str(conductors.pk), str(neighbours.pk)])
        self.assertEqual(response.json()["deleted"], 0)
        self.assertTrue(self._live(conductors))
        self.assertTrue(self._live(neighbours))

    def test_a_manager_clear_with_a_layer_takes_that_layer_only(self) -> None:
        cue = self._mark(self.manager, CONDUCTOR_ANNOTATION_LAYER)
        shared = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        leader = self._mark(self.manager, LEADER_ANNOTATION_LAYER)
        self.client.force_authenticate(self.manager)
        response = self._clear(layer_name=CONDUCTOR_ANNOTATION_LAYER)
        self.assertEqual(response.json()["ids"], [str(cue.pk)])
        self.assertTrue(self._live(shared))
        self.assertTrue(self._live(leader))

    def test_a_reader_who_lost_the_music_clears_nothing(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        self.project.status = Project.Status.COMPLETED
        self.project.save(update_fields=["status"])
        self.client.force_authenticate(self.singer_user)
        self.assertEqual(self._clear().json()["deleted"], 0)
        self.assertTrue(self._live(mark))

    def test_a_body_that_is_not_an_object_is_refused(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            f"{_ENDPOINT}clear/", [str(self.edition.pk)], format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_malformed_ids_are_refused(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        self.client.force_authenticate(self.singer_user)
        for bad in ("all", [str(mark.pk), "not-a-uuid"], None):
            self.assertEqual(self._clear(ids=bad).status_code, 400, bad)
        self.assertTrue(self._live(mark))


class RestoreTests(_MarksFixture):
    """Undo brings the same marks back, not copies in the undoer's hand."""

    def _restore(self, ids: list[str]):
        return self.client.post(f"{_ENDPOINT}restore/", {"ids": ids}, format="json")

    def test_restore_brings_back_what_a_clear_took(self) -> None:
        first = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        second = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER, page_number=2)
        self.client.force_authenticate(self.singer_user)
        wiped = self._clear().json()["ids"]

        response = self._restore(wiped)
        self.assertEqual(response.status_code, 200)
        restored = response.json()["restored"]
        self.assertEqual({row["id"] for row in restored}, {str(first.pk), str(second.pk)})
        self.assertEqual({row["created_by"] for row in restored}, {self.singer_user.id})
        self.assertTrue(self._live(first))
        self.assertTrue(self._live(second))

    def test_restore_is_idempotent(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        mark.delete()
        self.client.force_authenticate(self.singer_user)
        once = self._restore([str(mark.pk)]).json()
        twice = self._restore([str(mark.pk)]).json()
        self.assertEqual(
            [row["id"] for row in once["restored"]],
            [row["id"] for row in twice["restored"]],
        )
        self.assertTrue(self._live(mark))

    def test_ids_the_server_never_had_are_skipped(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self._restore([str(uuid.uuid4())])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"restored": []})

    def test_a_manager_never_restores_a_singers_personal_mark(self) -> None:
        mark = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        mark.delete()
        self.client.force_authenticate(self.manager)
        self.assertEqual(self._restore([str(mark.pk)]).json(), {"restored": []})
        self.assertFalse(self._live(mark))

    def test_a_singer_never_restores_the_conductors_mark(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        mark.delete()
        self.client.force_authenticate(self.singer_user)
        self.assertEqual(self._restore([str(mark.pk)]).json(), {"restored": []})
        self.assertFalse(self._live(mark))

    def test_restore_needs_a_list_of_ids(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(f"{_ENDPOINT}restore/", {}, format="json")
        self.assertEqual(response.status_code, 400)


class ReplayTests(_MarksFixture):
    """The second arrival of a create drawn without signal."""

    def test_a_replay_carries_the_offline_edit_folded_into_it(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        moved = {"paths": [[[0.5, 0.5], [0.7, 0.55]]], "width": 0.004}
        response = self.client.post(
            _ENDPOINT, self._body(id=chosen, payload=moved, color="#2563EB"), format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        mark = Annotation.objects.get(pk=chosen)
        self.assertEqual(mark.payload["paths"], moved["paths"])
        self.assertEqual(mark.color, "#2563EB")

    def test_an_identical_replay_writes_nothing(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        stamped = Annotation.objects.get(pk=chosen).updated_at
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        self.assertEqual(Annotation.objects.get(pk=chosen).updated_at, stamped)

    def test_a_replay_passes_the_edit_gate(self) -> None:
        # The replayed body cannot move the mark where an edit could not.
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        response = self.client.post(
            _ENDPOINT, self._body(id=chosen, layer_name=SHARED_ANNOTATION_LAYER), format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Annotation.objects.get(pk=chosen).layer_name, PERSONAL_ANNOTATION_LAYER)

    def test_two_replays_racing_past_the_lookup_answer_one_row(self) -> None:
        chosen = str(uuid.uuid4())
        self.client.force_authenticate(self.singer_user)
        self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        winner = Annotation.objects.get(pk=chosen)
        # The loser's lookup ran before the winner's insert committed; its own
        # insert then hits the key.
        with patch.object(AnnotationViewSet, "_stored_row", side_effect=[None, winner]):
            response = self.client.post(_ENDPOINT, self._body(id=chosen), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["id"], chosen)
        self.assertEqual(Annotation.all_objects.filter(pk=chosen).count(), 1)


class ReadScopeTests(_MarksFixture):
    """Marks exist only on music that still exists."""

    def test_the_list_needs_an_edition(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get(_ENDPOINT).status_code, 400)

    def test_a_deleted_edition_takes_its_marks_with_it(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.edition.delete()
        self.client.force_authenticate(self.manager)
        # The edition filter resolves live editions only, so the list refuses
        # the question instead of answering it.
        listed = self.client.get(_ENDPOINT, {"edition": str(self.edition.pk)})
        self.assertEqual(listed.status_code, 400)
        fingerprint = self.client.get(
            f"{_ENDPOINT}fingerprint/", {"edition": str(self.edition.pk)},
        )
        self.assertEqual(fingerprint.json()["count"], 0)
        self.assertEqual(self.client.get(f"{_ENDPOINT}{mark.pk}/").status_code, 404)

    def test_a_deleted_project_takes_its_music_with_it(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.project.delete()
        self.client.force_authenticate(self.singer_user)
        listed = self.client.get(_ENDPOINT, {"edition": str(self.edition.pk)})
        self.assertEqual(listed.json(), [])
        self.assertEqual(
            self.client.post(_ENDPOINT, self._body(), format="json").status_code, 403,
        )


class SanitizerTests(_MarksFixture):
    """A write the renderer and the printer can both carry out."""

    def _post(self, **overrides):
        self.client.force_authenticate(self.singer_user)
        return self.client.post(_ENDPOINT, self._body(**overrides), format="json")

    def test_pages_count_from_one_and_stop_at_the_last(self) -> None:
        self.assertEqual(self._post(page_number=0).status_code, 400)
        self.assertEqual(self._post(page_number=3).status_code, 400)
        self.assertEqual(self._post(page_number=2).status_code, 201)

    def test_an_edition_not_yet_counted_takes_any_page(self) -> None:
        ScoreEdition.objects.filter(pk=self.edition.pk).update(page_count=0)
        self.assertEqual(self._post(page_number=40).status_code, 201)

    def test_an_unknown_stamp_is_refused(self) -> None:
        response = self._post(
            annotation_type=AnnotationType.STAMP,
            payload={"x": 0.5, "y": 0.5, "symbol": "kazoo"},
        )
        self.assertEqual(response.status_code, 400)

    def test_a_legacy_row_can_still_be_moved_and_erased(self) -> None:
        legacy = self._mark(
            self.singer_user, PERSONAL_ANNOTATION_LAYER, page_number=0,
            annotation_type=AnnotationType.STAMP,
            payload={"x": 0.2, "y": 0.2, "symbol": "retired", "scale": 1.0},
        )
        self.client.force_authenticate(self.singer_user)
        moved = self.client.patch(
            f"{_ENDPOINT}{legacy.pk}/",
            {"payload": {"x": 0.6, "y": 0.4, "symbol": "retired", "scale": 1.0}},
            format="json",
        )
        self.assertEqual(moved.status_code, 200, moved.content)
        self.assertEqual(moved.json()["payload"]["x"], 0.6)
        self.assertEqual(self.client.delete(f"{_ENDPOINT}{legacy.pk}/").status_code, 204)

    def test_a_row_too_large_to_store_is_refused(self) -> None:
        # Every stroke and point count is inside its own cap; the row is not.
        long_stroke = [[0.1234567891, 0.9876543211]] * 3000
        response = self._post(payload={"paths": [long_stroke] * 4, "width": 0.004})
        self.assertEqual(response.status_code, 400)

    def test_a_highlight_without_a_width_gets_the_highlighters_band(self) -> None:
        response = self._post(
            annotation_type=AnnotationType.HIGHLIGHT,
            payload={"paths": [[[0.1, 0.1], [0.4, 0.1]]]},
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["payload"]["width"], 0.021)
