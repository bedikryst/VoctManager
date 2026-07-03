"""
@file test_score_protection.py
@description Coverage for licensed-score protection: export gating per role and
    licence, the personal watermark (present for protected + chorister, absent
    for public-domain or manager), the append-only access log with stable
    per-recipient copy numbering, and proof that watermarking left the score-book
    distribution signal (mark_distributed) untouched. WeasyPrint is absent on the
    host, so the serve tests patch ``roster.views.stamp_pdf`` and the one real
    stamp test patches the overlay renderer — the merge/placement contract is
    still exercised on pure pypdf.
@architecture Enterprise SaaS 2026
@module roster/test_score_protection
"""

from __future__ import annotations

import tempfile
from datetime import datetime
from io import BytesIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings
from pypdf import PdfReader, PdfWriter
from rest_framework.test import APIRequestFactory, APITestCase

from archive.models import (
    Composer,
    Piece,
    ScoreAccessLog,
    ScoreEdition,
    ScoreLicenseType,
)
from archive.score_protection import (
    build_watermark_footer,
    can_export,
    copy_holder_name,
)
from core.constants import AppRole
from core.models import UserProfile
from roster.infrastructure import score_watermark
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    ScorePackage,
    VoiceType,
)
from roster.score_package_service import ScorePackageService

_MEDIA = tempfile.mkdtemp(prefix="vm_score_protection_test_")


