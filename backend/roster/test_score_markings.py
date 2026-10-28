"""
@file test_score_markings.py
@description Coverage for the page map and the printed markings layer: that the
    build records where every source page landed, that the record dies with the
    file it describes, that a mark is placed on the book page its music actually
    occupies, that print translation happens (a highlighter must never print as a
    filled band), and that the stored book carries no marks at all — so drawing
    on a score never ages it — with the sweep that rebuilds a book baked under
    the older builder. Composing marks onto a served copy is covered in
    test_score_protection. WeasyPrint's native renderer is absent on host CI, so
    both render paths are stubbed and asserted on the markup they produce.
@module roster/test_score_markings
"""

from __future__ import annotations

import tempfile
from io import BytesIO, StringIO
from unittest import mock

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from pypdf import PdfReader, PdfWriter

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
    Composer,
    Piece,
    ScoreEdition,
)
from roster import score_package_service
from roster.infrastructure import score_markings
from roster.infrastructure.score_markings import (
    PrintMark,
    apply_markings,
    marks_from_annotations,
    plan_markings,
)
from roster.infrastructure.score_package_builder import BuildResult
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import resolve_item_page_window
from roster.score_package_markings import (
    MARKINGS_NONE,
    MARKINGS_OFF,
    MARKINGS_PARTIAL,
    MARKINGS_READY,
    MARKINGS_WRONG_EDITION,
    compute_program_markings,
    markings_status,
)
from roster.score_package_service import ScorePackageService
from roster.score_page_map import (
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    KIND_CARD,
    KIND_FRONT,
    KIND_MUSIC,
    PlacedBox,
    music_pages,
    normalized_to_sheet,
)

_MEDIA = tempfile.mkdtemp(prefix="vm_score_marks_test_")

# A representative placed box: an edition page fitted onto A4 inside the safe
# margin. (x, y from the sheet's bottom-left, then width and height.)
_BOX: PlacedBox = (14.0, 20.0, 560.0, 800.0)


def _pdf_bytes(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def _blank_sheets(pages: int) -> list:
    """Stand-ins for what the overlay renderer hands back."""
    return list(PdfReader(BytesIO(_pdf_bytes(pages))).pages)


@override_settings(MEDIA_ROOT=_MEDIA)
class _Base(TestCase):
    def setUp(self) -> None:
        self.project = Project.objects.create(title="Koncert Adwentowy")
        self.composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=self.composer)
        self.item = ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        self.package = ScorePackageService.get_or_create(self.project)
        self.package.include_page_numbers = False  # the folio overlay needs real WeasyPrint
        self.package.include_cards = False
        self.package.save()

    def _add_edition(self, *, pages: int = 4, piece: Piece | None = None,
                     is_default: bool = True, sha: str = "a" * 64) -> ScoreEdition:
        edition = ScoreEdition.objects.create(
            piece=piece or self.piece, original_filename="score.pdf",
            page_count=pages, is_default=is_default, sha256=sha,
        )
        edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(pages)), save=True)
        return edition

    def _mark(self, edition: ScoreEdition, *, page: int = 1,
              layer: str = SHARED_ANNOTATION_LAYER,
              atype: str = AnnotationType.FREEHAND,
              payload: dict | None = None,
              color: str = "#DC2626") -> Annotation:
        return Annotation.objects.create(
            edition=edition, page_number=page, annotation_type=atype,
            payload=payload or {"paths": [[[0.2, 0.3], [0.4, 0.35], [0.6, 0.3]]], "width": 0.004},
            color=color, layer_name=layer,
        )

    def _build_capturing(self) -> tuple[BuildResult, list[str]]:
        """Assemble with both renderers stubbed to one blank A4 page each,
        returning the markup the markings overlay asked to render. Both stubs are
        installed in ONE place: a test that patches the overlay renderer and then
        calls a helper that patches it again asserts on a mock nothing ever
        reaches, and would pass with the feature switched off."""
        from roster.infrastructure import score_package_builder as builder

        captured: list[str] = []

        def _capture(html: str) -> bytes:
            captured.append(html)
            # One sheet per overlay page, as the real renderer produces — the
            # merge refuses a count that does not match the plan.
            return _pdf_bytes(max(1, html.count('class="pg"')))

        with (
            mock.patch.object(builder, "_render_pdf", side_effect=lambda html: _pdf_bytes(1)),
            mock.patch.object(score_markings, "_render_pdf", side_effect=_capture),
        ):
            return builder.build_score_package(self.project, self.package), captured

    def _build(self):
        return self._build_capturing()[0]


