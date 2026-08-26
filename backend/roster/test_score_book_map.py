"""
@file test_score_book_map.py
@description Coverage for the screen-side projection of the score book's page
    map — the read model that lets the binder be read with a pencil. What it has
    to get right is a change of frame: the build records a placed box in PDF
    points measured from the sheet's BOTTOM-left, the browser lays out in
    fractions from the TOP-left, and a vertical axis flipped one time too many
    or too few puts every marking on the wrong stave without ever raising an
    error. So the box is asserted against the print path's own placement helper,
    which is the one place that already knows the answer.

    Also asserted: that a book with no map (hand-uploaded, or never generated)
    answers "no pencil here" instead of failing, and that the endpoint's access
    follows the file's — a closed concert's binder is not a singer's to read.
@architecture Enterprise SaaS 2026
@module roster/test_score_book_map
"""

from __future__ import annotations

import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APITestCase

from archive.models import Composer, Piece
from core.constants import AppRole
from core.models import UserProfile
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    VoiceType,
)
from roster.score_package_service import ScorePackageService
from roster.score_page_map import (
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    KIND_CARD,
    KIND_FRONT,
    KIND_MUSIC,
    KIND_SPACER,
    book_frames,
    book_item_spans,
    normalized_to_sheet,
)

_MEDIA = tempfile.mkdtemp(prefix="vm_score_book_map_test_")

_BOX = [14.0, 20.0, 560.0, 800.0]


def _pdf_bytes(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class BookFrameTests(SimpleTestCase):
    def _map(self) -> list[dict]:
        return [
            {"phys": 0, "kind": KIND_FRONT},
            {"phys": 1, "kind": KIND_CARD, "item": "I1"},
            {"phys": 2, "kind": KIND_MUSIC, "item": "I1",
             "edition": "E1", "src_page": 3, "box": list(_BOX)},
            {"phys": 3, "kind": KIND_MUSIC, "item": "I1",
             "edition": "E1", "src_page": 4, "box": list(_BOX)},
            {"phys": 4, "kind": KIND_SPACER, "item": "I2"},
            {"phys": 5, "kind": KIND_MUSIC, "item": "I2",
             "edition": "E2", "src_page": 1, "box": list(_BOX)},
        ]

    def test_pages_are_one_based_for_the_reader(self) -> None:
        frames = book_frames(self._map())
        # phys is a 0-based index into the file; a page is what a person counts.
        self.assertEqual([frame["page"] for frame in frames], [3, 4, 6])
        self.assertEqual([frame["src_page"] for frame in frames], [3, 4, 1])
        self.assertEqual([frame["edition"] for frame in frames], ["E1", "E1", "E2"])

    def test_box_is_the_same_rectangle_the_printer_draws_in(self) -> None:
        left, top, width, height = book_frames(self._map())[0]["box"]
        # Every corner of the normalized box has to name the same spot on the
        # sheet as the print path's own mapping of that corner.
        for nx, ny, want_x, want_y in (
            (0.0, 0.0, left, top),
            (1.0, 1.0, left + width, top + height),
            (0.5, 0.5, left + width / 2, top + height / 2),
        ):
            sheet_x, sheet_y = normalized_to_sheet(
                (_BOX[0], _BOX[1], _BOX[2], _BOX[3]), nx, ny,
            )
            self.assertAlmostEqual(sheet_x / A4_WIDTH_PT, want_x, places=6)
            self.assertAlmostEqual(sheet_y / A4_HEIGHT_PT, want_y, places=6)

    def test_box_stays_a_fraction_of_the_sheet(self) -> None:
        left, top, width, height = book_frames(self._map())[0]["box"]
        self.assertGreater(width, 0)
        self.assertGreater(height, 0)
        self.assertGreaterEqual(left, 0)
        self.assertLessEqual(left + width, 1.000001)
        self.assertLessEqual(top + height, 1.000001)

    def test_item_spans_include_the_card_a_piece_opens_on(self) -> None:
        spans = book_item_spans(self._map())
        self.assertEqual(
            spans,
            [
                {"item": "I1", "first_page": 2, "last_page": 4},
                {"item": "I2", "first_page": 5, "last_page": 6},
            ],
        )

    def test_a_map_that_outlived_its_code_yields_nothing_rather_than_lies(self) -> None:
        self.assertEqual(book_frames([]), [])
        self.assertEqual(book_item_spans([]), [])
        self.assertEqual(book_item_spans(["nonsense", {"kind": KIND_MUSIC}]), [])


@override_settings(MEDIA_ROOT=_MEDIA)
class ScoreMapEndpointTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.singer_user = User.objects.create_user("singer", "singer@test.pl", "pw123456")
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.project = Project.objects.create(
            title="Koncert Maryjny", status=Project.Status.ACTIVE,
        )
        self.artist = Artist.objects.create(
            user=self.singer_user, first_name="Jan", last_name="Kowalski",
            email="singer@test.pl", voice_type=VoiceType.TENOR,
        )
        Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=self.composer)
        self.item = ProgramItem.objects.create(
            project=self.project, piece=self.piece, order=1,
        )
        self.project.score_pdf.save("book.pdf", ContentFile(_pdf_bytes(3)), save=True)
        self.package = ScorePackageService.get_or_create(self.project)
        self.package.page_map = [
            {"phys": 0, "kind": KIND_FRONT},
            {"phys": 1, "kind": KIND_MUSIC, "item": str(self.item.pk),
             "edition": "E1", "src_page": 1, "box": list(_BOX)},
            {"phys": 2, "kind": KIND_MUSIC, "item": str(self.item.pk),
             "edition": "E1", "src_page": 2, "box": list(_BOX)},
        ]
        self.package.save(update_fields=["page_map"])
        self.client.force_authenticate(user=self.singer_user)

    @property
    def url(self) -> str:
        return f"/api/projects/{self.project.pk}/score_map/"

    def test_singer_gets_the_map_and_the_programme(self) -> None:
        data = self.client.get(self.url).json()
        self.assertTrue(data["available"])
        self.assertEqual([page["page"] for page in data["pages"]], [2, 3])
        self.assertEqual(
            data["items"],
            [{
                "id": str(self.item.pk),
                "order": 1,
                "title": "Locus iste",
                "composer": "Bruckner",
                "is_encore": False,
                "first_page": 2,
                "last_page": 3,
            }],
        )

    def test_hand_uploaded_book_has_no_pencil_but_is_not_an_error(self) -> None:
        ScorePackageService.mark_manual_upload(self.project)
        data = self.client.get(self.url).json()
        self.assertFalse(data["available"])
        self.assertEqual(data["pages"], [])
        self.assertEqual(data["items"], [])
        # No map is not the same as no file: the book is still readable and still
        # worth keeping on a phone, so it still has to be nameable.
        self.assertTrue(data["stamp"])

    def test_stamp_follows_the_bytes_not_the_build_version(self) -> None:
        self.package.build_version = 4
        self.package.generated_at = timezone.now()
        self.package.save(update_fields=["build_version", "generated_at"])
        before = self.client.get(self.url).json()["stamp"]
        self.assertTrue(before)

        # A hand-uploaded replacement leaves the build version alone by design.
        # Anything keyed on the version would go on serving the previous book.
        ScorePackageService.mark_manual_upload(self.project)
        self.package.refresh_from_db()
        self.assertEqual(self.package.build_version, 4)
        self.assertNotEqual(self.client.get(self.url).json()["stamp"], before)

    def test_no_book_no_stamp(self) -> None:
        self.project.score_pdf.delete(save=True)
        # Empty is the instruction "keep no copy" — there is nothing to keep.
        self.assertEqual(self.client.get(self.url).json()["stamp"], "")

    def test_a_piece_dropped_from_the_programme_leaves_no_row(self) -> None:
        # Its pages are still bound; nothing in the app claims otherwise.
        self.item.delete()
        data = self.client.get(self.url).json()
        self.assertTrue(data["available"])
        self.assertEqual(data["items"], [])

    def test_closed_concert_closes_the_map_too(self) -> None:
        self.project.status = Project.Status.COMPLETED
        self.project.save(update_fields=["status"])
        data = self.client.get(self.url).json()
        self.assertFalse(data["available"])

    def test_no_book_no_map(self) -> None:
        self.project.score_pdf.delete(save=True)
        self.assertFalse(self.client.get(self.url).json()["available"])


