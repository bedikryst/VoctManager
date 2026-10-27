"""
@file test_annotation_read_state.py
@description What a reader is told is new on a score, and how far they have read.

    `content_at` moves when a mark starts saying something new to its reader:
    drawn, restored, its words or symbol changed, or readdressed to another
    layer. A tidy (a move, a resize, a recolour) leaves it, so rearranging a
    page never reads as news. The read pointer starts at the first open, so the
    day this ships nobody is shown the whole score as new, and it only ever
    moves forward, to a moment the server can vouch for.

@module archive/test_annotation_read_state
"""

from __future__ import annotations

import importlib
from datetime import timedelta

from django.apps import apps
from django.utils import timezone

from archive.models import (
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationReadState,
    AnnotationType,
)
from archive.test_annotation_integrity import _ENDPOINT, _MarksFixture

_NOTE = {"x": 0.4, "y": 0.4, "text": "Piano!", "display": "pin", "scale": 1.0}
_STAMP = {"x": 0.3, "y": 0.3, "symbol": "breath", "scale": 1.0}


_MIGRATION = importlib.import_module(
    "archive.migrations.0035_annotation_content_at_read_state",
)


class ContentAtTests(_MarksFixture):
    """Only a change in what a mark says moves `content_at`."""

    def _aged(self, mark: Annotation) -> Annotation:
        past = timezone.now() - timedelta(days=3)
        Annotation.objects.filter(pk=mark.pk).update(content_at=past)
        mark.refresh_from_db()
        return mark

    def _patch(self, user, mark: Annotation, body: dict) -> Annotation:
        self.client.force_authenticate(user)
        response = self.client.patch(f"{_ENDPOINT}{mark.pk}/", body, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("content_at", response.json())
        mark.refresh_from_db()
        return mark

    def test_a_new_mark_is_stamped_on_create(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(_ENDPOINT, self._body(layer_name=SHARED_ANNOTATION_LAYER), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        mark = Annotation.objects.get(pk=response.json()["id"])
        self.assertIsNotNone(mark.content_at)

    def test_moving_resizing_and_recolouring_say_nothing_new(self) -> None:
        note = self._aged(self._mark(
            self.manager, SHARED_ANNOTATION_LAYER,
            annotation_type=AnnotationType.COMMENT, payload=_NOTE,
        ))
        before = note.content_at
        moved = self._patch(self.manager, note, {
            "payload": {**_NOTE, "x": 0.7, "scale": 1.6, "display": "inline"},
            "color": "#1F2933",
        })
        self.assertEqual(moved.content_at, before)

    def test_new_words_on_a_note_are_news(self) -> None:
        note = self._aged(self._mark(
            self.manager, SHARED_ANNOTATION_LAYER,
            annotation_type=AnnotationType.COMMENT, payload=_NOTE,
        ))
        before = note.content_at
        edited = self._patch(self.manager, note, {"payload": {**_NOTE, "text": "Forte!"}})
        self.assertGreater(edited.content_at, before)

    def test_a_new_symbol_on_a_stamp_is_news(self) -> None:
        stamp = self._aged(self._mark(
            self.manager, SHARED_ANNOTATION_LAYER,
            annotation_type=AnnotationType.STAMP, payload=_STAMP,
        ))
        before = stamp.content_at
        edited = self._patch(self.manager, stamp, {"payload": {**_STAMP, "symbol": "fermata"}})
        self.assertGreater(edited.content_at, before)

    def test_moving_a_mark_onto_the_choirs_layer_is_news_to_the_choir(self) -> None:
        stroke = self._aged(self._mark(self.manager, "conductor"))
        before = stroke.content_at
        promoted = self._patch(self.manager, stroke, {"layer_name": SHARED_ANNOTATION_LAYER})
        self.assertGreater(promoted.content_at, before)

    def test_a_restored_mark_is_news_again(self) -> None:
        mark = self._aged(self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER))
        before = mark.content_at
        mark.delete()
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(f"{_ENDPOINT}restore/", {"ids": [str(mark.pk)]}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        mark.refresh_from_db()
        self.assertFalse(mark.is_deleted)
        self.assertGreater(mark.content_at, before)

    def test_the_backfill_dates_every_mark_from_its_creation(self) -> None:
        live = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        erased = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        erased.delete()
        Annotation.all_objects.update(content_at=timezone.now() + timedelta(days=1))

        _MIGRATION.backfill_content_at(apps, None)

        for mark in (live, erased):
            mark.refresh_from_db()
            self.assertEqual(mark.content_at, mark.created_at)


class ReadPointerTests(_MarksFixture):
    """The fingerprint answers how far this reader has read; `seen` moves it on."""

    def _fingerprint(self, user, edition=None) -> dict:
        self.client.force_authenticate(user)
        response = self.client.get(
            f"{_ENDPOINT}fingerprint/", {"edition": str((edition or self.edition).pk)},
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def _seen(self, user, at: str, edition=None):
        self.client.force_authenticate(user)
        return self.client.post(
            f"{_ENDPOINT}seen/",
            {"edition": str((edition or self.edition).pk), "at": at},
            format="json",
        )

    def test_the_first_open_starts_the_pointer_after_every_existing_mark(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.assertFalse(AnnotationReadState.objects.filter(user=self.singer_user).exists())

        answer = self._fingerprint(self.singer_user)

        state = AnnotationReadState.objects.get(user=self.singer_user, edition=self.edition)
        self.assertIsNotNone(answer["seen_at"])
        self.assertGreaterEqual(state.seen_at, mark.content_at)

    def test_a_later_open_keeps_the_pointer_where_it_was(self) -> None:
        earlier = timezone.now() - timedelta(days=2)
        AnnotationReadState.objects.create(
            user=self.singer_user, edition=self.edition, seen_at=earlier,
        )
        answer = self._fingerprint(self.singer_user)
        self.assertEqual(answer["seen_at"], earlier.isoformat())
        self.assertEqual(AnnotationReadState.objects.filter(user=self.singer_user).count(), 1)

    def test_a_deleted_edition_answers_no_pointer_and_writes_none(self) -> None:
        self.edition.delete()
        answer = self._fingerprint(self.singer_user)
        self.assertIsNone(answer["seen_at"])
        self.assertFalse(AnnotationReadState.objects.exists())

    def test_seen_moves_the_pointer_forward(self) -> None:
        start = timezone.now() - timedelta(days=2)
        AnnotationReadState.objects.create(
            user=self.singer_user, edition=self.edition, seen_at=start,
        )
        later = start + timedelta(days=1)
        response = self._seen(self.singer_user, later.isoformat())
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            AnnotationReadState.objects.get(user=self.singer_user).seen_at, later,
        )

    def test_seen_never_moves_the_pointer_back(self) -> None:
        start = timezone.now() - timedelta(days=1)
        AnnotationReadState.objects.create(
            user=self.singer_user, edition=self.edition, seen_at=start,
        )
        response = self._seen(self.singer_user, (start - timedelta(hours=5)).isoformat())
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["seen_at"], start.isoformat())
        self.assertEqual(AnnotationReadState.objects.get(user=self.singer_user).seen_at, start)

    def test_seen_is_capped_by_the_servers_clock(self) -> None:
        before = timezone.now()
        response = self._seen(self.singer_user, (before + timedelta(hours=3)).isoformat())
        self.assertEqual(response.status_code, 200, response.content)
        seen_at = AnnotationReadState.objects.get(user=self.singer_user).seen_at
        self.assertLessEqual(seen_at, timezone.now())
        self.assertGreaterEqual(seen_at, before)

    def test_seen_is_one_readers_pointer(self) -> None:
        self._seen(self.singer_user, timezone.now().isoformat())
        self.assertFalse(AnnotationReadState.objects.filter(user=self.other_user).exists())

    def test_seen_refuses_a_time_without_a_zone_or_no_time_at_all(self) -> None:
        for at in ("2026-10-27T10:00:00", "yesterday", ""):
            with self.subTest(at=at):
                self.assertEqual(self._seen(self.singer_user, at).status_code, 400)
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(f"{_ENDPOINT}seen/", ["x"], format="json")
        self.assertEqual(response.status_code, 400)

    def test_seen_on_an_edition_that_is_gone_is_a_404(self) -> None:
        self.edition.delete()
        response = self._seen(self.singer_user, timezone.now().isoformat())
        self.assertEqual(response.status_code, 404)