# ---------------------------------------------------------------------------
# Stage 2 — the page map
# ---------------------------------------------------------------------------

class PageMapTests(_Base):
    def test_every_page_is_described_in_order(self) -> None:
        self._add_edition(pages=3)
        result = self._build()
        self.assertEqual(len(result.page_map), result.page_count)
        self.assertEqual(
            [row["phys"] for row in result.page_map],
            list(range(result.page_count)),
        )
        # front matter stub (1) then the three bound pages.
        self.assertEqual(result.page_map[0]["kind"], KIND_FRONT)
        self.assertEqual(
            [row["kind"] for row in result.page_map[1:]],
            [KIND_MUSIC] * 3,
        )

    def test_music_rows_carry_the_trimmed_source_pages(self) -> None:
        edition = self._add_edition(pages=6)
        self.item.pdf_page_start = 3
        self.item.pdf_page_end = 5
        self.item.save()
        rows = music_pages(self._build().page_map)
        # 1-based source pages, exactly the requested window.
        self.assertEqual([row["src_page"] for row in rows], [3, 4, 5])
        self.assertEqual({row["edition"] for row in rows}, {str(edition.pk)})
        self.assertEqual([row["item"] for row in rows], [str(self.item.pk)] * 3)

    def test_placed_box_is_inside_the_sheet_and_locates_a_point(self) -> None:
        self._add_edition(pages=1)
        row = music_pages(self._build().page_map)[0]
        box = row["box"]
        assert box is not None  # music_pages only yields rows that carry one
        x, y, width, height = box
        self.assertGreater(width, 0)
        self.assertGreater(height, 0)
        self.assertGreaterEqual(x, 0)
        self.assertLessEqual(x + width, A4_WIDTH_PT + 0.01)
        self.assertLessEqual(y + height, A4_HEIGHT_PT + 0.01)
        # The centre of the source page maps to the centre of its placed box,
        # measured from the sheet's top — which is the frame the overlay draws in.
        cx, cy = normalized_to_sheet((x, y, width, height), 0.5, 0.5)
        self.assertAlmostEqual(cx, x + width / 2, places=3)
        self.assertAlmostEqual(cy, A4_HEIGHT_PT - y - height / 2, places=3)

    def test_cards_are_mapped_but_carry_no_source_geometry(self) -> None:
        self.package.include_cards = True
        self.package.save()
        self._add_edition(pages=1)
        rows = self._build().page_map
        cards = [row for row in rows if row["kind"] == KIND_CARD]
        self.assertEqual(len(cards), 1)
        self.assertIsNone(cards[0].get("box"))
        self.assertEqual(cards[0]["item"], str(self.item.pk))
        # And a card is not something a marking can land on.
        self.assertEqual(len(music_pages(rows)), 1)

    def test_build_stores_the_map_and_replacement_clears_it(self) -> None:
        self._add_edition(pages=2)
        result = self._build()
        with mock.patch(
            "roster.score_package_service.build_score_package", return_value=result
        ):
            ScorePackageService.run_build(str(self.package.pk))
        self.package.refresh_from_db()
        self.assertEqual(len(self.package.page_map), result.page_count)

        # A hand-uploaded book has different geometry; keeping the old map would
        # let marks be drawn onto it at positions measured from another file.
        ScorePackageService.mark_manual_upload(self.project)
        self.package.refresh_from_db()
        self.assertEqual(self.package.page_map, [])

    def test_clearing_the_score_clears_the_map(self) -> None:
        self._add_edition(pages=2)
        self.package.page_map = [{"phys": 0, "kind": KIND_FRONT}]
        self.package.save()
        ScorePackageService.mark_score_cleared(self.project)
        self.package.refresh_from_db()
        self.assertEqual(self.package.page_map, [])


