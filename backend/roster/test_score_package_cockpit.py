"""
@file test_score_package_cockpit.py
@description Phase-3 build-cockpit coverage for the concert score-book generator:
    per-item card/edition resolution, the provenance-driven readiness engine,
    source-hash sensitivity to per-item overrides, the per-item update service, and
    the assembler's page-range trimming + placeholder behaviour. WeasyPrint's native
    renderer is absent on host CI, so the one assembly test stubs ``_render_pdf`` and
    binds real (blank) pypdf editions — every other test is pure ORM/domain logic.
@architecture Enterprise SaaS 2026
@module roster/test_score_package_cockpit
"""

from __future__ import annotations

import base64
import tempfile
import uuid
from io import BytesIO
from unittest import mock, skipUnless

from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings
from pypdf import PdfWriter

from archive.models import (
    Composer,
    Movement,
    Piece,
    ProgramNote,
    ProvenanceRecord,
    ProvenanceSource,
    ScoreEdition,
    Translation,
)
from roster.infrastructure.pdf_raster import (
    PdfRasterDependencyError,
    render_pdf_thumbnails,
)
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import (
    package_default_elements,
    resolve_card_config,
    resolve_item_edition,
    sanitize_card_elements,
    suggested_page_start,
)
from roster.score_package_layout import plan_body_layout
from roster.score_package_readiness import (
    LOW,
    MISSING,
    OVERALL_INCOMPLETE,
    OVERALL_LOW,
    OVERALL_NO_EDITION,
    OVERALL_READY,
    READY,
    compute_program_readiness,
)
from roster.score_package_service import ScorePackageItemError, ScorePackageService

_MEDIA = tempfile.mkdtemp(prefix="vm_score_pkg_test_")

try:  # The rasteriser ships self-contained wheels, but may be absent on a lean host.
    import pypdfium2 as _pdfium  # noqa: F401

    _HAS_PDFIUM = True
except Exception:  # pragma: no cover - environment-dependent
    _HAS_PDFIUM = False


def _pdf_bytes(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class _Base(TestCase):
    def setUp(self) -> None:
        self.project = Project.objects.create(title="Koncert Maryjny")
        self.composer = Composer.objects.create(
            first_name="Anton", last_name="Bruckner",
            birth_year="1824", death_year="1896",
        )
        self.piece = Piece.objects.create(
            title="Locus iste", composer=self.composer,
            voicing="SATB", language="Latin", estimated_duration=180,
            text_source="Graduale", lyrics_original="Locus iste a Deo factus est",
        )
        self.item = ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        self.package = ScorePackageService.get_or_create(self.project)

    def _add_edition(self, *, pages: int = 4, is_default: bool = True, sha: str = "a" * 64) -> ScoreEdition:
        edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="score.pdf",
            page_count=pages, is_default=is_default, sha256=sha,
        )
        edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(pages)), save=True)
        return edition


class CardConfigTests(_Base):
    def test_default_elements_follow_package_toggles(self) -> None:
        self.package.card_include_translation = False
        elements = package_default_elements(self.package)
        self.assertIn("text", elements)
        self.assertIn("eyebrow", elements)
        self.assertNotIn("translation", elements)

    def test_item_inherits_package_when_unset(self) -> None:
        config = resolve_card_config(self.item, self.package)
        self.assertTrue(config.enabled)
        self.assertEqual(config.elements, package_default_elements(self.package))

    def test_item_card_enabled_override(self) -> None:
        self.item.card_enabled = False
        config = resolve_card_config(self.item, self.package)
        self.assertFalse(config.enabled)
        self.assertFalse(config.shows("text"))

    def test_item_card_elements_override_wins(self) -> None:
        self.item.card_elements = ["text", "ipa", "bogus"]
        config = resolve_card_config(self.item, self.package)
        self.assertEqual(config.elements, frozenset({"text", "ipa"}))
        self.assertTrue(config.shows("ipa"))
        self.assertFalse(config.shows("translation"))

    def test_sanitize_card_elements(self) -> None:
        self.assertIsNone(sanitize_card_elements(None))
        self.assertIsNone(sanitize_card_elements("nope"))
        # Canonical order is enforced regardless of input order.
        self.assertEqual(sanitize_card_elements(["ipa", "text", "x"]), ["text", "ipa"])


