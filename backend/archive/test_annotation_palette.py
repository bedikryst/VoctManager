"""
@file test_annotation_palette.py
@description The ink rules: a marking may only be written in a palette colour,
    and the conductor's crimson may only be written by a manager. Both matter
    because a printed book can now carry two hands at once — his shared marks
    baked in at build time, a singer's own composed at download — and colour is
    what tells them apart on the page. Also keeps the Python palette and the
    editor's TypeScript one from drifting: a swatch offered on screen and refused
    by the server is a mark a chorister cannot make and is never told why.
@architecture Enterprise SaaS 2026
@module archive/test_annotation_palette
"""

from __future__ import annotations

import re
import tempfile
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from pypdf import PdfWriter
from rest_framework.test import APITestCase

from archive.annotation_palette import PALETTE, is_reserved_ink, normalize_ink
from archive.models import (
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
    Composer,
    Piece,
    ScoreEdition,
)
from core.constants import AppRole
from core.models import UserProfile
from roster.models import Artist, Participation, ProgramItem, Project, VoiceType

_MEDIA = tempfile.mkdtemp(prefix="vm_ink_test_")

_CONDUCTOR_INK = "#DC2626"
_PENCIL = "#1F2933"


def _pdf_bytes(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class PaletteTests(SimpleTestCase):
    def test_only_palette_inks_normalize(self) -> None:
        self.assertEqual(normalize_ink("#dc2626"), _CONDUCTOR_INK)
        for junk in ("", None, "red", "#DC262680", "#12345", "javascript:x"):
            self.assertEqual(normalize_ink(junk), "")

    def test_crimson_is_the_only_reserved_ink(self) -> None:
        reserved = [ink.value for ink in PALETTE if ink.manager_only]
        self.assertEqual(reserved, [_CONDUCTOR_INK])
        self.assertTrue(is_reserved_ink("#dc2626"))
        self.assertFalse(is_reserved_ink(_PENCIL))
        # An unknown colour is not "reserved" — it is simply not writable, which
        # the serializer says first and in its own words.
        self.assertFalse(is_reserved_ink("#000000"))

    def test_python_and_ts_palettes_hold_the_same_inks(self) -> None:
        source = (
            Path(__file__).resolve().parents[2]
            / "frontend" / "src" / "features" / "annotations" / "lib" / "palette.ts"
        ).read_text(encoding="utf-8")
        found = re.findall(
            r'value:\s*"(#[0-9A-Fa-f]{6})",\s*managerOnly:\s*(true|false)', source
        )
        self.assertEqual(
            [(value.upper(), flag == "true") for value, flag in found],
            [(ink.value, ink.manager_only) for ink in PALETTE],
        )


@override_settings(MEDIA_ROOT=_MEDIA)
class InkWriteRuleTests(APITestCase):
    """The gate itself, over the real endpoint."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.singer_user = User.objects.create_user(
            "singer", "singer@test.pl", "pw123456", first_name="Jan", last_name="Kowalski",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)

        self.project = Project.objects.create(
            title="Koncert Maryjny", status=Project.Status.ACTIVE
        )
        self.artist = Artist.objects.create(
            user=self.singer_user, first_name="Jan", last_name="Kowalski",
            email="singer@test.pl", voice_type=VoiceType.TENOR,
        )
        Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        self.edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="score.pdf",
            page_count=2, is_default=True, sha256="a" * 64,
        )
        self.edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(2)), save=True)

    def _body(self, **overrides) -> dict:
        return {
            "edition": str(self.edition.pk),
            "page_number": 1,
            "annotation_type": AnnotationType.FREEHAND,
            "payload": {"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004},
            "layer_name": PERSONAL_ANNOTATION_LAYER,
            "color": _PENCIL,
            **overrides,
        }

    def test_a_colour_outside_the_palette_is_refused(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/archive/annotations/", self._body(color="#BADBAD"), format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("color", response.json()["errors"])

    def test_a_stored_colour_keeps_the_palettes_casing(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/archive/annotations/", self._body(color="#1f2933"), format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Annotation.objects.get().color, _PENCIL)

    def test_the_conductors_ink_is_his_alone(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(
            "/api/archive/annotations/",
            self._body(color=_CONDUCTOR_INK), format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Annotation.objects.exists())

    def test_a_manager_writes_it_freely(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            "/api/archive/annotations/",
            self._body(color=_CONDUCTOR_INK, layer_name=SHARED_ANNOTATION_LAYER),
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_a_chorister_writes_the_rest_of_the_palette(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(
            "/api/archive/annotations/", self._body(color="#2563EB"), format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_an_older_mark_in_a_retired_ink_can_still_be_moved(self) -> None:
        # Rows written before the palette existed are left alone; only a patch
        # that RECOLOURS is judged, so their owner is not locked out of them.
        mark = Annotation.objects.create(
            edition=self.edition, page_number=1,
            annotation_type=AnnotationType.COMMENT,
            payload={"x": 0.1, "y": 0.1, "text": "stare", "display": "pin"},
            color="#FFD700FF", layer_name=PERSONAL_ANNOTATION_LAYER,
            created_by=self.singer_user,
        )
        self.client.force_authenticate(self.singer_user)
        response = self.client.patch(
            f"/api/archive/annotations/{mark.pk}/",
            {"payload": {"x": 0.4, "y": 0.4, "text": "stare", "display": "pin"}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        mark.refresh_from_db()
        self.assertEqual(mark.color, "#FFD700FF")
        self.assertAlmostEqual(mark.payload["x"], 0.4)