class MusicPageFilterTests(SimpleTestCase):
    """The map is JSON that may outlive the code that wrote it."""

    def test_malformed_rows_are_skipped_not_trusted(self) -> None:
        rows = music_pages([
            {"phys": 0, "kind": KIND_FRONT},
            {"phys": 1, "kind": KIND_MUSIC},                      # no box
            {"phys": 2, "kind": KIND_MUSIC, "box": [1, 2, 3]},    # short box
            {"phys": 3, "kind": KIND_MUSIC, "box": [1, 2, 3, 4], "src_page": 1},  # no edition
            {"phys": 4, "kind": KIND_MUSIC, "box": [1, 2, 3, 4],
             "edition": "e", "src_page": 2},
            "nonsense",
        ])
        self.assertEqual([row["phys"] for row in rows], [4])


# ---------------------------------------------------------------------------
# Stage 3 — placing the marks
# ---------------------------------------------------------------------------

class PlanMarkingsTests(SimpleTestCase):

    def _map(self) -> list[dict]:
        return [
            {"phys": 0, "kind": KIND_FRONT},
            {"phys": 1, "kind": KIND_MUSIC, "edition": "E1", "src_page": 1, "box": list(_BOX)},
            {"phys": 2, "kind": KIND_MUSIC, "edition": "E1", "src_page": 2, "box": list(_BOX)},
        ]

    def _mark(self) -> PrintMark:
        return PrintMark(annotation_type="FH", payload={"paths": [[[0.1, 0.1]]]},
                         color="#DC2626", heavy=True)

    def test_mark_lands_on_the_page_holding_its_source(self) -> None:
        planned = plan_markings(self._map(), {("E1", 2): [self._mark()]})
        self.assertEqual([phys for phys, _ in planned], [2])

    def test_marks_on_unbound_pages_have_nowhere_to_go(self) -> None:
        # Page 7 of the edition was trimmed away, so there is no row for it.
        self.assertEqual(plan_markings(self._map(), {("E1", 7): [self._mark()]}), [])

    def test_same_source_page_bound_twice_gets_marked_twice(self) -> None:
        page_map = self._map()
        page_map.append(
            {"phys": 3, "kind": KIND_MUSIC, "edition": "E1", "src_page": 1, "box": list(_BOX)}
        )
        planned = plan_markings(page_map, {("E1", 1): [self._mark()]})
        self.assertEqual([phys for phys, _ in planned], [1, 3])

    def test_nothing_to_draw_is_not_a_render(self) -> None:
        self.assertEqual(plan_markings(self._map(), {}), [])
        original = b"%PDF-1.7 untouched"
        self.assertIs(apply_markings(original, self._map(), {}), original)


class InkParsingTests(SimpleTestCase):
    def test_alpha_is_split_out_rather_than_passed_through(self) -> None:
        self.assertEqual(score_markings._ink("#DC2626"), ("#DC2626", 1.0))
        colour, alpha = score_markings._ink("#DC262680")
        self.assertEqual(colour, "#DC2626")
        self.assertAlmostEqual(alpha, 0.502, places=2)

    def test_junk_falls_back_to_readable_ink(self) -> None:
        for junk in ("", "red", "#ZZZ", "#12345"):
            colour, alpha = score_markings._ink(junk)
            self.assertEqual(colour, "#1F2933")
            self.assertEqual(alpha, 1.0)


