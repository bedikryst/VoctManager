"""Concurrency and invalidation of private choir compositions."""

import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from roster.score_book_cache import CompositionBusy, open_choir_copy


class ChoirCompositionTests(SimpleTestCase):
    def setUp(self) -> None:
        cache.clear()

    def test_parallel_requests_compose_once_and_a_change_replaces_the_copy(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            cache.clear()

            def compose() -> bytes:
                time.sleep(0.2)
                return b"marked book"

            render = mock.Mock(side_effect=compose)

            def request() -> bytes:
                with open_choir_copy("project", "book", "marks", render) as handle:
                    return handle.read()

            with ThreadPoolExecutor(max_workers=10) as pool:
                self.assertEqual(list(pool.map(lambda _: request(), range(10))), [b"marked book"] * 10)
            self.assertEqual(render.call_count, 1)
            with open_choir_copy("project", "book", "edited", lambda: b"new") as handle:
                self.assertEqual(handle.read(), b"new")
            files = list((Path(media) / "project_scores" / "composed" / "project").glob("*.pdf"))
            self.assertEqual(len(files), 1)

    def test_failed_composition_is_not_published_and_can_be_retried(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            cache.clear()
            with self.assertRaises(ValueError):
                open_choir_copy("project", "book", "marks", mock.Mock(side_effect=ValueError))
            with open_choir_copy("project", "book", "marks", lambda: b"complete") as handle:
                self.assertEqual(handle.read(), b"complete")

    def test_book_replacement_invalidates_the_copy_without_changing_marks(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            with open_choir_copy("project", "first-book", "marks", lambda: b"old"):
                pass
            render = mock.Mock(return_value=b"replacement")
            with open_choir_copy("project", "second-book", "marks", render) as handle:
                self.assertEqual(handle.read(), b"replacement")
            with open_choir_copy("project", "second-book", "marks", render) as handle:
                self.assertEqual(handle.read(), b"replacement")
            render.assert_called_once_with()

    def test_projects_cannot_read_or_prune_each_others_compositions(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            for project in ("first", "second"):
                render = mock.Mock(return_value=project.encode())
                with open_choir_copy(project, "book", "marks", render) as handle:
                    self.assertEqual(handle.read(), project.encode())
            render = mock.Mock(side_effect=AssertionError("The first copy must still exist"))
            with open_choir_copy("first", "book", "marks", render) as handle:
                self.assertEqual(handle.read(), b"first")
            render.assert_not_called()

    def test_wait_timeout_preserves_the_other_workers_lock(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            cache.set("score_book_composition:project", "other-worker")
            render = mock.Mock()
            with (
                mock.patch("roster.score_book_cache._WAIT_SECONDS", 0),
                self.assertRaises(CompositionBusy),
            ):
                open_choir_copy("project", "book", "marks", render)
            render.assert_not_called()
            self.assertEqual(cache.get("score_book_composition:project"), "other-worker")

    def test_failed_publication_preserves_the_old_copy_and_releases_the_lock(self) -> None:
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            with open_choir_copy("project", "book", "old", lambda: b"old"):
                pass
            with (
                mock.patch("roster.score_book_cache.os.replace", side_effect=OSError),
                self.assertRaises(OSError),
            ):
                open_choir_copy("project", "book", "new", lambda: b"new")
            directory = Path(media) / "project_scores" / "composed" / "project"
            self.assertEqual(len(list(directory.glob("*.pdf"))), 1)
            self.assertEqual(list(directory.glob("*.tmp")), [])
            self.assertIsNone(cache.get("score_book_composition:project"))
            with open_choir_copy("project", "book", "new", lambda: b"complete") as handle:
                self.assertEqual(handle.read(), b"complete")
