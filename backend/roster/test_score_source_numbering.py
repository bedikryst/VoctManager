"""
@file test_score_source_numbering.py
@description Proves the two halves of the "one numbering per page" contract:
    the detector only covers a number it can prove is a running folio, and the
    placement keeps the book's own folio strip free of source content. Both are
    pure geometry over hand-built PDFs — no DB, no WeasyPrint — so they run on a
    host without the native renderer the full assembler needs.
@architecture Enterprise SaaS 2026
@module roster/test_score_source_numbering
"""

from __future__ import annotations

from io import BytesIO

from django.test import SimpleTestCase
from pypdf import PdfReader, PdfWriter

from roster.infrastructure.score_package_builder import (
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    BODY_MARGIN_PT,
    FOLIO_RESERVE_PT,
    _place_on_a4,
)
from roster.infrastructure.score_source_numbering import detect_source_folios

MM = 72.0 / 25.4
A4 = (595.2756, 841.8898)

# The duplex folio box, read off _build_duplex_number_overlay's CSS: bottom edge
# 7mm up, 10pt text on a ~1.2 line box plus 3pt of padding.
DUPLEX_FOLIO_TOP_PT = 7 * MM + 15.0


def build_pdf(
    pages: list[list[tuple[str, float, float]]],
    size: tuple[float, float] = A4,
    font_size: float = 10.0,
) -> bytes:
    """A minimal multi-page PDF drawing ``(text, x, y)`` runs in Helvetica.
    Hand-assembled rather than rendered, so the tests state glyph positions in
    exact points instead of trusting a layout engine."""
    width, height = size
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog_id = add(b"")          # placeholder, patched below
    pages_id = add(b"")
    font_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids: list[int] = []
    for runs in pages:
        ops = "\n".join(
            f"BT /F1 {font_size:.2f} Tf {x:.3f} {y:.3f} Td ({text}) Tj ET"
            for text, x, y in runs
        ).encode("latin-1")
        content_id = add(
            b"<< /Length " + str(len(ops)).encode() + b" >>\nstream\n" + ops + b"\nendstream"
        )
        page_ids.append(add(
            f"<< /Type /Page /Parent {pages_id} 0 R "
            f"/MediaBox [0 0 {width:.4f} {height:.4f}] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>".encode()
        ))

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    objects[pages_id - 1] = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    )

    out = bytearray(b"%PDF-1.7\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode() + b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return bytes(out)


def reader_for(pages: list[list[tuple[str, float, float]]], **kwargs) -> PdfReader:
    return PdfReader(BytesIO(build_pdf(pages, **kwargs)))


class DetectorTests(SimpleTestCase):
    """What counts as an edition's own page number — and what must never be
    mistaken for one."""

    def test_running_folio_is_detected_on_every_page(self) -> None:
        # A bottom-outer folio stepping 1, 2, 3, 4 — the ordinary case.
        pages = [[(str(n + 1), 540.0, 34.0)] for n in range(4)]
        masks = detect_source_folios(reader_for(pages), [0, 1, 2, 3])
        self.assertEqual(sorted(masks), [0, 1, 2, 3])
        box = masks[0][0]
        # The box brackets the glyph it covers, with padding on every side.
        self.assertLess(box.left, 540.0)
        self.assertGreater(box.right, 540.0)
        self.assertLess(box.bottom, 34.0)
        self.assertGreater(box.top, 34.0 + 7.0)

    def test_measure_numbers_are_left_alone(self) -> None:
        # Bar numbers in the top band climb by the page's bar count, never by one.
        pages = [[(str(1 + n * 8), 60.0, A4[1] - 40.0)] for n in range(5)]
        self.assertEqual(detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4]), {})

    def test_short_run_is_not_enough_evidence(self) -> None:
        # Two consecutive numbers could be any coincidence; three prove a folio.
        pages = [[("1", 540.0, 34.0)], [("2", 540.0, 34.0)]]
        self.assertEqual(detect_source_folios(reader_for(pages), [0, 1]), {})

    def test_text_inside_the_engraving_is_ignored(self) -> None:
        # Mid-page numerals (fingering, a figured bass) are nowhere near the band.
        pages = [[(str(n + 1), 300.0, A4[1] / 2)] for n in range(5)]
        self.assertEqual(detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4]), {})

    def test_two_numerals_in_one_corner_disqualify_the_cluster(self) -> None:
        # A page carrying two candidates at the same spot is not a running folio.
        pages = [[(str(n + 1), 540.0, 34.0), (str(n + 20), 543.0, 36.0)] for n in range(5)]
        self.assertEqual(detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4]), {})

    def test_roman_folios_are_detected(self) -> None:
        pages = [[(numeral, 540.0, 34.0)] for numeral in ("i", "ii", "iii", "iv")]
        masks = detect_source_folios(reader_for(pages), [0, 1, 2, 3])
        self.assertEqual(sorted(masks), [0, 1, 2, 3])

    def test_sequence_survives_a_digit_count_change(self) -> None:
        # A right-aligned folio holds its right edge and grows leftwards at 9→10.
        # Matching on one edge only would split this into two short sequences,
        # and neither half would prove itself.
        pages = []
        for value in (8, 9, 10, 11, 12):
            width = len(str(value)) * 0.55 * 10.0
            pages.append([(str(value), 556.0 - width, 34.0)])
        masks = detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4])
        self.assertEqual(sorted(masks), [0, 1, 2, 3, 4])

    def test_recto_verso_mirroring_stays_one_sequence(self) -> None:
        # An outer-corner folio alternates left/right between openings. Measuring
        # from the nearer edge keeps it one cluster instead of two short ones.
        pages = []
        for n in range(6):
            x = 540.0 if n % 2 == 0 else 45.0
            pages.append([(str(n + 1), x, 34.0)])
        masks = detect_source_folios(reader_for(pages), list(range(6)))
        self.assertEqual(sorted(masks), [0, 1, 2, 3, 4, 5])

    def test_trimmed_slice_borrows_evidence_from_the_whole_edition(self) -> None:
        # Only two pages bind, which alone could never prove a sequence — the
        # neighbours in the same edition supply the proof.
        pages = [[(str(n + 1), 540.0, 34.0)] for n in range(6)]
        masks = detect_source_folios(reader_for(pages), [2, 3])
        self.assertEqual(sorted(masks), [2, 3])

    def test_a_gap_in_the_text_layer_still_reads_as_a_sequence(self) -> None:
        # Page 3 drops its folio; the values must then jump by two to match.
        pages = [
            [("1", 540.0, 34.0)],
            [("2", 540.0, 34.0)],
            [],
            [("4", 540.0, 34.0)],
            [("5", 540.0, 34.0)],
        ]
        masks = detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4])
        self.assertEqual(sorted(masks), [0, 1, 3, 4])

    def test_a_constant_running_head_is_not_a_folio(self) -> None:
        # A plate number repeated verbatim on every page never steps.
        pages = [[("47", 540.0, 34.0)] for _ in range(5)]
        self.assertEqual(detect_source_folios(reader_for(pages), [0, 1, 2, 3, 4]), {})

    def test_empty_request_scans_nothing(self) -> None:
        pages = [[(str(n + 1), 540.0, 34.0)] for n in range(4)]
        self.assertEqual(detect_source_folios(reader_for(pages), []), {})