class PrintTranslationTests(SimpleTestCase):
    """What the page gets is not a copy of what the screen shows."""

    def _page(self, mark: PrintMark) -> str:
        return score_markings._render_page([(mark, _BOX)])

    def test_highlighter_prints_as_an_underline_never_a_filled_band(self) -> None:
        import re

        band_fraction = 0.021
        band_pt = band_fraction * _BOX[2]
        markup = self._page(PrintMark(
            annotation_type="HL",
            payload={"paths": [[[0.2, 0.5], [0.6, 0.5]]], "width": band_fraction},
            color="#B45309", heavy=True,
        ))
        self.assertIn('fill="none"', markup)

        # The printed stroke is a hairline, not the band the screen fills.
        stroke = re.search(r'stroke-width="([0-9.]+)"', markup)
        assert stroke is not None
        self.assertLess(float(stroke.group(1)), band_pt / 4)

        # And it runs BELOW the swept line, so the notes stay readable through it.
        swept_x, swept_y = normalized_to_sheet(_BOX, 0.2, 0.5)
        start = re.search(r"M ([0-9.]+) ([0-9.]+)", markup)
        assert start is not None
        self.assertAlmostEqual(float(start.group(1)), swept_x, places=1)
        # y grows downward in this frame, so "lower on the page" is a larger y.
        self.assertAlmostEqual(float(start.group(2)), swept_y + band_pt / 2, places=1)

    def test_conductors_ink_prints_heavier_than_a_personal_pencil(self) -> None:
        payload = {"paths": [[[0.2, 0.5], [0.6, 0.5]]], "width": 0.004}
        heavy = self._page(PrintMark("FH", payload, "#DC2626", True))
        light = self._page(PrintMark("FH", payload, "#DC2626", False))
        self.assertNotEqual(heavy, light)
        self.assertIn(f'stroke-width="{0.004 * _BOX[2] * 1.4:.2f}"', heavy)
        self.assertIn(f'stroke-width="{0.004 * _BOX[2]:.2f}"', light)

    def test_a_pinned_note_prints_its_text(self) -> None:
        markup = self._page(PrintMark(
            "CM", {"x": 0.5, "y": 0.5, "text": "Ciszej!", "display": "pin"}, "#1F2933", True,
        ))
        # Paper has no tap target — a pin that printed only a dot would say nothing.
        self.assertIn("Ciszej!", markup)

    def test_a_boxed_note_prints_framed_in_its_own_ink(self) -> None:
        markup = self._page(PrintMark(
            "CM", {"x": 0.5, "y": 0.1, "text": "B", "display": "box"}, "#2563EB", False,
        ))
        self.assertIn('class="note box"', markup)
        self.assertIn("border-color:#2563EB", markup)

    def test_text_is_escaped(self) -> None:
        markup = self._page(PrintMark(
            "CM", {"x": 0.5, "y": 0.5, "text": "<b>forte</b>", "display": "inline"},
            "#1F2933", False,
        ))
        self.assertIn("&lt;b&gt;forte&lt;/b&gt;", markup)
        self.assertNotIn("<b>forte</b>", markup)

    def test_known_stamp_draws_and_unknown_draws_nothing(self) -> None:
        known = self._page(PrintMark("ST", {"x": 0.5, "y": 0.5, "symbol": "fermata"},
                                     "#1F2933", True))
        self.assertIn("<circle", known)  # the fermata's eye
        unknown = self._page(PrintMark("ST", {"x": 0.5, "y": 0.5, "symbol": "nope"},
                                       "#1F2933", True))
        self.assertNotIn("<path", unknown)
        self.assertNotIn("<circle", unknown)

    def test_dynamics_print_as_text(self) -> None:
        markup = self._page(PrintMark("ST", {"x": 0.5, "y": 0.5, "symbol": "mf"},
                                      "#1F2933", True))
        self.assertIn(">mf<", markup)

    def test_a_bold_sweep_still_prints_a_hairline(self) -> None:
        import re

        # The band's width says how much was swept, not how loud the marking is.
        # Uncapped, the boldest highlighter printed a bar heavier than the staff
        # lines it was meant to sit under.
        markup = self._page(PrintMark(
            annotation_type="HL",
            payload={"paths": [[[0.2, 0.5], [0.6, 0.5]]], "width": 0.032},
            color="#B45309", heavy=True,
        ))
        stroke = re.search(r'stroke-width="([0-9.]+)"', markup)
        assert stroke is not None
        self.assertAlmostEqual(
            float(stroke.group(1)),
            score_markings._MAX_UNDERLINE_PT * score_markings._HEAVY_FACTOR,
            places=2,
        )

    def test_a_chip_is_centred_on_the_point_it_was_dropped_on(self) -> None:
        import re

        # The editor anchors a note by its CENTRE. A chip that printed from its
        # top-left — or that inherited a strut from the box holding it — would
        # sit a couple of millimetres low, which on a stave is the difference
        # between "between the systems" and "across the notes".
        text = "Ciszej!"
        markup = self._page(PrintMark(
            "CM", {"x": 0.42, "y": 0.31, "text": text, "display": "inline"},
            "#1F2933", False,
        ))
        left = float(re.search(r"left:(-?[0-9.]+)pt", markup).group(1))  # type: ignore[union-attr]
        top = float(re.search(r"top:(-?[0-9.]+)pt", markup).group(1))  # type: ignore[union-attr]
        size = float(re.search(r"font-size:([0-9.]+)pt", markup).group(1))  # type: ignore[union-attr]
        x, y = normalized_to_sheet(_BOX, 0.42, 0.31)
        self.assertAlmostEqual(left + score_markings._ANCHOR_WIDTH_PT / 2, x, places=1)
        self.assertAlmostEqual(
            top + score_markings._note_chip_height(text, size) / 2, y, places=1
        )
        # The height is arithmetic, so nothing may depend on a negative margin.
        self.assertNotIn("margin-top", markup)

    def test_the_anchor_box_carries_no_font_of_its_own(self) -> None:
        # `_anchor_html` subtracts half the chip's height and nothing else, which
        # is only true while the box's own line box is empty.
        html = score_markings._overlay_html([[(
            PrintMark("CM", {"x": 0.5, "y": 0.5, "text": "x", "display": "pin"},
                      "#1F2933", False),
            _BOX,
        )]])
        self.assertIn("font-size: 0", html)
        self.assertIn("line-height: 0", html)