class EditionResolutionTests(_Base):
    def test_auto_selects_default(self) -> None:
        self._add_edition(is_default=False, sha="b" * 64)
        default = self._add_edition(is_default=True, sha="c" * 64)
        self.assertEqual(resolve_item_edition(self.item), default)

    def test_explicit_pin_wins(self) -> None:
        self._add_edition(is_default=True, sha="d" * 64)
        pinned = self._add_edition(is_default=False, sha="e" * 64)
        self.item.score_edition = pinned
        self.assertEqual(resolve_item_edition(self.item), pinned)

    def test_soft_deleted_pin_falls_back(self) -> None:
        default = self._add_edition(is_default=True, sha="f" * 64)
        stale = self._add_edition(is_default=False, sha="0" * 64)
        self.item.score_edition = stale
        stale.delete()  # soft delete
        self.assertEqual(resolve_item_edition(self.item), default)

    def test_no_edition_is_none(self) -> None:
        self.assertIsNone(resolve_item_edition(self.item))

    def test_suggested_start_from_movements(self) -> None:
        Movement.objects.create(piece=self.piece, order_index=0, title="I", starts_on_page=3)
        Movement.objects.create(piece=self.piece, order_index=1, title="II", starts_on_page=8)
        self.assertEqual(suggested_page_start(self.piece), 3)

    def test_no_suggestion_when_music_starts_on_page_one(self) -> None:
        Movement.objects.create(piece=self.piece, order_index=0, title="I", starts_on_page=1)
        self.assertIsNone(suggested_page_start(self.piece))


class ReadinessTests(_Base):
    def _items(self) -> list[ProgramItem]:
        return list(ScorePackageService._ordered_items(self.project))

    def _provenance(self, target, field: str, confidence: float) -> None:
        ProvenanceRecord.objects.create(
            content_type=ContentType.objects.get_for_model(type(target)),
            object_id=target.pk,
            field_name=field,
            source=ProvenanceSource.AI_SONNET,
            confidence=confidence,
        )

    def test_present_high_confidence_is_ready(self) -> None:
        self._add_edition()
        self._provenance(self.piece, "lyrics_original", 0.9)
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["text"], READY)

    def test_low_confidence_flags_low(self) -> None:
        self._add_edition()
        self._provenance(self.piece, "lyrics_original", 0.3)
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["text"], LOW)
        self.assertEqual(readiness[self.item.pk]["overall"], OVERALL_LOW)

    def test_missing_translation_is_missing(self) -> None:
        self._add_edition()
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["translation"], MISSING)

    def test_override_text_is_trusted(self) -> None:
        self._add_edition()
        self._provenance(self.piece, "lyrics_original", 0.1)  # would be LOW...
        self.item.text_override = "Ręczny tekst"
        self.item.save()
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["text"], READY)

    def test_unapproved_note_is_low_approved_is_ready(self) -> None:
        self._add_edition()
        note = ProgramNote.objects.create(
            piece=self.piece, project=self.project, language="pl",
            content="Krótka nota.", is_approved=False,
        )
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["note"], LOW)
        note.is_approved = True
        note.save()
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["elements"]["note"], READY)

    def test_no_edition_dominates_rollup(self) -> None:
        Translation.objects.create(piece=self.piece, target_language="pl", text="To miejsce")
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["overall"], OVERALL_NO_EDITION)

    def test_incomplete_when_only_missing(self) -> None:
        self._add_edition()
        # Provide everything enabled except translation/note (which stay missing).
        self._provenance(self.piece, "lyrics_original", 0.9)
        self._provenance(self.piece, "text_source", 0.9)
        self._provenance(self.piece, "voicing", 0.9)
        # Disable translation+note so only present/ready elements remain enabled.
        self.package.card_include_translation = False
        self.package.card_include_program_note = False
        self.package.save()
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["overall"], OVERALL_READY)

    def test_incomplete_rollup_when_enabled_element_missing(self) -> None:
        self._add_edition()
        self._provenance(self.piece, "lyrics_original", 0.9)
        # translation enabled by default but absent -> incomplete (no lows).
        readiness = compute_program_readiness(self.project, self._items(), self.package)
        self.assertEqual(readiness[self.item.pk]["overall"], OVERALL_INCOMPLETE)