def _pdf_bytes(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Pure policy — export gating + footer composition
# ---------------------------------------------------------------------------

class PolicyTests(SimpleTestCase):
    @staticmethod
    def _ed(license_type: str) -> ScoreEdition:
        return ScoreEdition(license_type=license_type)

    def test_public_domain_exportable_by_everyone(self) -> None:
        edition = self._ed(ScoreLicenseType.PUBLIC_DOMAIN)
        self.assertFalse(edition.is_license_protected)
        self.assertTrue(can_export(edition, is_manager=False))
        self.assertTrue(can_export(edition, is_manager=True))

    def test_protected_variants_are_manager_only(self) -> None:
        for lic in (
            ScoreLicenseType.LICENSED_COPIES,
            ScoreLicenseType.PUBLISHER_DIGITAL,
            ScoreLicenseType.UNKNOWN,  # safe default: unclassified = protected
        ):
            edition = self._ed(lic)
            self.assertTrue(edition.is_license_protected)
            self.assertFalse(can_export(edition, is_manager=False))
            self.assertTrue(can_export(edition, is_manager=True))

    def test_footer_carries_all_segments_and_no_email(self) -> None:
        footer = build_watermark_footer(
            copy_number=7,
            holder_name="Jan Kowalski",
            context_label="Koncert Maryjny",
            when=datetime(2026, 7, 3),
        )
        self.assertIn("Egzemplarz nr 7", footer)
        self.assertIn("Jan Kowalski", footer)
        self.assertIn("Koncert Maryjny", footer)
        self.assertIn("03.07.2026", footer)
        self.assertNotIn("@", footer)  # RODO: never the email

    def test_footer_omits_copy_number_and_blanks(self) -> None:
        footer = build_watermark_footer(
            copy_number=None, holder_name="", context_label="", when=datetime(2026, 7, 3),
        )
        self.assertNotIn("Egzemplarz", footer)
        self.assertEqual(footer, "03.07.2026")


# ---------------------------------------------------------------------------
# Watermark renderer — overlay merge contract (no WeasyPrint)
# ---------------------------------------------------------------------------

class WatermarkStampTests(TestCase):
    def test_stamp_preserves_page_count_outline_and_propagates_footer(self) -> None:
        writer = PdfWriter()
        for _ in range(3):
            writer.add_blank_page(width=595, height=842)
        writer.add_outline_item("Utwór 1", 0)
        writer.add_outline_item("Utwór 2", 2)
        buffer = BytesIO()
        writer.write(buffer)
        source = buffer.getvalue()

        def _fake_overlay(width, height, footer_text):
            spare = PdfWriter()
            return spare.add_blank_page(width=width, height=height)

        with mock.patch.object(
            score_watermark, "render_footer_overlay", side_effect=_fake_overlay,
        ) as overlay:
            stamped = score_watermark.stamp_pdf(source, "Egzemplarz nr 1  ·  Jan Kowalski")

        reader = PdfReader(BytesIO(stamped))
        # No page added or removed …
        self.assertEqual(len(reader.pages), 3)
        # … outline anchors survive …
        self.assertGreaterEqual(len(reader.outline), 2)
        # … one overlay render for three same-size pages (memoised) …
        self.assertEqual(overlay.call_count, 1)
        # … and the footer text reached the renderer.
        self.assertEqual(overlay.call_args.args[2], "Egzemplarz nr 1  ·  Jan Kowalski")


# ---------------------------------------------------------------------------
# copy_holder_name — never leaks the login/email
# ---------------------------------------------------------------------------

class CopyHolderNameTests(TestCase):
    def test_prefers_full_name(self) -> None:
        user = get_user_model().objects.create_user(
            "holder1", "holder1@test.pl", "pw123456", first_name="Jan", last_name="Kowalski",
        )
        self.assertEqual(copy_holder_name(user), "Jan Kowalski")

    def test_falls_back_to_artist_then_empty_never_email(self) -> None:
        user = get_user_model().objects.create_user("holder2", "holder2@test.pl", "pw123456")
        Artist.objects.create(
            user=user, first_name="Ola", last_name="Nowak",
            email="holder2@test.pl", voice_type=VoiceType.ALTO,
        )
        self.assertEqual(copy_holder_name(user), "Ola Nowak")

        nameless = get_user_model().objects.create_user("holder3", "holder3@test.pl", "pw123456")
        self.assertEqual(copy_holder_name(nameless), "")


# ---------------------------------------------------------------------------
# Serve choke points — audit + watermark decision, both single edition + binder
# ---------------------------------------------------------------------------

@override_settings(MEDIA_ROOT=_MEDIA)
class _ServeBase(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.singer_user = User.objects.create_user(
            "singer", "singer@test.pl", "pw123456", first_name="Jan", last_name="Kowalski",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer2_user = User.objects.create_user(
            "singer2", "singer2@test.pl", "pw123456", first_name="Ola", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.singer2_user, role=AppRole.ARTIST)

        self.project = Project.objects.create(title="Koncert Maryjny")
        self.artist = Artist.objects.create(
            user=self.singer_user, first_name="Jan", last_name="Kowalski",
            email="singer@test.pl", voice_type=VoiceType.TENOR,
        )
        self.artist2 = Artist.objects.create(
            user=self.singer2_user, first_name="Ola", last_name="Nowak",
            email="singer2@test.pl", voice_type=VoiceType.ALTO,
        )
        Participation.objects.create(
            artist=self.artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        Participation.objects.create(
            artist=self.artist2, project=self.project, status=Participation.Status.CONFIRMED,
        )
        self.composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=self.composer)
        self.item = ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        self.edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="score.pdf",
            page_count=2, is_default=True, sha256="a" * 64,
        )
        self.edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(2)), save=True)

    @property
    def download_url(self) -> str:
        return f"/api/materials/scores/{self.edition.pk}/download/"

    @property
    def binder_url(self) -> str:
        return f"/api/projects/{self.project.pk}/score_pdf/"

    @staticmethod
    def _body(response) -> bytes:
        return b"".join(response.streaming_content)