class BuiltBookCarriesNoMarksTests(_Base):
    """The reader in the app draws every layer live over the stored book, so ink
    in the file would be drawn twice there. Marks reach paper only through a
    copy composed at download."""

    def test_the_built_book_carries_no_marks_with_markings_on(self) -> None:
        edition = self._add_edition(pages=3)
        for layer in (
            SHARED_ANNOTATION_LAYER, CONDUCTOR_ANNOTATION_LAYER,
            LEADER_ANNOTATION_LAYER, PERSONAL_ANNOTATION_LAYER,
        ):
            self._mark(edition, page=2, layer=layer)
        self.package.include_markings = True
        self.package.save()

        result, captured = self._build_capturing()

        self.assertEqual(captured, [])
        self.assertEqual(result.page_count, 1 + 3)
        # The map is still recorded: it is what a served copy composes against.
        self.assertTrue(music_pages(result.page_map))


class OverlayRegistrationTests(SimpleTestCase):
    """The overlay is matched to the book by ORDER alone, so a sheet count that
    does not match the plan means every mark after the discrepancy would land on
    the wrong page."""

    def _plan(self, pages: int) -> list:
        mark = PrintMark("FH", {"paths": [[[0.1, 0.1], [0.2, 0.2]]]}, "#DC2626", True)
        return [(phys, [(mark, _BOX)]) for phys in range(pages)]

    def _writer(self, pages: int) -> PdfWriter:
        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
        return writer

    def test_a_short_render_draws_nothing_rather_than_shifted_ink(self) -> None:
        with mock.patch.object(
            score_markings, "render_overlay_pages",
            return_value=_blank_sheets(2),
        ):
            merged = score_markings.merge_overlay(self._writer(3), self._plan(3))
        self.assertEqual(merged, 0)

    def test_a_matching_render_lands_on_every_planned_page(self) -> None:
        with mock.patch.object(
            score_markings, "render_overlay_pages",
            return_value=_blank_sheets(3),
        ):
            merged = score_markings.merge_overlay(self._writer(3), self._plan(3))
        self.assertEqual(merged, 3)