class StateAndHashTests(_Base):
    def test_compute_state_item_shape(self) -> None:
        edition = self._add_edition()
        state = ScorePackageService.compute_state(self.project)
        self.assertEqual(state["total_pieces"], 1)
        self.assertEqual(state["bindable_pieces"], 1)
        self.assertIn("card_elements", state)
        row = state["items"][0]
        self.assertEqual(row["selected_edition_id"], str(edition.pk))
        self.assertTrue(row["has_pdf"])
        self.assertEqual(row["edition_page_count"], 4)
        self.assertEqual(len(row["editions"]), 1)
        self.assertEqual(
            set(row["card_elements_effective"]),
            set(package_default_elements(self.package)),
        )

    def test_hash_changes_on_page_range(self) -> None:
        self._add_edition()
        before = ScorePackageService.compute_source_hash(self.project, self.package)
        self.item.pdf_page_start = 3
        self.item.save()
        after = ScorePackageService.compute_source_hash(self.project, self.package)
        self.assertNotEqual(before, after)

    def test_hash_changes_on_edition_pin(self) -> None:
        self._add_edition(is_default=True, sha="1" * 64)
        other = self._add_edition(is_default=False, sha="2" * 64)
        before = ScorePackageService.compute_source_hash(self.project, self.package)
        self.item.score_edition = other
        self.item.save()
        after = ScorePackageService.compute_source_hash(self.project, self.package)
        self.assertNotEqual(before, after)

    def test_hash_changes_on_card_override(self) -> None:
        self._add_edition()
        before = ScorePackageService.compute_source_hash(self.project, self.package)
        self.item.card_elements = ["text"]
        self.item.save()
        after = ScorePackageService.compute_source_hash(self.project, self.package)
        self.assertNotEqual(before, after)

    def test_hash_changes_on_duplex_toggle(self) -> None:
        self._add_edition()
        before = ScorePackageService.compute_source_hash(self.project, self.package)
        self.package.duplex_mode = True
        self.package.save()
        after = ScorePackageService.compute_source_hash(self.project, self.package)
        self.assertNotEqual(before, after)


class UpdateConfigTests(_Base):
    def test_update_config_persists_without_build(self) -> None:
        self._add_edition()
        state = ScorePackageService.update_config(
            self.project, {"density_mode": "MASS", "include_toc": False, "translation_language": "en"},
        )
        self.package.refresh_from_db()
        self.assertEqual(self.package.density_mode, "MASS")
        self.assertFalse(self.package.include_toc)
        self.assertEqual(self.package.translation_language, "en")
        # No build queued — status stays IDLE.
        self.assertEqual(state["status"], "IDLE")
        self.assertEqual(state["config"]["density_mode"], "MASS")

    def test_update_config_ignores_unknown_keys(self) -> None:
        ScorePackageService.update_config(self.project, {"bogus": True, "include_cards": False})
        self.package.refresh_from_db()
        self.assertFalse(self.package.include_cards)
        self.assertFalse(hasattr(self.package, "bogus"))


class UpdateItemTests(_Base):
    def test_pin_edition(self) -> None:
        edition = self._add_edition()
        state = ScorePackageService.update_item(
            self.project, str(self.item.pk), {"score_edition_id": str(edition.pk)}
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.score_edition_id, edition.pk)
        self.assertEqual(state["items"][0]["explicit_edition_id"], str(edition.pk))

    def test_pin_foreign_edition_rejected(self) -> None:
        other_piece = Piece.objects.create(title="Inny utwór")
        foreign = ScoreEdition.objects.create(
            piece=other_piece, original_filename="x.pdf", page_count=2, sha256="9" * 64,
        )
        foreign.pdf_file.save("x.pdf", ContentFile(_pdf_bytes(2)), save=True)
        with self.assertRaises(ScorePackageItemError):
            ScorePackageService.update_item(
                self.project, str(self.item.pk), {"score_edition_id": str(foreign.pk)}
            )

    def test_invalid_page_range_rejected(self) -> None:
        self._add_edition()
        with self.assertRaises(ScorePackageItemError):
            ScorePackageService.update_item(
                self.project, str(self.item.pk),
                {"pdf_page_start": 5, "pdf_page_end": 2},
            )

    def test_clear_and_set_overrides(self) -> None:
        ScorePackageService.update_item(
            self.project, str(self.item.pk),
            {"section_label": "Liturgia", "card_elements": ["text", "note"], "card_enabled": False},
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.section_label, "Liturgia")
        self.assertEqual(self.item.card_elements, ["text", "note"])
        self.assertFalse(self.item.card_enabled)


