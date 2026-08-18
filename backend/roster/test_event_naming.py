"""
@file test_event_naming.py
@description Coverage for naming the event by what it actually is. The fact is
    ``Project.event_kind``; these are the four surfaces that used to call every
    engagement a concert regardless of it — the printed day card's masthead and
    timeline, the subscribed calendar, and the reminder that lands the evening
    before. Polish is asserted directly, because a Mass whose run sheet falls
    back to "Koncert" is precisely the defect the typed kind exists to prevent.
@architecture Enterprise SaaS 2026
@module roster/test_event_naming
"""

from __future__ import annotations

from datetime import UTC, datetime

from django.test import SimpleTestCase, TestCase
from django.utils import translation

from core.ical_service import ICalGeneratorService
from notifications.message_content import MessageContentBuilder
from notifications.models import NotificationLevel, NotificationType
from roster.domain.day_timeline import (
    TimelineEntry,
    TimelineEntryKind,
    resolve_call_window,
)
from roster.domain.event_kind import event_moment_label
from roster.infrastructure.document_generator import DocumentGenerator
from roster.models import Project


class EventMomentLabelTests(SimpleTestCase):
    def test_every_kind_reads_in_polish(self) -> None:
        with translation.override("pl"):
            self.assertEqual(event_moment_label("CONCERT"), "Koncert")
            self.assertEqual(event_moment_label("MASS"), "Msza")
            self.assertEqual(event_moment_label("WEDDING"), "Msza ślubna")

    def test_other_is_named_as_the_event_not_as_a_leftover_category(self) -> None:
        """The picker says "Inne wydarzenie" because it is answering "which of the
        four?". A reader looking at a clock is not asking that."""
        with translation.override("pl"):
            self.assertEqual(event_moment_label("OTHER"), "Wydarzenie")
            self.assertEqual(
                str(Project.EventKind.OTHER.label), "Inne wydarzenie"
            )

    def test_an_unknown_or_missing_kind_reads_as_the_default(self) -> None:
        with translation.override("pl"):
            self.assertEqual(event_moment_label(""), "Koncert")
            self.assertEqual(event_moment_label(None), "Koncert")
            self.assertEqual(event_moment_label("VIGIL"), "Koncert")

    def test_french_comes_from_the_catalogue(self) -> None:
        with translation.override("fr"):
            self.assertEqual(event_moment_label("MASS"), "Messe")
            self.assertEqual(event_moment_label("OTHER"), "Événement")


class DayCardNamingTests(SimpleTestCase):
    """The printed sheet, whose masthead and timeline must agree word for word."""

    @staticmethod
    def _timeline() -> list[TimelineEntry]:
        return [
            TimelineEntry(kind=TimelineEntryKind.CALL, time="17:00", day_offset=0),
            TimelineEntry(kind=TimelineEntryKind.CONCERT, time="18:00", day_offset=0),
        ]

    def test_downbeat_row_is_named_for_the_kind(self) -> None:
        with translation.override("pl"):
            rows = DocumentGenerator._build_timeline_rows(self._timeline(), "WEDDING")
        self.assertEqual([row["title"] for row in rows], ["Zbiórka", "Początek Mszy ślubnej"])

    def test_a_concert_still_says_concert(self) -> None:
        with translation.override("pl"):
            rows = DocumentGenerator._build_timeline_rows(self._timeline(), "CONCERT")
        self.assertEqual(rows[1]["title"], "Początek koncertu")

    def test_masthead_and_timeline_use_one_wording(self) -> None:
        project = Project(title="Msza za Ojczyznę", event_kind=Project.EventKind.MASS)
        window = resolve_call_window(
            datetime(2026, 9, 12, 15, 0, tzinfo=UTC),
            datetime(2026, 9, 12, 16, 0, tzinfo=UTC),
            "Europe/Warsaw",
        )
        with translation.override("pl"):
            facts = DocumentGenerator._build_masthead_facts(
                window, self._timeline(), project, is_report=False
            )
            rows = DocumentGenerator._build_timeline_rows(self._timeline(), "MASS")
        self.assertEqual(facts[2]["label"], "Początek Mszy")
        self.assertEqual(rows[1]["title"], facts[2]["label"])


class CalendarNamingTests(TestCase):
    """The .ics entry outlives the app it came from — its subject is what a
    singer re-reads for months."""

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Ślub — Anna i Piotr",
            event_kind=Project.EventKind.WEDDING,
            date_time=datetime(2026, 9, 12, 16, 0, tzinfo=UTC),
            call_time=datetime(2026, 9, 12, 14, 30, tzinfo=UTC),
        )

    def test_summary_names_the_kind(self) -> None:
        with translation.override("pl"):
            ics = ICalGeneratorService._build_ics([self.project], [])
        self.assertIn("SUMMARY:[Msza ślubna] Ślub — Anna i Piotr", ics)
        self.assertNotIn("[Koncert]", ics)

    def test_description_row_names_the_kind(self) -> None:
        with translation.override("pl"):
            description = ICalGeneratorService._project_description(self.project)
        self.assertTrue(description.startswith("Msza ślubna: 18:00"), description)


class ReminderNamingTests(SimpleTestCase):
    def _title(self, event_kind: str, *, when: str = "12 września, 18:00") -> str:
        with translation.override("pl"):
            return MessageContentBuilder.build(
                NotificationType.PROJECT_REMINDER,
                NotificationLevel.INFO,
                {
                    "project_name": "Ślub — Anna i Piotr",
                    "event_kind": event_kind,
                    "date_range": when,
                },
                is_manager=False,
            ).title

    def test_push_title_leads_with_the_kind(self) -> None:
        self.assertTrue(self._title("WEDDING").startswith("Msza ślubna — "))
        self.assertTrue(self._title("CONCERT").startswith("Koncert — "))

    def test_a_row_without_the_kind_still_reads_as_a_concert(self) -> None:
        self.assertTrue(self._title("").startswith("Koncert — "))

    def test_the_dateless_form_also_names_the_kind(self) -> None:
        self.assertEqual(self._title("MASS", when=""), "Już wkrótce: Msza")