class AnnotationGroupingTests(_Base):
    def test_grouping_keys_on_edition_and_page(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1)
        self._mark(edition, page=1, layer=PERSONAL_ANNOTATION_LAYER)
        self._mark(edition, page=2)
        grouped = marks_from_annotations(Annotation.objects.all())
        self.assertEqual(len(grouped[(str(edition.pk), 1)]), 2)
        self.assertEqual(len(grouped[(str(edition.pk), 2)]), 1)

    def test_layer_decides_the_printed_weight(self) -> None:
        edition = self._add_edition(pages=1)
        self._mark(edition, layer=SHARED_ANNOTATION_LAYER)
        self._mark(edition, layer=PERSONAL_ANNOTATION_LAYER)
        marks = marks_from_annotations(Annotation.objects.all())[(str(edition.pk), 1)]
        self.assertEqual(sorted(m.heavy for m in marks), [False, True])

    def test_a_jump_link_never_reaches_paper(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1)
        self._mark(
            edition, page=2, atype=AnnotationType.LINK,
            payload={"x": 0.8, "y": 0.9, "target_page": 1, "target_y": 0.2},
        )
        grouped = marks_from_annotations(Annotation.objects.all())
        self.assertEqual(list(grouped), [(str(edition.pk), 1)])


# ---------------------------------------------------------------------------
# Stage 3 — the census (the cockpit's warnings) and staleness
# ---------------------------------------------------------------------------

class MarkingsCensusTests(_Base):
    def test_counts_split_by_where_the_marks_are(self) -> None:
        edition = self._add_edition(pages=8)
        self.item.pdf_page_start = 2
        self.item.pdf_page_end = 4
        self.item.save()
        self._mark(edition, page=3)              # inside
        self._mark(edition, page=3)              # inside
        self._mark(edition, page=7)              # trimmed away
        other = self._add_edition(pages=8, is_default=False, sha="b" * 64)
        self._mark(other, page=1)                # different edition of the piece

        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 2)
        self.assertEqual(census.outside, 1)
        self.assertEqual(census.elsewhere, 1)
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_PARTIAL)

    def test_personal_marks_are_never_counted(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1, layer=PERSONAL_ANNOTATION_LAYER)
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 0)
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_NONE)

    def test_leader_marks_are_never_printed_into_the_choirs_book(self) -> None:
        # The census counts what the choir's copies carry. A cue written for
        # whoever runs the rehearsal is addressed to one person; printing it into
        # forty copies would publish it to the choir by accident.
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1, layer=LEADER_ANNOTATION_LAYER)
        self._mark(edition, page=1, layer=CONDUCTOR_ANNOTATION_LAYER)
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 0)
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_NONE)

    def test_a_jump_link_is_not_a_mark_the_book_carries(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(
            edition, page=2, atype=AnnotationType.LINK,
            payload={"x": 0.8, "y": 0.9, "target_page": 1, "target_y": 0.2},
        )
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 0)
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_NONE)

    def test_pinning_an_unmarked_edition_raises_the_alarm(self) -> None:
        annotated = self._add_edition(pages=4, is_default=False, sha="c" * 64)
        clean = self._add_edition(pages=4, sha="d" * 64)
        self._mark(annotated, page=1)
        self.item.score_edition = clean
        self.item.save()
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 0)
        self.assertEqual(census.elsewhere, 1)
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_WRONG_EDITION)

    def test_status_is_silent_while_the_book_prints_no_markings(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1)
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(markings_status(census, enabled=False), MARKINGS_OFF)

    def test_all_marks_landing_is_ready(self) -> None:
        edition = self._add_edition(pages=2)
        self._mark(edition, page=1)
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(markings_status(census, enabled=True), MARKINGS_READY)

    def test_edition_without_a_page_count_still_binds_its_marks(self) -> None:
        # An unknown length must not be read as "binds nothing".
        edition = self._add_edition(pages=3)
        ScoreEdition.objects.filter(pk=edition.pk).update(page_count=None)
        edition.refresh_from_db()
        first, last = resolve_item_page_window(self.item, edition)
        self.assertEqual(first, 1)
        self.assertGreater(last, 100)
        self._mark(edition, page=2)
        census = compute_program_markings([self.item])[self.item.pk]
        self.assertEqual(census.inside, 1)