@override_settings(MEDIA_ROOT=_MEDIA)
class AssemblyTests(_Base):
    """Assembly path with WeasyPrint stubbed; pypdf binding/trim/placeholder is real."""

    def _build(self):
        from roster.infrastructure import score_package_builder as builder

        self.package.include_page_numbers = False  # overlay needs real WeasyPrint paging
        self.package.include_cards = False
        self.package.save()
        with mock.patch.object(builder, "_render_pdf", side_effect=lambda html: _pdf_bytes(1)):
            return builder.build_score_package(self.project, self.package)

    def test_page_range_trims_bound_pages(self) -> None:
        self._add_edition(pages=6)
        self.item.pdf_page_start = 3
        self.item.pdf_page_end = 5
        self.item.save()
        result = self._build()
        # front matter (title+toc => 1 stub page) + 3 trimmed body pages.
        self.assertEqual(result.bound_pieces, 1)
        self.assertEqual(result.page_count, 1 + 3)
        self.assertEqual(result.skipped_titles, [])

    def test_placeholder_for_missing_pdf(self) -> None:
        bound = Piece.objects.create(title="Z nutami")
        ProgramItem.objects.create(project=self.project, piece=bound, order=2)
        edition = ScoreEdition.objects.create(
            piece=bound, original_filename="b.pdf", page_count=2, is_default=True, sha256="7" * 64,
        )
        edition.pdf_file.save("b.pdf", ContentFile(_pdf_bytes(2)), save=True)
        # self.item (order=1) has no edition -> placeholder page.
        result = self._build()
        self.assertEqual(result.bound_pieces, 1)
        self.assertEqual(result.skipped_titles, [self.piece.title])
        # front(1) + placeholder(1) + bound music(2) = 4
        self.assertEqual(result.page_count, 1 + 1 + 2)

    def test_raises_when_nothing_bindable(self) -> None:
        from roster.infrastructure.score_package_builder import ScorePackageBuildError

        with self.assertRaises(ScorePackageBuildError):
            self._build()


