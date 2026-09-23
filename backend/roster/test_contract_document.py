"""Typography contract for the bundled brand faces every outward-facing PDF uses.

The failure this file exists to prevent is silent by construction. A font stack
carries quotes around multi-word family names; autoescaping them to `&quot;`
leaves a `font-family` the renderer cannot parse, and an unparsable declaration
is not an error — it is a fall back to the host's default serif. A document
then prints in whatever DejaVu the container happens to ship, with every check
green. It shipped that way once, on the contract.

The same assertions on the finance documents' own HTML live in
`finance/tests/test_documents.py`.
"""

from __future__ import annotations

from django.test import SimpleTestCase
from django.utils.safestring import SafeString

from roster.infrastructure.document_generator import _brand_font_context
from roster.infrastructure.print_fonts import (
    BRAND_SANS_STACK,
    BRAND_SERIF_STACK,
    FONT_DIR,
    brand_font_face_css,
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
