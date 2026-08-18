"""
@file test_liturgy.py
@description Coverage for the liturgical programme: the vocabulary's derivation
    rules (numbering, section, which slots print a prefix), the precedence of a
    hand-typed override, the order check, and the three places the result has to
    arrive — the setlist API, the score-book card and the printed day card. The
    Polish catalogue is asserted directly, because a slot whose label falls back
    to English is exactly the failure a typed vocabulary exists to prevent.
@architecture Enterprise SaaS 2026
@module roster/test_liturgy
"""

from __future__ import annotations

from dataclasses import dataclass

from django.test import SimpleTestCase, TestCase
from django.utils import translation

from archive.models import Composer, Piece
from roster.domain.liturgy import (
    SLOT_TEMPLATES,
    SLOTS,
    build_program_presentation,
    canonical_sort_key,
    liturgy_order_problems,
    vocabulary_payload,
)
from roster.models import ProgramItem, Project
from roster.score_package_service import ScorePackageItemError, ScorePackageService
from roster.serializers import ProgramItemSerializer, ProjectSerializer


@dataclass(frozen=True)
class _Item:
    """Stand-in for a ProgramItem — the domain speaks a protocol, so its rules can
    be exercised without a database."""

    order: int
    liturgical_slot: str = ""
    section_label: str = ""
    role_prefix: str = ""


class VocabularyTests(SimpleTestCase):
    def test_ranks_are_unique_and_ascending(self) -> None:
        ranks = [slot.rank for slot in SLOTS]
        self.assertEqual(ranks, sorted(ranks))
        self.assertEqual(len(set(ranks)), len(ranks))

    def test_codes_are_unique(self) -> None:
        codes = [slot.code for slot in SLOTS]
        self.assertEqual(len(set(codes)), len(codes))

    def test_wedding_template_is_a_superset_of_the_mass_one(self) -> None:
        self.assertTrue(set(SLOT_TEMPLATES["MASS"]) < set(SLOT_TEMPLATES["WEDDING"]))

    def test_payload_carries_every_slot_with_its_part(self) -> None:
        payload = vocabulary_payload()
        slots = payload["slots"]
        assert isinstance(slots, list)
        self.assertEqual(len(slots), len(SLOTS))
        self.assertTrue(all(entry["label"] and entry["part_label"] for entry in slots))