class LayoutPlannerTests(SimpleTestCase):
    """Pure pagination planner: folios, recto/verso parity, recto-start spacers."""

    def test_simplex_has_no_spacers(self) -> None:
        layout = plan_body_layout([3, 2], recto_start=False)
        self.assertEqual(layout.physical_count, 5)
        self.assertEqual(layout.content_count, 5)
        self.assertTrue(all(p.kind == "content" for p in layout.pages))
        self.assertEqual([p.folio for p in layout.pages], [1, 2, 3, 4, 5])
        self.assertFalse(any(pl.leading_blank for pl in layout.placements))
        # phys_start mirrors folio_start-1 when nothing is inserted.
        self.assertEqual([pl.phys_start for pl in layout.placements], [0, 3])
        self.assertEqual([pl.folio_start for pl in layout.placements], [1, 4])

    def test_body_side_follows_position(self) -> None:
        # Body opens on a recto; the side then alternates by 0-based position.
        layout = plan_body_layout([4], recto_start=True)
        self.assertEqual([p.is_recto for p in layout.pages], [True, False, True, False])

    def test_recto_start_inserts_blank_verso(self) -> None:
        # First item is 3 pages long (ends on a verso), so the second must be pushed
        # onto the next recto with a blank verso in between.
        layout = plan_body_layout([3, 3], recto_start=True)
        kinds = [(p.kind, p.folio, p.is_recto) for p in layout.pages]
        self.assertEqual(
            kinds,
            [
                ("content", 1, True),
                ("content", 2, False),
                ("content", 3, True),
                ("spacer", None, False),   # inserted blank verso
                ("content", 4, True),
                ("content", 5, False),
                ("content", 6, True),
            ],
        )
        self.assertEqual(layout.content_count, 6)
        self.assertEqual(layout.physical_count, 7)
        second = layout.placements[1]
        self.assertTrue(second.leading_blank)
        self.assertEqual(second.folio_start, 4)   # numbering skips the blank
        self.assertEqual(second.phys_start, 4)     # physical offset counts it

    def test_recto_start_skips_blank_when_already_recto(self) -> None:
        # An even-length first item leaves the next one already on a recto.
        layout = plan_body_layout([2, 2], recto_start=True)
        self.assertFalse(any(pl.leading_blank for pl in layout.placements))
        self.assertEqual(layout.physical_count, 4)

    def test_first_item_never_gets_a_spacer(self) -> None:
        layout = plan_body_layout([1, 1, 1], recto_start=True)
        self.assertFalse(layout.placements[0].leading_blank)

    def test_every_item_opens_on_a_recto_under_recto_start(self) -> None:
        layout = plan_body_layout([1, 4, 3, 2, 5], recto_start=True)
        for placement in layout.placements:
            self.assertEqual(placement.phys_start % 2, 0)  # 0-based even == recto

    def test_folios_are_spacer_independent(self) -> None:
        # The printed numbering is identical with or without recto-start, since
        # spacers never consume a folio.
        counts = [3, 1, 4, 2]
        simplex = plan_body_layout(counts, recto_start=False)
        duplex = plan_body_layout(counts, recto_start=True)
        self.assertEqual(
            [pl.folio_start for pl in simplex.placements],
            [pl.folio_start for pl in duplex.placements],
        )


@override_settings(MEDIA_ROOT=_MEDIA)
class DuplexAssemblyTests(_Base):
    """Assembly with duplex on: front pad + recto-start spacers land as real pages.
    Page numbering is left off (its overlay needs the real WeasyPrint paginator);
    the numbering *placement* is proven by LayoutPlannerTests instead."""

    def _second_piece(self, *, pages: int) -> None:
        piece = Piece.objects.create(title="Ave verum")
        ProgramItem.objects.create(project=self.project, piece=piece, order=2)
        edition = ScoreEdition.objects.create(
            piece=piece, original_filename="ave.pdf", page_count=pages,
            is_default=True, sha256="9" * 64,
        )
        edition.pdf_file.save("ave.pdf", ContentFile(_pdf_bytes(pages)), save=True)

    def _build(self, *, duplex: bool):
        from roster.infrastructure import score_package_builder as builder

        self.package.include_page_numbers = False
        self.package.include_cards = True
        self.package.density_mode = ScorePackage.Density.CONCERT
        self.package.duplex_mode = duplex
        self.package.save()
        with mock.patch.object(builder, "_render_pdf", side_effect=lambda html: _pdf_bytes(1)):
            return builder.build_score_package(self.project, self.package)

    def test_duplex_adds_front_pad_and_recto_start_blank(self) -> None:
        # Two 2-page pieces, each with a 1-page frontispiece → item bodies of 3
        # pages. front matter stub = 1 page (odd → +1 pad); piece 2 ends on a verso
        # after piece 1's odd length → +1 recto-start blank.
        self._add_edition(pages=2)
        self._second_piece(pages=2)

        simplex = self._build(duplex=False)
        # front(1) + [card(1)+music(2)] + [card(1)+music(2)] = 7
        self.assertEqual(simplex.page_count, 7)
        self.assertEqual(simplex.bound_pieces, 2)

        duplex = self._build(duplex=True)
        # front(1) + pad(1) + piece1(3) + blank(1) + piece2(3) = 9
        self.assertEqual(duplex.page_count, 9)
        self.assertEqual(duplex.bound_pieces, 2)
        self.assertEqual(duplex.skipped_titles, [])