class EditionServeTests(_ServeBase):
    def test_public_domain_served_raw_to_chorister(self) -> None:
        self.edition.license_type = ScoreLicenseType.PUBLIC_DOMAIN
        self.edition.save()
        self.client.force_authenticate(self.singer_user)
        with mock.patch("roster.views.stamp_pdf") as stamp:
            response = self.client.get(self.download_url)
        self.assertEqual(response.status_code, 200)
        stamp.assert_not_called()
        self.assertEqual(self._body(response), _pdf_bytes(2))
        log = ScoreAccessLog.objects.get(edition=self.edition, user=self.singer_user)
        self.assertFalse(log.was_watermarked)
        self.assertIsNone(log.copy_number)

    def test_protected_watermarked_for_chorister_with_stable_copy_number(self) -> None:
        # UNKNOWN default → protected.
        self.client.force_authenticate(self.singer_user)
        with mock.patch("roster.views.stamp_pdf", return_value=b"%PDF-STAMPED") as stamp:
            first = self.client.get(self.download_url)
            second = self.client.get(self.download_url)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(self._body(first), b"%PDF-STAMPED")
        stamp.assert_called()
        footer = stamp.call_args.args[1]
        self.assertIn("Egzemplarz nr 1", footer)
        self.assertIn("Jan Kowalski", footer)
        self.assertNotIn("@", footer)
        # Every GET logged; copy number is stable across the re-download.
        logs = list(
            ScoreAccessLog.objects.filter(edition=self.edition, user=self.singer_user)
            .order_by("created_at")
        )
        self.assertEqual(len(logs), 2)
        self.assertTrue(all(log.was_watermarked for log in logs))
        self.assertEqual([log.copy_number for log in logs], [1, 1])
        # Second serve came from cache — stamped once.
        self.assertEqual(self._body(second), b"%PDF-STAMPED")

    def test_protected_served_clean_to_manager(self) -> None:
        self.client.force_authenticate(self.manager)
        with mock.patch("roster.views.stamp_pdf") as stamp:
            response = self.client.get(self.download_url)
        self.assertEqual(response.status_code, 200)
        stamp.assert_not_called()
        self.assertEqual(self._body(response), _pdf_bytes(2))
        log = ScoreAccessLog.objects.get(edition=self.edition, user=self.manager)
        self.assertFalse(log.was_watermarked)
        self.assertIsNone(log.copy_number)

    def test_copy_numbers_increment_across_recipients(self) -> None:
        for user in (self.singer_user, self.singer2_user):
            self.client.force_authenticate(user)
            with mock.patch("roster.views.stamp_pdf", return_value=b"X"):
                self.client.get(self.download_url)
        first = ScoreAccessLog.objects.get(edition=self.edition, user=self.singer_user)
        second = ScoreAccessLog.objects.get(edition=self.edition, user=self.singer2_user)
        self.assertEqual({first.copy_number, second.copy_number}, {1, 2})


class BinderServeTests(_ServeBase):
    def _prepare_binder(self, *, protected: bool) -> None:
        self.edition.license_type = (
            ScoreLicenseType.LICENSED_COPIES if protected else ScoreLicenseType.PUBLIC_DOMAIN
        )
        self.edition.save()
        package = ScorePackageService.get_or_create(self.project)
        package.status = ScorePackage.Status.READY
        package.build_version = 1
        package.save()
        self.project.score_pdf.save("book.pdf", ContentFile(_pdf_bytes(3)), save=True)

    def test_binder_watermarked_when_any_edition_protected(self) -> None:
        self._prepare_binder(protected=True)
        self.client.force_authenticate(self.singer_user)
        with mock.patch("roster.views.stamp_pdf", return_value=b"%PDF-BOOK-STAMPED") as stamp:
            response = self.client.get(self.binder_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._body(response), b"%PDF-BOOK-STAMPED")
        stamp.assert_called()
        log = ScoreAccessLog.objects.get(project=self.project, user=self.singer_user)
        self.assertTrue(log.was_watermarked)
        self.assertEqual(log.copy_number, 1)
        self.assertEqual(log.build_version, 1)
        # mark_distributed still fires for a chorister download.
        package = ScorePackage.objects.get(project=self.project)
        self.assertIsNotNone(package.distributed_at)

    def test_binder_public_domain_served_raw_but_still_marks_distribution(self) -> None:
        self._prepare_binder(protected=False)
        self.client.force_authenticate(self.singer_user)
        with mock.patch("roster.views.stamp_pdf") as stamp:
            response = self.client.get(self.binder_url)
        self.assertEqual(response.status_code, 200)
        stamp.assert_not_called()
        self.assertEqual(self._body(response), _pdf_bytes(3))
        package = ScorePackage.objects.get(project=self.project)
        self.assertIsNotNone(package.distributed_at)

    def test_binder_manager_preview_is_clean_and_not_distribution(self) -> None:
        self._prepare_binder(protected=True)
        self.client.force_authenticate(self.manager)
        with mock.patch("roster.views.stamp_pdf") as stamp:
            response = self.client.get(self.binder_url)
        self.assertEqual(response.status_code, 200)
        stamp.assert_not_called()
        self.assertEqual(self._body(response), _pdf_bytes(3))
        package = ScorePackage.objects.get(project=self.project)
        self.assertIsNone(package.distributed_at)  # manager preview ≠ distribution
        log = ScoreAccessLog.objects.get(project=self.project, user=self.manager)
        self.assertFalse(log.was_watermarked)