@override_settings(MEDIA_ROOT=_MEDIA)
class MaterialsDashboardBookFlagTests(TestCase):
    """The songbook is the one place a singer goes for music, so it has to know
    whether this concert has a bound book at all."""

    def setUp(self) -> None:
        User = get_user_model()
        self.user = User.objects.create_user("singer", "singer@test.pl", "pw123456")
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.project = Project.objects.create(
            title="Koncert Maryjny", status=Project.Status.ACTIVE,
        )
        self.artist = Artist.objects.create(
            user=self.user, first_name="Jan", last_name="Kowalski",
            email="singer@test.pl", voice_type=VoiceType.TENOR,
        )
        Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.client.force_login(self.user)

    def _project_row(self) -> dict:
        response = self.client.get("/api/participations/materials-dashboard/")
        return response.json()[0]["project"]

    def test_flag_follows_the_file(self) -> None:
        self.assertFalse(self._project_row()["has_score_pdf"])
        self.project.score_pdf.save("book.pdf", ContentFile(_pdf_bytes(1)), save=True)
        self.assertTrue(self._project_row()["has_score_pdf"])

    def test_closed_concert_offers_no_book(self) -> None:
        self.project.score_pdf.save("book.pdf", ContentFile(_pdf_bytes(1)), save=True)
        self.project.status = Project.Status.COMPLETED
        self.project.save(update_fields=["status"])
        rows = self.client.get("/api/participations/materials-dashboard/").json()
        # A completed concert may drop off the songbook entirely; if it is still
        # listed, it must not be offering its book.
        for row in rows:
            self.assertFalse(row["project"]["has_score_pdf"])


__all__ = [
    "BookFrameTests",
    "MaterialsDashboardBookFlagTests",
    "ScoreMapEndpointTests",
]