class MarkingsStalenessTests(_Base):
    def _hash(self) -> str:
        self.package.refresh_from_db()
        return ScorePackageService.compute_source_hash(self.project, self.package)

    def test_a_new_mark_never_ages_the_book(self) -> None:
        # The stored book carries no marks, so a rebuild would produce the same
        # bytes; a served copy picks the mark up on its own.
        edition = self._add_edition(pages=3)
        self.package.include_markings = True
        self.package.save()
        before = self._hash()
        self._mark(edition, page=1)
        self.assertEqual(before, self._hash())

    def test_the_toggle_does_not_age_the_book(self) -> None:
        # It decides what a served copy carries, not what the stored file is.
        self._add_edition(pages=3)
        before = self._hash()
        self.package.include_markings = True
        self.package.save()
        self.assertEqual(before, self._hash())

    def test_a_new_build_format_ages_every_book(self) -> None:
        self._add_edition(pages=3)
        before = self._hash()
        with mock.patch.object(
            score_package_service, "BUILD_FORMAT", score_package_service.BUILD_FORMAT + 1,
        ):
            self.assertNotEqual(before, self._hash())


class RebuildMarkedBooksCommandTests(_Base):
    """A book baked under the old builder is rebuilt in one sweep after the deploy."""

    def _book(self, title: str, **package_fields) -> ScorePackage:
        project = Project.objects.create(title=title)
        project.score_pdf.save("book.pdf", ContentFile(_pdf_bytes(1)), save=True)
        package = ScorePackageService.get_or_create(project)
        for field, value in {"include_markings": True, **package_fields}.items():
            setattr(package, field, value)
        package.save()
        return package

    def _run(self, *args: str) -> mock.MagicMock:
        with (
            mock.patch("roster.tasks.generate_score_package_task.delay") as delay,
            self.captureOnCommitCallbacks(execute=True),
        ):
            call_command("rebuild_marked_score_books", *args, stdout=StringIO())
        return delay

    def test_only_generated_books_with_markings_on_are_queued(self) -> None:
        marked = self._book("Nieszpory", status=ScorePackage.Status.READY)
        self._book("Ręcznie", status=ScorePackage.Status.READY, is_manual_upload=True)
        self._book("Bez znaków", status=ScorePackage.Status.READY, include_markings=False)
        self._book(
            "W toku", status=ScorePackage.Status.BUILDING, build_started_at=timezone.now(),
        )
        self.package.include_markings = True  # no file yet
        self.package.save()

        delay = self._run()

        delay.assert_called_once_with(str(marked.pk))
        marked.refresh_from_db()
        self.assertEqual(marked.status, ScorePackage.Status.QUEUED)

    def test_a_dry_run_queues_nothing(self) -> None:
        self._book("Nieszpory", status=ScorePackage.Status.READY)
        self._run("--dry-run").assert_not_called()


class CockpitReadModelTests(_Base):
    def test_state_exposes_the_toggle_and_the_per_item_verdict(self) -> None:
        edition = self._add_edition(pages=4)
        self.item.pdf_page_end = 2
        self.item.save()
        self._mark(edition, page=1)
        self._mark(edition, page=4)
        self.package.include_markings = True
        self.package.save()

        state = ScorePackageService.compute_state(self.project)
        self.assertTrue(state["config"]["include_markings"])
        markings = state["items"][0]["markings"]
        self.assertEqual(markings["status"], MARKINGS_PARTIAL)
        self.assertEqual(markings["printed"], 1)
        self.assertEqual(markings["outside_range"], 1)

    def test_markings_never_taint_the_card_roll_up(self) -> None:
        edition = self._add_edition(pages=4)
        self._mark(edition, page=1)
        self.package.include_markings = True
        self.package.save()
        state = ScorePackageService.compute_state(self.project)
        item = state["items"][0]
        # The card's light describes the CARD; markings live beside it.
        self.assertNotIn("markings", item["readiness"]["elements"])

    def test_the_toggle_is_configurable_through_the_api_surface(self) -> None:
        state = ScorePackageService.update_config(self.project, {"include_markings": True})
        self.assertTrue(state["config"]["include_markings"])
        self.package.refresh_from_db()
        self.assertTrue(self.package.include_markings)


