"""The edition metadata PATCH writes only the columns it names."""

from unittest import mock

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from archive.models import IngestionStatus, ScoreEdition, ScoreLicenseType
from archive.serializers import ScoreEditionDetailSerializer
from core.constants import AppRole
from core.models import UserProfile


class EditionPatchTests(APITestCase):
    def setUp(self) -> None:
        manager = get_user_model().objects.create_user("librarian")
        UserProfile.objects.create(user=manager, role=AppRole.MANAGER)
        self.client.force_authenticate(manager)
        self.edition = ScoreEdition.objects.create(
            original_filename="motet.pdf", sha256="d" * 64,
            ingestion_status=IngestionStatus.EXTRACTING,
        )
        self.url = reverse("score-edition-detail", args=[self.edition.pk])

    def test_a_licence_change_keeps_what_the_worker_wrote_meanwhile(self) -> None:
        """The card stays open while the analysis runs. A licence chosen between
        the request's read and its write must not put back the status, cost and
        suggestion the worker stored in that gap."""
        validate = ScoreEditionDetailSerializer.is_valid

        def worker_moves_on(serializer: ScoreEditionDetailSerializer, *args: object, **kwargs: object) -> bool:
            ScoreEdition.objects.filter(pk=self.edition.pk).update(
                ingestion_status=IngestionStatus.AWAITING,
                ingestion_cost_cents=61,
                stand_whole_page_suggested=True,
            )
            return validate(serializer, *args, **kwargs)  # type: ignore[arg-type]

        with mock.patch.object(
            ScoreEditionDetailSerializer, "is_valid", autospec=True, side_effect=worker_moves_on,
        ):
            response = self.client.patch(
                self.url,
                {"license_type": ScoreLicenseType.LICENSED_COPIES, "copies_owned": 12},
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["license_type"], ScoreLicenseType.LICENSED_COPIES)
        self.edition.refresh_from_db()
        self.assertEqual(self.edition.license_type, ScoreLicenseType.LICENSED_COPIES)
        self.assertEqual(self.edition.copies_owned, 12)
        self.assertEqual(self.edition.ingestion_status, IngestionStatus.AWAITING)
        self.assertEqual(self.edition.ingestion_cost_cents, 61)
        self.assertTrue(self.edition.stand_whole_page_suggested)

    def test_read_only_fields_in_the_body_are_ignored(self) -> None:
        response = self.client.patch(
            self.url,
            {"stand_whole_page": True, "ingestion_status": IngestionStatus.READY},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.edition.refresh_from_db()
        self.assertTrue(self.edition.stand_whole_page)
        self.assertEqual(self.edition.ingestion_status, IngestionStatus.EXTRACTING)
