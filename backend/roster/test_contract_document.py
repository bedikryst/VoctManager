"""Typography contract for the artist/crew agreement PDF.

The failure this file exists to prevent is silent by construction. A font stack
carries quotes around multi-word family names; autoescaping them to `&quot;`
leaves a `font-family` the renderer cannot parse, and an unparsable declaration
is not an error — it is a fall back to the host's default serif. The contract
then prints in whatever DejaVu the container happens to ship, with every check
green. It shipped that way once.

WeasyPrint's native libraries are absent from the host, so nothing here renders
a PDF: the assertions run on the HTML handed to the renderer, which is where the
damage is done and where it is visible without Pango.
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.utils.safestring import SafeString

from roster.infrastructure.document_generator import (
    DocumentGenerator,
    _brand_font_context,
)
from roster.infrastructure.print_fonts import (
    BRAND_SANS_STACK,
    BRAND_SERIF_STACK,
    FONT_DIR,
    brand_font_face_css,
)
from roster.models import (
    Artist,
    Collaborator,
    CrewAssignment,
    Participation,
    Project,
)

_BUNDLED = (
    "IBMPlexSans-Regular.ttf",
    "IBMPlexSans-SemiBold.ttf",
    "IBMPlexSans-Bold.ttf",
    "CormorantGaramond-Regular.ttf",
    "CormorantGaramond-SemiBold.ttf",
    "CormorantGaramond-Italic.ttf",
)


class BrandFontBundleTests(SimpleTestCase):
    """The brand faces must resolve to real files in the repo. A missing file is
    skipped rather than fatal at runtime, which is the right behaviour and also
    the reason nothing would announce that the bundle had gone."""

    def test_every_bundled_face_is_on_disk(self) -> None:
        for filename in _BUNDLED:
            with self.subTest(filename=filename):
                self.assertTrue((FONT_DIR / filename).is_file())

    def test_css_declares_all_six_faces_by_file_uri(self) -> None:
        css = brand_font_face_css()
        self.assertEqual(css.count("@font-face"), len(_BUNDLED))
        self.assertIn('font-family: "IBM Plex Sans"', css)
        self.assertIn('font-family: "Cormorant Garamond"', css)
        for filename in _BUNDLED:
            self.assertIn(filename, css)
        self.assertNotIn("http", css)

    def test_stacks_lead_with_the_bundled_face(self) -> None:
        self.assertTrue(BRAND_SANS_STACK.startswith('"IBM Plex Sans"'))
        self.assertTrue(BRAND_SERIF_STACK.startswith('"Cormorant Garamond"'))

    def test_context_is_marked_safe(self) -> None:
        """The defense itself: every value reaches the template pre-marked, so a
        `{{ }}` that forgets `|safe` still emits a parsable stack."""
        for key, value in _brand_font_context().items():
            with self.subTest(key=key):
                self.assertIsInstance(value, SafeString)


class ContractTemplateTests(TestCase):
    """Both generators, through the real template — only the PDF engine is stubbed."""

    def setUp(self) -> None:
        self.project = Project.objects.create(title='Koncert „Lux Aeterna”')
        self.artist = Artist.objects.create(
            first_name="Zażółć", last_name="Gęślą", email="z@example.com", voice_type="TEN"
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project, fee=Decimal("1500.00")
        )
        self.collaborator = Collaborator.objects.create(
            first_name="Sound", last_name="Engineer",
            specialty=Collaborator.Specialty.SOUND,
        )
        self.crew = CrewAssignment.objects.create(
            collaborator=self.collaborator, project=self.project,
            role_description="FOH mix", fee=Decimal("800.00"),
        )

    def _rendered_html(self, generate) -> str:
        with patch(
            "roster.infrastructure.document_generator._render_pdf",
            return_value=b"%PDF-",
        ) as render:
            generate()
        self.assertEqual(render.call_count, 1)
        return str(render.call_args.args[0])

    def _assert_typography_is_intact(self, html: str) -> None:
        # The bug: quotes escaped out of the stack, leaving nothing parsable.
        self.assertNotIn("&quot;", html)
        self.assertIn('font-family: "IBM Plex Sans"', html)
        self.assertIn('font-family: "Cormorant Garamond"', html)
        # The faces have to arrive with the document, not from a CDN at render
        # time — a legal artifact must typeset identically offline.
        self.assertEqual(html.count("@font-face"), len(_BUNDLED))
        self.assertIn("file://", html)
        self.assertNotIn("@import", html)
        self.assertNotIn("googleapis", html)
        self.assertNotIn("fonts.gstatic", html)

    def test_participation_contract_carries_the_bundled_faces(self) -> None:
        html = self._rendered_html(
            lambda: DocumentGenerator.generate_participation_contract_pdf(self.participation)
        )
        self._assert_typography_is_intact(html)
        self.assertIn("Zażółć", html)

    def test_crew_contract_carries_the_bundled_faces(self) -> None:
        html = self._rendered_html(
            lambda: DocumentGenerator.generate_crew_contract_pdf(self.crew)
        )
        self._assert_typography_is_intact(html)
        self.assertIn("FOH mix", html)