_StampDrawing = tuple[str, float, str, tuple[str, ...], tuple[tuple[float, ...], ...]]


def _first_group(pattern: str, text: str) -> str | None:
    import re

    match = re.search(pattern, text, re.S)
    return match.group(1) if match else None


def _tsx_stamp_drawings() -> dict[str, _StampDrawing]:
    """Each stamp the editor's catalogue defines, keyed by id, as
    (glyph, size fraction, view box, paths, dots) — what print draws from."""
    import re
    from pathlib import Path

    tsx = (
        Path(__file__).resolve().parents[2]
        / "frontend" / "src" / "features" / "annotations" / "lib" / "stamps.tsx"
    )
    source = tsx.read_text(encoding="utf-8")
    start = source.index("export const STAMPS")
    # Whole-line comments only: the caesura's glyph is itself "//".
    body = re.sub(r"^\s*//[^\n]*", "", source[start : source.index("\n];", start)], flags=re.M)
    body = body[body.index("= [") + 3 :]

    def factory_size(name: str) -> float:
        size = _first_group(rf"const {name} = .*?sizeFraction:\s*([\d.]+)", source)
        assert size is not None, f"no sizeFraction in the {name}() factory"
        return float(size)

    drawings: dict[str, _StampDrawing] = {}
    for mark in re.findall(r'\bdynamic\("([a-z_]+)"\)', body):
        drawings[mark] = (mark, factory_size("dynamic"), "", (), ())
    for stamp_id, glyph in re.findall(r'\bword\("([a-z_]+)",\s*"([^"]*)"', body):
        drawings[stamp_id] = (glyph, factory_size("word"), "", (), ())

    # The literal definitions: every top-level `{ … }` of the array.
    depth = 0
    opened = 0
    for index, char in enumerate(body):
        if char == "{":
            if depth == 0:
                opened = index
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                block = body[opened : index + 1]
                stamp_id = _first_group(r'\bid:\s*"([a-z_]+)"', block)
                size = _first_group(r"\bsizeFraction:\s*([\d.]+)", block)
                assert stamp_id is not None and size is not None, block
                paths = _first_group(r"\bpaths:\s*\[(.*?)\]", block) or ""
                dots = block[block.index("dots:") :] if "dots:" in block else ""
                drawings[stamp_id] = (
                    _first_group(r'\bglyph:\s*"([^"]*)"', block) or "",
                    float(size),
                    _first_group(r'\bviewBox:\s*"([^"]*)"', block) or "",
                    tuple(re.findall(r'"([^"]*)"', paths)),
                    tuple(
                        tuple(float(n) for n in triple)
                        for triple in re.findall(
                            r"\[\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\]", dots
                        )
                    ),
                )
    return drawings


class StampParityTests(SimpleTestCase):
    """A symbol the editor can place but the printer cannot draw prints NOTHING
    where the conductor expected a mark, and one the two draw differently prints
    as some other mark, so the two catalogues must not drift."""

    def test_python_and_tsx_catalogues_draw_the_same_stamps(self) -> None:
        from archive.annotation_stamps import STAMPS

        editor = _tsx_stamp_drawings()
        printer: dict[str, _StampDrawing] = {
            stamp.id: (stamp.glyph, stamp.size_fraction, stamp.view_box, stamp.paths, stamp.dots)
            for stamp in STAMPS
        }
        # The ids first, so a stamp missing on one side reads as that.
        self.assertEqual(set(editor), set(printer))
        self.assertEqual(editor, printer)

    def test_the_sanitizer_keeps_every_shape_the_editor_draws(self) -> None:
        # A shape name the server drops is a hairpin its card calls "a line".
        import re
        from pathlib import Path

        from archive.serializers import _INK_SHAPES

        tsx = (
            Path(__file__).resolve().parents[2]
            / "frontend" / "src" / "features" / "annotations" / "lib" / "shapes.ts"
        )
        kinds = set(re.findall(r'kind:\s*"([a-z_]+)"', tsx.read_text(encoding="utf-8")))
        self.assertEqual(kinds, set(_INK_SHAPES))