@override_settings(MEDIA_ROOT=_MEDIA)
class DistributionTests(_Base):
    """Build-version stamping + the 'already in singers' folders' distribution trail."""

    def test_mark_distributed_is_idempotent(self) -> None:
        self.assertIsNone(self.package.distributed_at)
        ScorePackageService.mark_distributed(self.project)
        self.package.refresh_from_db()
        first = self.package.distributed_at
        self.assertIsNotNone(first)
        # A second download must not move the "first distributed" timestamp.
        ScorePackageService.mark_distributed(self.project)
        self.package.refresh_from_db()
        self.assertEqual(self.package.distributed_at, first)

    def test_compute_state_exposes_distribution(self) -> None:
        self._add_edition()
        state = ScorePackageService.compute_state(self.project)
        self.assertEqual(state["build_version"], 0)
        self.assertIsNone(state["distributed_at"])
        self.assertFalse(state["is_distributed"])

    def test_is_distributed_requires_a_pdf(self) -> None:
        # A stray distributed_at without a stored book is not "out there".
        ScorePackageService.mark_distributed(self.project)
        state = ScorePackageService.compute_state(self.project)
        self.assertFalse(state["is_distributed"])

    def test_build_bumps_version_and_resets_distribution(self) -> None:
        from roster.infrastructure import score_package_builder as builder

        self._add_edition(pages=3)
        self.package.include_page_numbers = False  # overlay needs real WeasyPrint paging
        self.package.include_cards = False
        self.package.save()
        # Pretend the previous version had already reached the singers.
        ScorePackageService.mark_distributed(self.project)

        with mock.patch.object(builder, "_render_pdf", side_effect=lambda html: _pdf_bytes(1)):
            ScorePackageService.run_build(str(self.package.pk))

        self.package.refresh_from_db()
        self.assertEqual(self.package.build_version, 1)
        self.assertIsNone(self.package.distributed_at)  # new version, not yet distributed
        self.assertEqual(self.package.status, "RDY")
        self.project.refresh_from_db()
        self.assertTrue(bool(self.project.score_pdf))

        # The fresh build reads as undistributed in the cockpit until re-downloaded.
        state = ScorePackageService.compute_state(self.project)
        self.assertEqual(state["build_version"], 1)
        self.assertFalse(state["is_distributed"])
        self.assertFalse(state["is_manual_upload"])  # a generated build is not manual


@override_settings(MEDIA_ROOT=_MEDIA)
class ManualUploadCoordinationTests(_Base):
    """The hand-upload path and the generator share `project.score_pdf`; these pin
    that the read model stays coherent so the two never silently fight."""

    def _attach_pdf(self) -> None:
        self.project.score_pdf.save("manual.pdf", ContentFile(_pdf_bytes(2)), save=True)

    def test_manual_upload_neutralizes_stale_generated_state(self) -> None:
        # A generated, then drifted (stale) book...
        self._add_edition()
        self.package.status = ScorePackage.Status.READY
        self.package.source_hash = "stale-hash-that-will-never-match"
        self.package.build_version = 2
        self.package.save()
        self._attach_pdf()

        ScorePackageService.mark_manual_upload(self.project)
        state = ScorePackageService.compute_state(self.project)
        self.assertTrue(state["is_manual_upload"])
        self.assertFalse(state["is_stale"])  # a hand file is never 'stale' vs repertoire
        self.assertEqual(state["status"], "RDY")

    def test_manual_upload_resets_distribution(self) -> None:
        self._attach_pdf()
        ScorePackageService.mark_distributed(self.project)
        ScorePackageService.mark_manual_upload(self.project)
        self.package.refresh_from_db()
        self.assertIsNone(self.package.distributed_at)  # new file, singers don't have it
        self.assertTrue(self.package.is_manual_upload)

    def test_clear_resets_to_idle(self) -> None:
        self._attach_pdf()
        ScorePackageService.mark_manual_upload(self.project)
        # Singer access is gone once the file is cleared.
        self.project.score_pdf.delete(save=True)
        ScorePackageService.mark_score_cleared(self.project)
        self.package.refresh_from_db()
        self.assertEqual(self.package.status, ScorePackage.Status.IDLE)
        self.assertFalse(self.package.is_manual_upload)
        self.assertIsNone(self.package.generated_at)

    def test_generate_after_manual_clears_manual_flag(self) -> None:
        from roster.infrastructure import score_package_builder as builder

        self._add_edition(pages=2)
        self._attach_pdf()
        ScorePackageService.mark_manual_upload(self.project)
        self.package.refresh_from_db()
        self.assertTrue(self.package.is_manual_upload)

        self.package.include_page_numbers = False
        self.package.include_cards = False
        self.package.save()
        with mock.patch.object(builder, "_render_pdf", side_effect=lambda html: _pdf_bytes(1)):
            ScorePackageService.run_build(str(self.package.pk))

        self.package.refresh_from_db()
        self.assertFalse(self.package.is_manual_upload)  # generator reclaimed the file
        self.assertEqual(self.package.build_version, 1)


