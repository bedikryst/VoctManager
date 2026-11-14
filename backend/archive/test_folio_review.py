"""Revision and concurrent-write contracts for print corrections."""

import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from archive.models import ScoreEdition
from core.constants import AppRole
from core.models import UserProfile
from roster import score_folio_review
from roster.test_score_source_numbering import build_pdf

_MEDIA = tempfile.mkdtemp(prefix="vm_folio_review_test_")


class EditionFolioReviewTests(APITestCase):
    def _manager(self) -> None:
        manager = get_user_model().objects.create_user("reviewer")
        UserProfile.objects.create(user=manager, role=AppRole.MANAGER)
        self.client.force_authenticate(manager)
        self.manager = manager

    def test_save_conflict_and_replacement(self) -> None:
        self._manager()
        edition = ScoreEdition.objects.create(original_filename="sample.pdf", sha256="a"*64, page_count=3)
        url = reverse("score-edition-folio-review", args=[edition.pk])
        rule = dict(first=1, last=3, mode="cover", parity="odd", x=.1, y=.1, w=.05, h=.02)
        data = {"sha256": edition.sha256, "rules": [rule], "previous": []}
        self.assertEqual(self.client.put(url, data, format="json").status_code, 200)
        self.assertEqual(self.client.put(url, data, format="json").status_code, 409)
        edition.sha256 = "b"*64
        edition.save(update_fields=["sha256"])
        self.assertEqual(self.client.get(url).json()["rules"], [])
        self.assertEqual(self.client.put(url, data, format="json").status_code, 409)
        profile = self.manager.profile
        profile.role = AppRole.ARTIST
        profile.save(update_fields=["role"])
        self.client.force_authenticate(get_user_model().objects.get(pk=self.manager.pk))
        self.assertEqual(self.client.get(url).status_code, 403)

    @override_settings(MEDIA_ROOT=_MEDIA)
    def test_the_preview_carries_the_detectors_boxes_computed_once(self) -> None:
        self._manager()
        cache.clear()
        edition = ScoreEdition.objects.create(original_filename="folios.pdf", sha256="c"*64, page_count=4)
        edition.pdf_file.save(
            "folios.pdf",
            ContentFile(build_pdf([[(str(n + 1), 540.0, 34.0)] for n in range(4)])),
            save=True,
        )
        url = reverse("score-edition-folio-review", args=[edition.pk])
        with mock.patch.object(
            score_folio_review, "detect_edition_folios", wraps=score_folio_review.detect_edition_folios,
        ) as detect:
            first = self.client.get(url).json()
            second = self.client.get(url).json()
        self.assertEqual(detect.call_count, 1)
        self.assertEqual(first["automatic"], second["automatic"])
        self.assertEqual([box["page"] for box in first["automatic"]], [1, 2, 3, 4])
        box = first["automatic"][0]
        # Bottom-right of a portrait sheet, from the visible page's top-left.
        self.assertGreater(box["x"], 0.85)
        self.assertGreater(box["y"], 0.9)
        # A keep tapped exactly over a detected box saves as an ordinary rule.
        keep = {**{k: box[k] for k in ("x", "y", "w", "h")}, "first": 2, "last": 2, "parity": "all", "mode": "keep"}
        saved = self.client.put(
            url, {"sha256": edition.sha256, "rules": [keep], "previous": []}, format="json",
        )
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(len(saved.json()["automatic"]), 4)

    def test_an_edition_without_a_file_reports_nothing_automatic(self) -> None:
        self._manager()
        edition = ScoreEdition.objects.create(original_filename="none.pdf", sha256="d"*64, page_count=2)
        url = reverse("score-edition-folio-review", args=[edition.pk])
        self.assertIsNone(self.client.get(url).json()["automatic"])