# ---------------------------------------------------------------------------
# Cockpit read model + edition DTO
# ---------------------------------------------------------------------------

@override_settings(MEDIA_ROOT=_MEDIA)
class CockpitAndDtoTests(_ServeBase):
    def test_uses_protected_edition_tracks_license(self) -> None:
        self.edition.license_type = ScoreLicenseType.PUBLIC_DOMAIN
        self.edition.save()
        self.assertFalse(ScorePackageService.uses_protected_edition(self.project))
        self.edition.license_type = ScoreLicenseType.LICENSED_COPIES
        self.edition.save()
        self.assertTrue(ScorePackageService.uses_protected_edition(self.project))

    def test_copies_shortfall_flagged_when_cast_exceeds_owned(self) -> None:
        # Two singers in the cast, one licensed copy → shortfall.
        self.edition.license_type = ScoreLicenseType.LICENSED_COPIES
        self.edition.copies_owned = 1
        self.edition.save()
        state = ScorePackageService.compute_state(self.project)
        self.assertEqual(state["cast_size"], 2)
        item = state["items"][0]
        self.assertEqual(item["copies_shortfall"], {"copies_owned": 1, "cast_size": 2})
        self.assertIn(self.piece.title, state["pieces_over_copies"])

    def test_copies_shortfall_absent_when_enough_copies(self) -> None:
        self.edition.license_type = ScoreLicenseType.LICENSED_COPIES
        self.edition.copies_owned = 5
        self.edition.save()
        state = ScorePackageService.compute_state(self.project)
        self.assertIsNone(state["items"][0]["copies_shortfall"])
        self.assertEqual(state["pieces_over_copies"], [])

    def test_copies_shortfall_only_for_licensed_copies_type(self) -> None:
        # PUBLISHER_DIGITAL is protected but has no per-copy count to breach.
        self.edition.license_type = ScoreLicenseType.PUBLISHER_DIGITAL
        self.edition.copies_owned = 1
        self.edition.save()
        state = ScorePackageService.compute_state(self.project)
        self.assertIsNone(state["items"][0]["copies_shortfall"])

    def test_edition_snippet_can_export_reflects_role_and_license(self) -> None:
        from roster.dashboard_serializers import EditionSnippetSerializer

        self.edition.license_type = ScoreLicenseType.LICENSED_COPIES
        self.edition.save()
        factory = APIRequestFactory()

        singer_request = factory.get("/")
        singer_request.user = self.singer_user
        data = EditionSnippetSerializer(self.edition, context={"request": singer_request}).data
        self.assertFalse(data["can_export"])
        self.assertEqual(data["license_type"], ScoreLicenseType.LICENSED_COPIES)

        manager_request = factory.get("/")
        manager_request.user = self.manager
        data = EditionSnippetSerializer(self.edition, context={"request": manager_request}).data
        self.assertTrue(data["can_export"])


@override_settings(MEDIA_ROOT=_MEDIA)
class EditionMetadataPatchTests(_ServeBase):
    def test_manager_patches_license_fields(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.patch(
            f"/api/archive/editions/{self.edition.pk}/",
            {"license_type": ScoreLicenseType.LICENSED_COPIES, "copies_owned": 12},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.edition.refresh_from_db()
        self.assertEqual(self.edition.license_type, ScoreLicenseType.LICENSED_COPIES)
        self.assertEqual(self.edition.copies_owned, 12)
        self.assertIn("can_export", response.data)

    def test_chorister_cannot_patch_license(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.patch(
            f"/api/archive/editions/{self.edition.pk}/",
            {"license_type": ScoreLicenseType.PUBLIC_DOMAIN},
            format="json",
        )
        self.assertIn(response.status_code, (403, 404))
        self.edition.refresh_from_db()
        self.assertEqual(self.edition.license_type, ScoreLicenseType.UNKNOWN)