class PresentationTests(SimpleTestCase):
    def test_single_use_slot_is_not_numbered(self) -> None:
        (offertory,) = build_program_presentation([_Item(1, "offertory")])
        self.assertNotIn("1", offertory.slot_label)

    def test_repeated_slot_is_numbered_in_running_order(self) -> None:
        first, _middle, second = build_program_presentation([
            _Item(1, "communion"),
            _Item(2, "sanctus"),
            _Item(3, "communion"),
        ])
        self.assertTrue(first.slot_label.endswith(" 1"))
        self.assertTrue(second.slot_label.endswith(" 2"))
        self.assertEqual(
            first.slot_label.removesuffix(" 1"),
            second.slot_label.removesuffix(" 2"),
        )

    def test_numbering_closes_up_when_one_of_a_pair_is_removed(self) -> None:
        """The reason the index is derived and never stored: deleting the first
        of two must leave the survivor un-numbered, not stranded as "2"."""
        (survivor,) = build_program_presentation([_Item(1, "communion")])
        self.assertNotIn("2", survivor.slot_label)

    def test_function_slot_prints_a_prefix_before_the_title(self) -> None:
        (item,) = build_program_presentation([_Item(1, "offertory")])
        self.assertTrue(item.role_prefix.endswith(":"))
        self.assertTrue(item.role_prefix.startswith(item.slot_label))

    def test_ordinary_part_is_labelled_but_never_prefixed(self) -> None:
        """A Kyrie is titled "Kyrie" — printing "Kyrie: Kyrie" above it is the
        redundancy the slot kinds exist to prevent."""
        (item,) = build_program_presentation([_Item(1, "kyrie")])
        self.assertTrue(item.slot_label)
        self.assertEqual(item.role_prefix, "")

    def test_proper_part_is_labelled_but_never_prefixed(self) -> None:
        (item,) = build_program_presentation([_Item(1, "psalm")])
        self.assertTrue(item.slot_label)
        self.assertEqual(item.role_prefix, "")

    def test_section_is_derived_from_the_part_of_the_rite(self) -> None:
        offertory, entrance = build_program_presentation([
            _Item(1, "offertory"),
            _Item(2, "entrance"),
        ])
        self.assertTrue(offertory.section)
        self.assertNotEqual(offertory.section, entrance.section)

    def test_overrides_win_over_everything_derived(self) -> None:
        (item,) = build_program_presentation([
            _Item(1, "communion", section_label="PO KOMUNII", role_prefix="Antyfona:")
        ])
        self.assertEqual(item.section, "PO KOMUNII")
        self.assertEqual(item.role_prefix, "Antyfona:")

    def test_override_survives_on_an_item_with_no_slot(self) -> None:
        """A concert programme that already carried hand-typed labels keeps them:
        the typed slot is an addition, never a migration of existing text."""
        (item,) = build_program_presentation([
            _Item(1, "", section_label="CZĘŚĆ I", role_prefix="Bis:")
        ])
        self.assertEqual(item.slot, "")
        self.assertEqual(item.slot_label, "")
        self.assertEqual(item.section, "CZĘŚĆ I")
        self.assertEqual(item.role_prefix, "Bis:")

    def test_unknown_stored_code_presents_as_no_slot(self) -> None:
        (item,) = build_program_presentation([_Item(1, "sequentia")])
        self.assertEqual(item.slot, "")
        self.assertEqual(item.slot_label, "")

    def test_polish_labels_come_from_the_catalogue(self) -> None:
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        entrance, communion_a, _, communion_b = build_program_presentation([
            _Item(1, "entrance"),
            _Item(2, "communion"),
            _Item(3, "sanctus"),
            _Item(4, "communion"),
        ])
        self.assertEqual(entrance.slot_label, "Na wejście")
        self.assertEqual(communion_a.slot_label, "Na Komunię 1")
        self.assertEqual(communion_b.slot_label, "Na Komunię 2")
        self.assertEqual(communion_a.section, "Liturgia eucharystyczna")

    def test_entrance_does_not_borrow_the_call_sheets_word_for_the_door(self) -> None:
        """The bare msgid "Entrance" is already the day card's word for the gate
        the ensemble comes in by. Sharing it would print "Wejście" where the
        liturgy means "Na wejście" — hence the gettext context."""
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        (entrance,) = build_program_presentation([_Item(1, "entrance")])
        self.assertNotEqual(entrance.slot_label, "Wejście")

    def test_french_labels_come_from_the_catalogue(self) -> None:
        self.addCleanup(translation.deactivate)
        translation.activate("fr")
        (offertory,) = build_program_presentation([_Item(1, "offertory")])
        self.assertEqual(offertory.slot_label, "Offertoire")


class OrderCheckTests(SimpleTestCase):
    def test_canonical_running_order_reports_nothing(self) -> None:
        self.assertEqual(
            liturgy_order_problems([
                _Item(1, "entrance"), _Item(2, "offertory"), _Item(3, "recessional"),
            ]),
            (),
        )

    def test_a_slot_that_steps_back_in_the_rite_is_reported(self) -> None:
        self.assertEqual(
            liturgy_order_problems([
                _Item(1, "sanctus"), _Item(2, "gloria"), _Item(3, "communion"),
            ]),
            (1,),
        )

    def test_unslotted_items_are_transparent_to_the_check(self) -> None:
        self.assertEqual(
            liturgy_order_problems([
                _Item(1, "entrance"), _Item(2, ""), _Item(3, "offertory"),
            ]),
            (),
        )

    def test_a_repeated_slot_is_not_a_problem(self) -> None:
        self.assertEqual(
            liturgy_order_problems([_Item(1, "communion"), _Item(2, "communion")]),
            (),
        )

    def test_canonical_sort_parks_unslotted_items_at_the_end(self) -> None:
        items = [_Item(1, ""), _Item(2, "recessional"), _Item(3, "entrance")]
        self.assertEqual(
            [item.order for item in sorted(items, key=canonical_sort_key)],
            [3, 2, 1],
        )


class _ProgrammeBase(TestCase):
    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Ślub — Anna i Piotr", event_kind=Project.EventKind.WEDDING,
        )
        composer = Composer.objects.create(first_name="Wolfgang", last_name="Mozart")
        self.pieces = [
            Piece.objects.create(title=title, composer=composer)
            for title in ("Ave verum corpus", "Panis angelicus", "Laudate Dominum")
        ]
        self.items = [
            ProgramItem.objects.create(
                project=self.project, piece=piece, order=index, liturgical_slot=slot,
            )
            for index, (piece, slot) in enumerate(
                zip(self.pieces, ("offertory", "communion", "communion"), strict=True),
                start=1,
            )
        ]