def _place(source_page, *, fit: bool, reserve: float, masks=None):
    writer = PdfWriter()
    _place_on_a4(writer, source_page, fit=fit, bottom_reserve_pt=reserve, masks=masks)
    buffer = BytesIO()
    writer.write(buffer)
    return PdfReader(BytesIO(buffer.getvalue())).pages[0]


class PlacementTests(SimpleTestCase):
    """The A4 placement transform, and the strip it keeps clear for the folio."""

    def test_no_reserve_matches_the_historical_centring(self) -> None:
        # Regression guard: with no reserved strip the box is the safe margin on
        # all four sides, which is the geometry every existing book was built on.
        for src_w, src_h in ((595.2756, 841.8898), (612.0, 792.0), (504.0, 756.0)):
            with self.subTest(size=(src_w, src_h)):
                scale = min(
                    (A4_WIDTH_PT - 2 * BODY_MARGIN_PT) / src_w,
                    (A4_HEIGHT_PT - 2 * BODY_MARGIN_PT) / src_h,
                )
                expected_tx = (A4_WIDTH_PT - src_w * scale) / 2.0
                expected_ty = (A4_HEIGHT_PT - src_h * scale) / 2.0
                inner_w = A4_WIDTH_PT - 2 * BODY_MARGIN_PT
                inner_h = A4_HEIGHT_PT - 2 * BODY_MARGIN_PT
                actual_tx = BODY_MARGIN_PT + (inner_w - src_w * scale) / 2.0
                actual_ty = BODY_MARGIN_PT + (inner_h - src_h * scale) / 2.0
                self.assertAlmostEqual(actual_tx, expected_tx, places=6)
                self.assertAlmostEqual(actual_ty, expected_ty, places=6)

    def test_reserved_strip_lifts_source_content_clear_of_the_folio(self) -> None:
        # A source page numbered right down at its own bottom edge must still end
        # up above the strip the book stamps its folio into.
        reader = reader_for([[("7", 540.0, 8.0)]])
        page = _place(reader.pages[0], fit=True, reserve=FOLIO_RESERVE_PT)
        scale = min(
            (A4_WIDTH_PT - 2 * BODY_MARGIN_PT) / A4[0],
            (A4_HEIGHT_PT - BODY_MARGIN_PT - FOLIO_RESERVE_PT) / A4[1],
        )
        lowest_content_pt = FOLIO_RESERVE_PT + 8.0 * scale
        self.assertGreater(lowest_content_pt, DUPLEX_FOLIO_TOP_PT)
        self.assertEqual(float(page.mediabox.width), A4_WIDTH_PT)

    def test_native_scale_also_clears_the_folio_strip(self) -> None:
        # normalize_to_a4=False used to centre on the whole sheet, dropping a
        # source's own footer straight under the duplex knockout.
        src_h = 841.8898
        inner_h = A4_HEIGHT_PT - BODY_MARGIN_PT - FOLIO_RESERVE_PT
        ty = FOLIO_RESERVE_PT + (inner_h - src_h) / 2.0
        self.assertGreater(ty + 12 * MM, DUPLEX_FOLIO_TOP_PT)

    def test_knockout_is_painted_where_the_source_number_landed(self) -> None:
        reader = reader_for([[("7", 540.0, 34.0)]])
        masks = detect_source_folios(reader_for([[(str(n + 1), 540.0, 34.0)] for n in range(4)]), [0])
        page = _place(reader.pages[0], fit=True, reserve=FOLIO_RESERVE_PT, masks=masks[0])
        stream = page.get_contents().get_data().decode("latin-1")
        self.assertIn(" re", stream)
        self.assertIn("1 1 1 rg", stream)

        rect = [
            line for line in stream.splitlines() if line.rstrip().endswith(" re")
        ][-1].split()
        left, bottom, width, height = (float(v) for v in rect[:4])
        scale = min(
            (A4_WIDTH_PT - 2 * BODY_MARGIN_PT) / A4[0],
            (A4_HEIGHT_PT - BODY_MARGIN_PT - FOLIO_RESERVE_PT) / A4[1],
        )
        tx = BODY_MARGIN_PT + (A4_WIDTH_PT - 2 * BODY_MARGIN_PT - A4[0] * scale) / 2.0
        ty = FOLIO_RESERVE_PT
        # The glyph's own position, mapped through the same transform.
        self.assertLess(left, 540.0 * scale + tx)
        self.assertGreater(left + width, 540.0 * scale + tx)
        self.assertLess(bottom, 34.0 * scale + ty)
        self.assertGreater(bottom + height, 34.0 * scale + ty)

    def test_page_without_masks_is_untouched(self) -> None:
        reader = reader_for([[("7", 540.0, 34.0)]])
        page = _place(reader.pages[0], fit=True, reserve=FOLIO_RESERVE_PT, masks=None)
        self.assertNotIn("1 1 1 rg", page.get_contents().get_data().decode("latin-1"))
