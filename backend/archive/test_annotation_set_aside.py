"""
@file test_annotation_set_aside.py
@description "Odłóż uwagi": a manager puts an edition's marks away for a new
    season and brings a set back later.

    A set-aside mark is off every page — the list, the fingerprint, the book's
    census and its printed copy — but not erased: a set comes back with its ids
    and authors, and as news to the choir. A singer's own pencil is never part
    of a set.

@module archive/test_annotation_set_aside
"""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
)
from archive.test_annotation_integrity import _ENDPOINT, _MarksFixture
from roster.score_package_markings import compute_program_markings, reader_marks_for_book


class SetAsideTests(_MarksFixture):
    def setUp(self) -> None:
        super().setUp()
        self.shared = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.private = self._mark(self.manager, CONDUCTOR_ANNOTATION_LAYER)
        self.leader = self._mark(self.manager, LEADER_ANNOTATION_LAYER)
        self.pencil = self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER)
        self.elsewhere = self._mark(
            self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition,
        )

    def _set_aside(self, user=None):
        self.client.force_authenticate(user or self.manager)
        return self.client.post(
            f"{_ENDPOINT}set_aside/", {"edition": str(self.edition.pk)}, format="json",
        )

    def _sets(self):
        self.client.force_authenticate(self.manager)
        return self.client.get(f"{_ENDPOINT}set_aside/", {"edition": str(self.edition.pk)})

    def _restore_set(self, archived_at: str, user=None):
        self.client.force_authenticate(user or self.manager)
        return self.client.post(
            f"{_ENDPOINT}set_aside/restore/",
            {"edition": str(self.edition.pk), "archived_at": archived_at},
            format="json",
        )

    def test_puts_away_every_non_personal_mark_on_the_edition(self) -> None:
        response = self._set_aside()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["count"], 3)
        for mark in (self.shared, self.private, self.leader):
            mark.refresh_from_db()
            self.assertIsNotNone(mark.archived_at)
            self.assertFalse(mark.is_deleted)
        self.pencil.refresh_from_db()
        self.elsewhere.refresh_from_db()
        self.assertIsNone(self.pencil.archived_at)
        self.assertIsNone(self.elsewhere.archived_at)

    def test_nothing_to_put_away_names_no_set(self) -> None:
        self._set_aside()
        again = self._set_aside()
        self.assertEqual(again.json(), {"archived_at": None, "count": 0})
        self.assertEqual(len(self._sets().json()), 1)

    def test_a_set_aside_mark_leaves_the_list_and_moves_the_fingerprint(self) -> None:
        self.client.force_authenticate(self.manager)
        before = self.client.get(
            f"{_ENDPOINT}fingerprint/", {"edition": str(self.edition.pk)},
        ).json()
        self._set_aside()
        listed = self.client.get(_ENDPOINT, {"edition": str(self.edition.pk)}).json()
        self.assertEqual(listed, [])  # the manager's own personal layer is empty here
        after = self.client.get(
            f"{_ENDPOINT}fingerprint/", {"edition": str(self.edition.pk)},
        ).json()
        self.assertNotEqual(before["count"], after["count"])

        self.client.force_authenticate(self.singer_user)
        seen = self.client.get(_ENDPOINT, {"edition": str(self.edition.pk)}).json()
        self.assertEqual([row["id"] for row in seen], [str(self.pencil.pk)])

    def test_a_set_aside_mark_cannot_be_edited_cleared_or_undone_one_by_one(self) -> None:
        self._set_aside()
        self.client.force_authenticate(self.manager)
        patched = self.client.patch(
            f"{_ENDPOINT}{self.shared.pk}/", {"color": "#2563EB"}, format="json",
        )
        self.assertEqual(patched.status_code, 404)
        cleared = self._clear()
        self.assertEqual(cleared.json()["deleted"], 0)
        undone = self.client.post(
            f"{_ENDPOINT}restore/", {"ids": [str(self.shared.pk)]}, format="json",
        )
        self.assertEqual(undone.json()["restored"], [])

    def test_a_replayed_create_of_a_set_aside_mark_is_gone(self) -> None:
        self._set_aside()
        self.client.force_authenticate(self.manager)
        replay = self.client.post(
            _ENDPOINT,
            self._body(id=str(self.shared.pk), layer_name=SHARED_ANNOTATION_LAYER),
            format="json",
        )
        self.assertEqual(replay.status_code, 410)
        self.shared.refresh_from_db()
        self.assertIsNotNone(self.shared.archived_at)

    def test_sets_are_listed_newest_first_and_restore_one_at_a_time(self) -> None:
        first = self._set_aside().json()["archived_at"]
        newer = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        second = self._set_aside().json()["archived_at"]

        sets = self._sets().json()
        self.assertEqual(
            [(row["archived_at"], row["count"]) for row in sets],
            [(second, 1), (first, 3)],
        )

        restored = self._restore_set(first)
        self.assertEqual(restored.json(), {"restored": 3})
        self.shared.refresh_from_db()
        newer.refresh_from_db()
        self.assertIsNone(self.shared.archived_at)
        self.assertIsNotNone(newer.archived_at)
        self.assertEqual([row["archived_at"] for row in self._sets().json()], [second])

    def test_a_restored_set_is_news_again(self) -> None:
        past = timezone.now() - timedelta(days=200)
        Annotation.objects.filter(pk=self.shared.pk).update(content_at=past)
        archived_at = self._set_aside().json()["archived_at"]
        self._restore_set(archived_at)
        self.shared.refresh_from_db()
        self.assertGreater(self.shared.content_at, past + timedelta(days=199))

    def test_only_a_manager_may_set_aside_list_or_restore(self) -> None:
        self._grant_choir_marks()
        for user in (self.singer_user, self.deputy_user):
            self.assertEqual(self._set_aside(user).status_code, 403)
            self.client.force_authenticate(user)
            listed = self.client.get(
                f"{_ENDPOINT}set_aside/", {"edition": str(self.edition.pk)},
            )
            self.assertEqual(listed.status_code, 403)
        archived_at = self._set_aside().json()["archived_at"]
        self.assertEqual(self._restore_set(archived_at, self.singer_user).status_code, 403)

    def test_a_restore_names_its_set_with_a_zoned_moment(self) -> None:
        response = self._restore_set("2026-10-27T10:00:00")
        self.assertEqual(response.status_code, 400)
        self.assertIn("archived_at", response.json()["errors"])

    def test_the_book_neither_counts_nor_prints_a_set_aside_mark(self) -> None:
        items = list(self.project.program_items.select_related("piece"))
        item = next(row for row in items if row.piece_id == self.edition.piece_id)
        page_map = [{
            "kind": "music", "phys": 1, "edition": str(self.edition.pk),
            "src_page": 1, "box": [0, 0, 1, 1],
        }]
        layers = (SHARED_ANNOTATION_LAYER, CONDUCTOR_ANNOTATION_LAYER)

        def counted() -> int:
            # The fixture's editions carry no file, so none binds and every
            # choir mark is counted as waiting elsewhere.
            census = compute_program_markings(items)[item.pk]
            return census.inside + census.outside + census.elsewhere

        self.assertEqual(counted(), 1)
        self.assertTrue(reader_marks_for_book(page_map, self.manager, layers))

        self._set_aside()

        self.assertEqual(counted(), 0)
        self.assertFalse(reader_marks_for_book(page_map, self.manager, layers))