class ProjectEventKindTests(_ProgrammeBase):
    def test_liturgical_kinds_are_recognised(self) -> None:
        self.assertTrue(self.project.is_liturgical)
        self.project.event_kind = Project.EventKind.CONCERT
        self.assertFalse(self.project.is_liturgical)

    def test_new_package_takes_its_density_from_the_event(self) -> None:
        package = ScorePackageService.get_or_create(self.project)
        self.assertEqual(package.density_mode, "MASS")

    def test_a_concert_still_opens_on_concert_density(self) -> None:
        concert = Project.objects.create(title="Koncert Wiosenny")
        self.assertEqual(
            ScorePackageService.get_or_create(concert).density_mode, "CONCERT"
        )

    def test_density_chosen_by_hand_is_not_overwritten_later(self) -> None:
        package = ScorePackageService.get_or_create(self.project)
        package.density_mode = "CONCERT"
        package.save()
        self.assertEqual(
            ScorePackageService.get_or_create(self.project).density_mode, "CONCERT"
        )


class SetlistApiTests(_ProgrammeBase):
    def test_serializer_numbers_repeats_across_siblings(self) -> None:
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        rows = ProgramItemSerializer(self.items, many=True).data
        self.assertEqual([row["slot_label"] for row in rows],
                         ["Na ofiarowanie", "Na Komunię 1", "Na Komunię 2"])

    def test_serializer_numbers_a_single_row_against_its_siblings(self) -> None:
        """A retrieve of the third item alone still has to say "2" — which is why
        the presentation loads the whole programme rather than the view's rows."""
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        row = ProgramItemSerializer(self.items[2]).data
        self.assertEqual(row["slot_label"], "Na Komunię 2")

    def test_serializer_exposes_the_derived_section_and_role(self) -> None:
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        row = ProgramItemSerializer(self.items[0]).data
        self.assertEqual(row["section"], "Liturgia eucharystyczna")
        self.assertEqual(row["role_prefix_effective"], "Na ofiarowanie:")
        # The stored override stays empty — only the derived value is filled in.
        self.assertEqual(row["role_prefix"], "")

    def test_setlist_write_path_sets_and_clears_the_slot(self) -> None:
        """The setlist picker's own write. Clearing matters as much as setting:
        blank is the resting state of an item nobody has placed yet, so the
        field has to accept being emptied through the same door."""
        serializer = ProgramItemSerializer(
            self.items[0], data={"liturgical_slot": "entrance"}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.items[0].refresh_from_db()
        self.assertEqual(self.items[0].liturgical_slot, "entrance")

        serializer = ProgramItemSerializer(
            self.items[0], data={"liturgical_slot": ""}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.items[0].refresh_from_db()
        self.assertEqual(self.items[0].liturgical_slot, "")

    def test_setlist_write_path_refuses_an_invented_slot(self) -> None:
        serializer = ProgramItemSerializer(
            self.items[0], data={"liturgical_slot": "sequentia"}, partial=True,
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("liturgical_slot", serializer.errors)


class CockpitWriteTests(_ProgrammeBase):
    def test_cockpit_accepts_a_known_slot(self) -> None:
        ScorePackageService.update_item(
            self.project, str(self.items[0].pk), {"liturgical_slot": "entrance"},
        )
        self.items[0].refresh_from_db()
        self.assertEqual(self.items[0].liturgical_slot, "entrance")

    def test_cockpit_clears_a_slot(self) -> None:
        ScorePackageService.update_item(
            self.project, str(self.items[0].pk), {"liturgical_slot": ""},
        )
        self.items[0].refresh_from_db()
        self.assertEqual(self.items[0].liturgical_slot, "")

    def test_cockpit_refuses_an_invented_slot(self) -> None:
        with self.assertRaises(ScorePackageItemError):
            ScorePackageService.update_item(
                self.project, str(self.items[0].pk), {"liturgical_slot": "sequentia"},
            )

    def test_changing_a_slot_makes_the_built_book_stale(self) -> None:
        package = ScorePackageService.get_or_create(self.project)
        before = ScorePackageService.compute_source_hash(self.project, package)
        self.items[0].liturgical_slot = "entrance"
        self.items[0].save()
        after = ScorePackageService.compute_source_hash(self.project, package)
        self.assertNotEqual(before, after)


class ProjectProgramSnippetTests(_ProgrammeBase):
    def test_project_program_snippet_carries_the_slot(self) -> None:
        self.addCleanup(translation.deactivate)
        translation.activate("pl")
        program = ProjectSerializer(self.project).data["program"]
        self.assertEqual([row["liturgical_slot"] for row in program],
                         ["offertory", "communion", "communion"])
        self.assertEqual(program[2]["slot_label"], "Na Komunię 2")