@skipUnless(_HAS_PDFIUM, "pypdfium2 is not installed on this host")
class PdfRasterTests(TestCase):
    """Real PDFium rasterisation — runs only where the wheel loaded."""

    def test_renders_one_webp_per_page(self) -> None:
        blobs = render_pdf_thumbnails(_pdf_bytes(3), width_px=120)
        self.assertEqual(len(blobs), 3)
        for blob in blobs:
            # WebP container magic: 'RIFF' <size> 'WEBP'.
            self.assertEqual(blob[:4], b"RIFF")
            self.assertEqual(blob[8:12], b"WEBP")

    def test_caps_at_max_pages(self) -> None:
        blobs = render_pdf_thumbnails(_pdf_bytes(5), width_px=80, max_pages=2)
        self.assertEqual(len(blobs), 2)


@override_settings(MEDIA_ROOT=_MEDIA)
class ThumbnailServiceTests(_Base):
    """Manifest assembly + content-hash caching, with the rasteriser stubbed so the
    test does not depend on the native engine."""

    def setUp(self) -> None:
        super().setUp()
        cache.clear()  # rasterised pages are cached by sha256 — isolate every test.

    def test_no_edition_yields_empty_strip(self) -> None:
        manifest = ScorePackageService.thumbnails_for_item(self.project, str(self.item.pk))
        self.assertTrue(manifest["available"])
        self.assertIsNone(manifest["edition_id"])
        self.assertEqual(manifest["page_count"], 0)
        self.assertEqual(manifest["thumbnails"], [])

    def test_unknown_item_rejected(self) -> None:
        with self.assertRaises(ScorePackageItemError):
            ScorePackageService.thumbnails_for_item(self.project, str(uuid.uuid4()))

    def test_manifest_shape_and_caching(self) -> None:
        edition = self._add_edition(pages=4)
        with mock.patch(
            "roster.score_package_service.render_pdf_thumbnails",
            return_value=[b"webp-a", b"webp-b", b"webp-c", b"webp-d"],
        ) as render:
            first = ScorePackageService.thumbnails_for_item(self.project, str(self.item.pk))
            second = ScorePackageService.thumbnails_for_item(self.project, str(self.item.pk))

        self.assertTrue(first["available"])
        self.assertEqual(first["edition_id"], str(edition.pk))
        self.assertEqual(first["page_count"], 4)
        self.assertEqual(len(first["thumbnails"]), 4)
        self.assertEqual(first["thumbnails"][0]["page"], 1)
        prefix = "data:image/webp;base64,"
        src = first["thumbnails"][0]["src"]
        self.assertTrue(src.startswith(prefix))
        self.assertEqual(base64.b64decode(src[len(prefix):]), b"webp-a")
        # An edition is immutable, so its pages are rasterised once and reused.
        render.assert_called_once()
        self.assertEqual(first, second)

    def test_dependency_missing_degrades_gracefully(self) -> None:
        edition = self._add_edition(pages=2)
        with mock.patch(
            "roster.score_package_service.render_pdf_thumbnails",
            side_effect=PdfRasterDependencyError("no pdfium"),
        ):
            manifest = ScorePackageService.thumbnails_for_item(self.project, str(self.item.pk))
        self.assertFalse(manifest["available"])
        self.assertEqual(manifest["edition_id"], str(edition.pk))
        self.assertEqual(manifest["thumbnails"], [])
