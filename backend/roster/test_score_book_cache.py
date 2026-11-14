"""Concurrency and invalidation of private choir compositions."""

import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from roster.score_book_cache import open_choir_copy


class ChoirCompositionTests(SimpleTestCase):
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
