"""Revision and concurrent-write contracts for print corrections."""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from archive.models import ScoreEdition
from core.constants import AppRole
from core.models import UserProfile


class EditionFolioReviewTests(APITestCase):
    def test_save_conflict_and_replacement(self) -> None:
        manager = get_user_model().objects.create_user("reviewer")
        UserProfile.objects.create(user=manager, role=AppRole.MANAGER)
        self.client.force_authenticate(manager)
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
        profile = manager.profile
        profile.role = AppRole.ARTIST
        profile.save(update_fields=["role"])
        self.client.force_authenticate(get_user_model().objects.get(pk=manager.pk))
        self.assertEqual(self.client.get(url).status_code, 403)
