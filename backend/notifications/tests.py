"""
@file tests.py
@description Tests for the notification message layer and transactional email.
             Covers: channel-agnostic MessageContent composition, push projection
             parity, role-aware deep-links, and the EmailDispatcherService path
             (subject from the message layer, absolute CTA, greeting, opt-out,
             bespoke-template branch). Language is pinned to 'en' so assertions
             are deterministic regardless of compiled .mo catalogs.
@module notifications/tests
"""
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import ClassVar, cast
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone, translation
from pydantic import ValidationError
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile

from .delivery import default_channel_preferences
from .email_service import EmailDispatcherService, EmailType
from .message_content import (
    _COMPOSERS,
    MessageContent,
    MessageContentBuilder,
    PushPayload,
)
from .models import Notification, NotificationLevel, NotificationPreference, NotificationType

User = get_user_model()

_RICH_META = {
    "project_name": "Requiem", "piece_title": "Lacrimosa", "artist_name": "Ada",
    "inviter_name": "Krystian", "date_range": "19-21 June", "location": "St Anne's",
    "voice_line": "Soprano I", "rehearsal_date": "Thu 19 Jun, 19:00",
    "starts_at": "Thu 19 Jun, 19:00", "action_details": "confirmed", "changes": ["a", "b"],
    "message": "Hello", "title": "Subject", "sender_name": "Krystian", "snippet": "snip",
    "project_id": "p1", "rehearsal_id": "r1", "piece_id": "pc1", "thread_id": "t1",
    "channel_id": "c1", "artist_id": "x", "sender_id": "s1", "participation_id": "pa1",
}


class MessageContentCompositionTests(SimpleTestCase):
    """No DB: pure composition + projection behaviour."""

    def test_every_type_composes_complete_content(self) -> None:
        with translation.override("en"):
            for ntype in _COMPOSERS:
                for is_manager in (True, False):
                    c = MessageContentBuilder.build(ntype, NotificationLevel.INFO, _RICH_META, is_manager=is_manager)
                    self.assertIsInstance(c, MessageContent)
                    self.assertTrue(c.title.strip(), f"{ntype}: empty title")
                    self.assertTrue(c.body.strip(), f"{ntype}: empty body")
                    self.assertTrue(c.subject.strip(), f"{ntype}: empty subject")
                    self.assertTrue(c.tag, f"{ntype}: empty tag")
                    self.assertTrue(c.url_path, f"{ntype}: empty url_path")

    def test_push_projection_is_faithful(self) -> None:
        """to_push() must mirror the canonical content (push UX unchanged)."""
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.REHEARSAL_CANCELLED, NotificationLevel.WARNING,
                _RICH_META, is_manager=False,
            )
            push = c.to_push()
            self.assertIsInstance(push, PushPayload)
            self.assertEqual(push.title, c.title)
            self.assertEqual(push.body, c.body)
            self.assertEqual(push.url, c.url_path)
            self.assertEqual(push.tag, c.tag)
            self.assertEqual(push.level, c.level)
            self.assertEqual(push.actions, c.actions)

    def test_deep_link_is_role_aware(self) -> None:
        with translation.override("en"):
            mgr = MessageContentBuilder.build(NotificationType.PROJECT_UPDATED, "INFO", _RICH_META, is_manager=True)
            art = MessageContentBuilder.build(NotificationType.PROJECT_UPDATED, "INFO", _RICH_META, is_manager=False)
            self.assertEqual(mgr.url_path, "/panel/projects")
            self.assertEqual(art.url_path, "/panel/schedule")

    def test_email_context_resolves_absolute_url(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(NotificationType.CONTRACT_ISSUED, "INFO", _RICH_META, is_manager=False)
            ctx = c.to_email_context(base_url="https://example.test")
            self.assertEqual(ctx["cta_url"], "https://example.test/panel/contracts")
            self.assertTrue(ctx["lead"].strip())
            self.assertTrue(ctx["cta_label"].strip())

    def test_subject_carries_metadata(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(NotificationType.REHEARSAL_CANCELLED, "WARNING", _RICH_META, is_manager=False)
            self.assertIn("Requiem", c.subject)

    def test_contract_is_warning_level(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(NotificationType.CONTRACT_ISSUED, "INFO", {}, is_manager=False)
            self.assertEqual(c.level, NotificationLevel.WARNING)

    def test_unknown_type_falls_back(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build("SOME_FUTURE_TYPE", "INFO", {}, is_manager=False)
            self.assertTrue(c.title.strip())
            self.assertEqual(c.url_path, "/panel")


class StructuredMetadataTests(SimpleTestCase):
    """Composers render structured codes (status / field changes) — never prose."""

    def test_attendance_status_and_minutes_render(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.ATTENDANCE_SUBMITTED, "INFO",
                {"artist_name": "Ada", "project_name": "Requiem", "status": "LATE", "minutes_late": 15},
                is_manager=True,
            )
            # The person and their answer are the scanning line; the body carries
            # the context they apply to.
            self.assertIn("Ada", c.title)
            self.assertIn("15", c.title)
            self.assertIn("Requiem", c.body)
            # The old half-English "Status: LATE. Note:" prose must be gone.
            self.assertNotIn("Status:", c.title)

    def test_participation_status_renders_phrase(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.PARTICIPATION_RESPONSE, "INFO",
                {"artist_name": "Bo", "project_name": "Requiem", "status": "DEC"},
                is_manager=True,
            )
            self.assertIn("declined", c.title.lower())
            self.assertIn("Requiem", c.body)
            self.assertNotIn("Changed status", c.title)

    def test_structured_changes_render_localized_labels(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.PROJECT_UPDATED, "WARNING",
                {"project_name": "Requiem",
                 "changes": [{"field": "location", "old": "A", "new": "B"},
                             {"field": "date_time", "old": "x", "new": "y"}]},
                is_manager=False,
            )
            self.assertIn("Venue", c.body)
            self.assertIn("A → B", c.body)
            # Detail rows mirror the structured changes.
            self.assertTrue(any(r.label == "Date & time" for r in c.details))

    def test_status_change_renders_a_label_not_a_database_code(self) -> None:
        # A status diff carries language-neutral Project.Status codes; surfacing
        # them raw ("ACTIVE → CANC") leaks the schema to the singer.
        for lang, expected in (("en", "Active / In Prep"), ("pl", "Aktywny")):
            with translation.override(lang):
                c = MessageContentBuilder.build(
                    NotificationType.PROJECT_UPDATED, "WARNING",
                    {"project_name": "Requiem",
                     "changes": [{"field": "status", "old": "DRAFT", "new": "ACTIVE"}]},
                    is_manager=False,
                )
                with self.subTest(lang=lang):
                    self.assertIn(expected, c.body)
                    self.assertNotIn("ACTIVE", c.body)
                    self.assertNotIn("DRAFT", c.body)

    def test_admin_broadcast_without_a_link_lands_on_the_dashboard(self) -> None:
        # Not on the notification-preferences tab: a message from management is
        # not an invitation to reconfigure channels.
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.CUSTOM_ADMIN_MESSAGE, "INFO",
                {"sender_name": "Ada", "title": "Dress code", "message": "Black shoes."},
                is_manager=False,
            )
            self.assertEqual(c.url_path, "/panel")

    def test_rehearsal_scheduled_uses_glance_facts(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.REHEARSAL_SCHEDULED, "INFO",
                {
                    "project_name": "Requiem",
                    "starts_at": "2026-06-19T17:00:00+00:00",
                    "starts_at_display": "19.06.2026, 19:00",
                    "timezone": "Europe/Warsaw",
                    "location": "St Anne's",
                    "focus": "Lacrimosa",
                },
                is_manager=False,
            )
            # The moment leads the title — it is the one fact a lock screen must
            # never truncate — and it is rendered from the ISO value, so the
            # stored numeric copy never reaches the reader.
            self.assertIn("Friday", c.title)
            self.assertIn("19 June", c.title)
            self.assertIn("19:00", c.title)
            self.assertNotIn("19.06.2026", c.title)
            # The body spends its room on where and what, not on repeating the title.
            self.assertIn("St Anne's", c.body)
            self.assertIn("Lacrimosa", c.body)
            self.assertNotIn("19 June", c.body)
            self.assertTrue(any(r.label == "Focus" for r in c.details))

    def test_event_time_metadata_is_structured_and_display_safe(self) -> None:
        from .time_metadata import build_event_time_metadata, display_event_time

        metadata = build_event_time_metadata(
            datetime(2020, 6, 19, 17, 0, tzinfo=UTC),
            "Europe/Warsaw",
            fallback_timezone="Europe/Warsaw",
        )

        self.assertEqual(metadata["starts_at"], "2020-06-19T17:00:00+00:00")
        # The persisted display copy stays language-neutral: it is frozen at
        # emission time, before the recipient's language is known.
        self.assertEqual(metadata["starts_at_display"], "19.06.2020, 19:00")
        self.assertEqual(metadata["timezone"], "Europe/Warsaw")
        with translation.override("en"):
            self.assertEqual(display_event_time(metadata), "Friday, 19 June 2020 at 19:00")

        fallback_metadata = build_event_time_metadata(
            datetime(2026, 6, 19, 17, 0, tzinfo=UTC),
            "Invalid/Timezone",
            fallback_timezone="Invalid/Fallback",
        )
        self.assertEqual(fallback_metadata["timezone"], "UTC")

    def test_rehearsal_copy_formats_iso_without_exposing_raw_value(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.REHEARSAL_SCHEDULED, "INFO",
                {
                    "project_name": "Requiem",
                    "starts_at": "2020-06-19T17:00:00+00:00",
                    "timezone": "Europe/Warsaw",
                    "location": "St Anne's",
                },
                is_manager=False,
            )
            self.assertIn("Friday, 19 June 2020 at 19:00", c.title)
            self.assertNotIn("2020-06-19T17:00:00", c.title)
            self.assertNotIn("2020-06-19T17:00:00", c.body)

    def test_message_push_body_does_not_expose_full_message(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.MESSAGE_RECEIVED, "INFO",
                {
                    "thread_id": "t1",
                    "title": "Rehearsal logistics",
                    "sender_name": "Ada",
                    "message": "Private travel details",
                    "snippet": "Private travel details",
                },
                is_manager=False,
            )
            self.assertNotIn("Private travel details", c.body)
            self.assertIn("Rehearsal logistics", c.body)

    def test_project_removed_event_distinct_from_update(self) -> None:
        with translation.override("en"):
            removed = MessageContentBuilder.build(
                NotificationType.PROJECT_UPDATED, "WARNING",
                {"project_name": "Requiem", "event": "removed"}, is_manager=False,
            )
            self.assertIn("no longer", removed.body.lower())

    def test_casting_carries_contextual_action_urls(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.PIECE_CASTING_ASSIGNED, "INFO",
                {"piece_title": "Lacrimosa", "voice_line": "Alt"}, is_manager=False,
            )
            urls = {a.action: a.url for a in c.actions}
            self.assertEqual(urls.get("view"), "/panel/materials")
            self.assertEqual(urls.get("schedule"), "/panel/schedule")


class EmailLeadTests(SimpleTestCase):
    """
    The email lead says what the event means and what is expected; the detail card
    below it owns the facts. A lead that is merely the push body would repeat the
    headline and drag lock-screen idiom ("Tap to…") into an inbox.
    """

    _EVENT_META: ClassVar[dict[str, str]] = {
        "project_name": "Requiem",
        "piece_title": "Lacrimosa",
        "artist_name": "Ada",
        "starts_at": "2020-06-19T17:00:00+00:00",
        "timezone": "Europe/Warsaw",
        "location": "St Anne's",
        "rehearsal_date": "19.06.2020, 19:00",
    }

    def test_every_routed_type_authors_its_own_lead(self) -> None:
        # Free-form types carry the sender's own words, so their lead IS the body.
        free_form = {
            NotificationType.CUSTOM_ADMIN_MESSAGE.value,
            NotificationType.MESSAGE_RECEIVED.value,
            NotificationType.CHANNEL_MESSAGE.value,
            NotificationType.SYSTEM_ALERT.value,
            NotificationType.NOTIFICATION_READ_RECEIPT.value,
        }
        with translation.override("en"):
            for ntype in NotificationType:
                if ntype.value in free_form:
                    continue
                c = MessageContentBuilder.build(
                    ntype.value, "INFO", self._EVENT_META, is_manager=False
                )
                with self.subTest(notification_type=ntype.value):
                    self.assertTrue(c.email_lead, "no lead authored")
                    self.assertNotEqual(c.email_lead, c.body)
                    self.assertNotIn("Tap", c.email_lead)

    def test_ceremonial_types_get_the_warm_greeting(self) -> None:
        with translation.override("en"):
            invitation = MessageContentBuilder.build(
                NotificationType.PROJECT_INVITATION.value, "INFO",
                self._EVENT_META, is_manager=False,
            )
            cancelled = MessageContentBuilder.build(
                NotificationType.REHEARSAL_CANCELLED.value, "WARNING",
                self._EVENT_META, is_manager=False,
            )
        self.assertEqual(invitation.greeting_style, "dear")
        self.assertEqual(invitation.to_email_context(base_url="https://x")["greeting_style"], "dear")
        # An alarm stays sober.
        self.assertEqual(cancelled.greeting_style, "hello")


class LocalizedRenderTests(SimpleTestCase):
    """The compiled .mo catalogs render the warm copy in PL/FR (no English leak)."""

    def test_polish_casting_uses_native_copy(self) -> None:
        with translation.override("pl"):
            c = MessageContentBuilder.build(
                NotificationType.PIECE_CASTING_ASSIGNED, "INFO",
                {"piece_title": "Lacrimosa", "voice_line": "Alt"}, is_manager=False,
            )
            self.assertIn("Śpiewasz", c.title)
            self.assertIn("Nuty", c.body)

    def test_polish_participation_has_no_english_leak(self) -> None:
        with translation.override("pl"):
            c = MessageContentBuilder.build(
                NotificationType.PARTICIPATION_RESPONSE, "INFO",
                {"artist_name": "Ada", "project_name": "Requiem", "status": "DEC"},
                is_manager=True,
            )
            self.assertIn("rezygnuje", c.title)
            self.assertNotIn("declined", c.title.lower())


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://voctensemble.com",
    SITE_URL="https://voctensemble.com/panel",
)
class TransactionalEmailTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="a1", email="a1@test.pl", password="pw123456", first_name="Jan",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST, language="en")

    def _dispatch(self, ntype, template="transactional", metadata=None, level="INFO"):
        EmailDispatcherService.dispatch_from_notification(
            recipient_id=str(self.user.id),
            notification_type=ntype,
            template_name=template,
            metadata=metadata or {},
            level=level,
            email_type=EmailType.OPERATIONAL,
        )

    def test_transactional_email_is_sent_with_layer_subject_and_deeplink(self) -> None:
        self._dispatch(NotificationType.REHEARSAL_CANCELLED,
                       metadata={"project_name": "Requiem"}, level="WARNING")
        self.assertEqual(len(mail.outbox), 1)
        msg = cast(EmailMultiAlternatives, mail.outbox[0])
        self.assertIn("Requiem", msg.subject)
        self.assertEqual(msg.to, ["a1@test.pl"])
        html = str(msg.alternatives[0][0])
        # Greeting personalised (the historic blocktranslate-filter bug is fixed)
        self.assertIn("Jan", html)
        # CTA deep-links to an absolute URL, not bare /panel
        self.assertIn("https://voctensemble.com/panel/schedule", html)
        # Plain-text alternative carries the same absolute link
        self.assertIn("https://voctensemble.com/panel/schedule", msg.body)

    def test_email_language_follows_profile_and_updates_after_change(self) -> None:
        """Notification emails resolve profile.language JIT at send time — so a
        language change is honoured by the very next email, with no re-subscribe."""
        # Profile starts as 'en' (see setUp): an INFO email keeps the warm sign-off.
        self._dispatch(NotificationType.REHEARSAL_SCHEDULED, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 1)
        html_en = str(cast(EmailMultiAlternatives, mail.outbox[0]).alternatives[0][0])
        self.assertIn("With warmest regards,", html_en)

        # Artist switches language → the next email follows immediately.
        mail.outbox.clear()
        self.user.profile.language = "fr"
        self.user.profile.save(update_fields=["language"])

        self._dispatch(NotificationType.REHEARSAL_SCHEDULED, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 1)
        html_fr = str(cast(EmailMultiAlternatives, mail.outbox[0]).alternatives[0][0])
        self.assertIn("Avec nos plus cordiales salutations,", html_fr)
        self.assertNotIn("With warmest regards,", html_fr)

    def test_operational_email_respects_opt_out(self) -> None:
        self.user.profile.email_notifications_enabled = False
        self.user.profile.save(update_fields=["email_notifications_enabled"])
        self._dispatch(NotificationType.REHEARSAL_SCHEDULED, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 0)

    def test_undeliverable_address_is_suppressed(self) -> None:
        self.user.profile.email_undeliverable = True
        self.user.profile.save(update_fields=["email_undeliverable"])
        self._dispatch(NotificationType.REHEARSAL_SCHEDULED, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 0)

    def test_inactive_account_suppresses_notification_email(self) -> None:
        # An invited-but-not-yet-activated account meets the activation email
        # first, never business notifications pointing at a panel it can't enter.
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self._dispatch(NotificationType.PROJECT_INVITATION, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 0)

    def test_active_account_still_receives_notification_email(self) -> None:
        # self.user is active by default (create_user) — the gate must not
        # suppress a genuine, activated recipient.
        self._dispatch(NotificationType.PROJECT_INVITATION, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 1)

    def test_rehearsal_reminder_attaches_ics_and_footer_prefs_link(self) -> None:
        self._dispatch(
            NotificationType.REHEARSAL_REMINDER,
            metadata={
                "project_name": "Requiem",
                "starts_at": "19.06.2026, 19:00",
                "location": "St Anne's",
                "ics": {
                    "kind": "rehearsal", "uid": "rehearsal_x@voctensemble.com",
                    "start": "2026-06-19T17:00:00+00:00", "end": "2026-06-19T20:00:00+00:00",
                    "project_name": "Requiem", "location": "St Anne's", "focus": "Lacrimosa",
                },
            },
        )
        self.assertEqual(len(mail.outbox), 1)
        msg = cast(EmailMultiAlternatives, mail.outbox[0])

        self.assertEqual(len(msg.attachments), 1)
        filename, content, mimetype = msg.attachments[0]
        self.assertEqual(filename, "invite.ics")
        self.assertIn("text/calendar", mimetype)
        self.assertIn("BEGIN:VCALENDAR", str(content))
        self.assertIn("DTSTART:20260619T170000Z", str(content))

        html = str(msg.alternatives[0][0])
        self.assertIn("settings?tab=notifications", html)

    def test_non_calendar_email_has_no_attachment(self) -> None:
        self._dispatch(NotificationType.PIECE_CASTING_ASSIGNED,
                       metadata={"piece_title": "Lacrimosa", "voice_line": "Soprano I"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(len(cast(EmailMultiAlternatives, mail.outbox[0]).attachments), 0)

    def test_bespoke_message_template_uses_layer_subject(self) -> None:
        self._dispatch(
            NotificationType.MESSAGE_RECEIVED,
            template="message_received",
            metadata={"title": "Rehearsal note", "sender_name": "Krystian",
                      "message": "See you Thursday", "thread_id": "t1"},
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Rehearsal note", mail.outbox[0].subject)


_BRIEFING_META: dict = {
    "project_id": "p1",
    "project_name": "Requiem",
    "note": "",
    "items": [
        {
            "subject_type": "CASTING", "kind": "CHANGED",
            "notification_type": NotificationType.PIECE_CASTING_UPDATED,
            "level": "INFO",
            "metadata": {
                "piece_title": "Lacrimosa", "voice_line": "S2",
                "changes": [{"field": "voice_line", "old": "S1", "new": "S2"}],
            },
        },
        {
            "subject_type": "REHEARSAL", "kind": "CREATED",
            "notification_type": NotificationType.REHEARSAL_SCHEDULED,
            "level": "INFO",
            "metadata": {
                "project_name": "Requiem", "starts_at": "2026-06-19T17:00:00+00:00",
                "timezone": "Europe/Warsaw", "location": "St Anne's", "focus": "Intro",
            },
        },
        {
            "subject_type": "PROJECT", "kind": "CHANGED",
            "notification_type": NotificationType.PROJECT_UPDATED,
            "level": "WARNING",
            "metadata": {
                "project_name": "Requiem",
                "changes": [{"field": "location", "old": "St Anne's", "new": "St John's"}],
            },
        },
    ],
    "ics": [
        {
            "kind": "rehearsal", "uid": "rehearsal_a@voctensemble.com",
            "start": "2026-06-19T17:00:00+00:00", "end": "2026-06-19T20:00:00+00:00",
            "project_name": "Requiem", "location": "St Anne's",
        },
        {
            "kind": "rehearsal", "uid": "rehearsal_b@voctensemble.com",
            "start": "2026-06-20T17:00:00+00:00", "end": "2026-06-20T20:00:00+00:00",
            "project_name": "Requiem", "location": "St Anne's",
        },
    ],
}


class BriefingCompositionTests(SimpleTestCase):
    """A briefing is several pieces of news in one message, so its composition has
    one job the single-event composers do not: keeping them apart and in an order
    that puts the reader's own part first."""

    def _build(self, metadata=None, level=NotificationLevel.INFO) -> MessageContent:
        return MessageContentBuilder.build(
            NotificationType.PROJECT_BRIEFING, level,
            _BRIEFING_META if metadata is None else metadata, is_manager=False,
        )

    def test_sections_lead_with_what_is_the_readers_own(self) -> None:
        with translation.override("en"):
            content = self._build()

        self.assertEqual(
            [section.title for section in content.sections],
            ["Your part", "Rehearsals", "The concert"],
        )
        # The casting item names the piece and the line it moved to.
        casting = content.sections[0].items[0]
        self.assertEqual(casting.primary, "Lacrimosa")
        self.assertEqual(casting.secondary, "Soprano 2")
        self.assertIn("Soprano 1", casting.detail)

    def test_a_rehearsal_is_named_by_its_moment(self) -> None:
        with translation.override("en"):
            content = self._build()

        rehearsal = content.sections[1].items[0]
        # The moment follows a dash so it never opens the line — Polish and French
        # both render weekdays lowercase.
        self.assertTrue(rehearsal.primary.startswith("New rehearsal — "))
        self.assertIn("19:00", rehearsal.primary)
        self.assertEqual(rehearsal.secondary, "St Anne's")

    def test_the_title_counts_what_is_inside_and_the_body_previews_it(self) -> None:
        with translation.override("en"):
            content = self._build()

        self.assertEqual(content.title, "3 updates — Requiem")
        self.assertIn("Lacrimosa", content.body)
        self.assertIn("Requiem", content.subject)

    def test_a_note_leads_the_push_body(self) -> None:
        with translation.override("en"):
            content = self._build({**_BRIEFING_META, "note": "Please be punctual."})

        # Truncation trims the tail, so the conductor's words are never the part
        # that gets cut.
        self.assertTrue(content.body.startswith("Please be punctual."))

    def test_polish_reads_natively_and_pluralizes(self) -> None:
        with translation.override("pl"):
            one = self._build({**_BRIEFING_META, "items": _BRIEFING_META["items"][:1]})
            few = self._build()
            sections = [section.title for section in few.sections]

        self.assertEqual(one.title, "1 zmiana — Requiem")
        self.assertEqual(few.title, "3 zmiany — Requiem")
        self.assertEqual(sections, ["Twoja partia", "Próby", "Koncert"])

    def test_an_unknown_subject_is_dropped_rather_than_guessed_at(self) -> None:
        with translation.override("en"):
            content = self._build({
                **_BRIEFING_META,
                "items": [
                    *_BRIEFING_META["items"],
                    {"subject_type": "SOMETHING_NEW", "kind": "CHANGED",
                     "notification_type": "X", "level": "INFO", "metadata": {}},
                ],
            })

        # A briefing that half-renders an item it does not understand is worse than
        # one that is merely shorter.
        self.assertEqual(len(content.sections), 3)
        self.assertEqual(content.title, "3 updates — Requiem")


class BriefingEmailTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="br1", email="br1@test.pl", password="pw123456", first_name="Jan",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST, language="en")

    def test_the_briefing_email_lays_out_its_sections_and_one_calendar(self) -> None:
        EmailDispatcherService.dispatch_from_notification(
            recipient_id=str(self.user.id),
            notification_type=NotificationType.PROJECT_BRIEFING,
            template_name="briefing",
            metadata={**_BRIEFING_META, "note": "Please be punctual."},
            level=NotificationLevel.WARNING,
            email_type=EmailType.OPERATIONAL,
        )

        self.assertEqual(len(mail.outbox), 1)
        msg = cast(EmailMultiAlternatives, mail.outbox[0])
        html = str(msg.alternatives[0][0])

        # The apostrophe in "St John's" arrives HTML-escaped, which is the point —
        # assert on the part that is not entity-encoded.
        for expected in ("Your part", "Rehearsals", "The concert",
                         "Lacrimosa", "St John", "Please be punctual."):
            self.assertIn(expected, html)
        # The plain-text alternative carries the same account.
        self.assertIn("Lacrimosa", msg.body)

        # Two rehearsals, ONE attachment: several invites would read as several
        # pieces of news, which is what the briefing exists to prevent.
        self.assertEqual(len(msg.attachments), 1)
        filename, content, _mimetype = msg.attachments[0]
        self.assertEqual(filename, "schedule.ics")
        self.assertEqual(str(content).count("BEGIN:VEVENT"), 2)

    def test_an_authored_note_cannot_smuggle_markup(self) -> None:
        EmailDispatcherService.dispatch_from_notification(
            recipient_id=str(self.user.id),
            notification_type=NotificationType.PROJECT_BRIEFING,
            template_name="briefing",
            metadata={**_BRIEFING_META, "note": "<script>alert(1)</script>"},
            level=NotificationLevel.INFO,
            email_type=EmailType.OPERATIONAL,
        )

        html = str(cast(EmailMultiAlternatives, mail.outbox[0]).alternatives[0][0])
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)


class AnnouncementNudgeEmailTests(TestCase):
    """The nudge's inbox copy — the channel that carries it when the reason it is
    needed at all is that the conductor stopped opening the app."""

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            username="an-mail", email="an-mail@test.pl", password="pw123456",
            first_name="Jan",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER, language="en")

    def test_the_email_renders_through_the_transactional_layout(self) -> None:
        project_id = "8d79e557-2d1d-4c03-8454-cdc1b8da960d"
        EmailDispatcherService.dispatch_from_notification(
            recipient_id=str(self.manager.id),
            notification_type=NotificationType.ANNOUNCEMENT_PENDING,
            template_name="transactional",
            metadata={
                "project_id": project_id,
                "project_name": "Requiem",
                "change_count": 3,
                "recipient_count": 12,
                "waiting_hours": 26,
            },
            level=NotificationLevel.WARNING,
            email_type=EmailType.OPERATIONAL,
        )

        self.assertEqual(len(mail.outbox), 1)
        msg = cast(EmailMultiAlternatives, mail.outbox[0])
        html = str(msg.alternatives[0][0])

        self.assertIn("Requiem", msg.subject)
        for expected in ("Requiem", "3 changes", "12 people", "Announcement queue"):
            self.assertIn(expected, html)
        # The button has to land on the sheet itself — an email that returns the
        # reader to the hub is the nudge asking them to go and find it.
        self.assertIn(f"/panel/projects/{project_id}?announce=1", html)
        # Nothing to put in a diary: this is a prompt to act, not an event.
        self.assertEqual(len(msg.attachments), 0)

    def test_it_is_sent_by_default_and_stays_out_of_the_daily_digest(self) -> None:
        """Every other manager alert reports something that happened; this one
        reports that something has *not*. Deferring it by up to a day is exactly
        how a safety net fails."""
        from .delivery import default_channel_preferences, is_digestible

        defaults = default_channel_preferences(NotificationType.ANNOUNCEMENT_PENDING)
        self.assertTrue(defaults["email_enabled"])
        self.assertTrue(defaults["push_enabled"])
        self.assertFalse(
            is_digestible(NotificationType.ANNOUNCEMENT_PENDING, NotificationLevel.INFO)
        )


class RouterDigestGatingTests(TestCase):
    """Routine INFO manager alerts are held back; urgent/non-digestible break through."""

    EMAIL = "notifications.router.send_notification_email_task.delay"
    PUSH = "notifications.router.send_push_notification_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="m1", email="m1@test.pl", password="pw123456"
        )
        self.profile = UserProfile.objects.create(
            user=self.user, role=AppRole.MANAGER, digest_enabled=True
        )

    def _route(self, ntype: str, level: str):
        from notifications.router import NotificationRouter
        with patch(self.EMAIL) as email, patch(self.PUSH) as push:
            NotificationRouter.route(
                recipient_id=str(self.user.id), notification_type=ntype,
                metadata={}, level=level,
            )
        return email, push

    def test_digestible_info_is_held_back(self) -> None:
        email, push = self._route(NotificationType.ATTENDANCE_SUBMITTED, NotificationLevel.INFO)
        email.assert_not_called()
        push.assert_not_called()

    def test_digestible_warning_breaks_through(self) -> None:
        # A WARNING escalation bypasses the digest hold and delivers in real time,
        # but still through the type's default channels only. Manager alerts default
        # to push-on / email-off (email is reserved for the daily digest), so the
        # break-through reaches push while email stays silent.
        email, push = self._route(NotificationType.PARTICIPATION_RESPONSE, NotificationLevel.WARNING)
        push.assert_called_once()
        email.assert_not_called()

    def test_non_digestible_is_delivered_immediately(self) -> None:
        email, push = self._route(NotificationType.REHEARSAL_SCHEDULED, NotificationLevel.INFO)
        email.assert_called_once()
        push.assert_called_once()

    def test_digest_disabled_restores_immediate_delivery(self) -> None:
        self.profile.digest_enabled = False
        self.profile.save(update_fields=["digest_enabled"])
        email, push = self._route(NotificationType.ATTENDANCE_SUBMITTED, NotificationLevel.INFO)
        email.assert_not_called()
        push.assert_called_once()

    def test_router_uses_shared_defaults_when_creating_preference(self) -> None:
        # Materials are preparation, not a commitment: push-on (subscribers only),
        # email-off. The lazily created row must reflect that contract, not the
        # model's blanket True.
        self.profile.digest_enabled = False
        self.profile.save(update_fields=["digest_enabled"])
        email, push = self._route(NotificationType.MATERIAL_UPLOADED, NotificationLevel.INFO)
        email.assert_not_called()
        push.assert_called_once()

        pref = NotificationPreference.objects.get(
            user=self.user,
            notification_type=NotificationType.MATERIAL_UPLOADED,
        )
        self.assertFalse(pref.email_enabled)
        self.assertTrue(pref.push_enabled)


class BriefingRoutingTests(TestCase):
    """A briefing is a delivery shape, not a category.

    Which events it gathers is an accident of how many things the conductor
    changed that week, so honouring the envelope's preference would let the fold
    overrule every per-type choice the reader made. Each item is answered by its
    own type instead.
    """

    EMAIL = "notifications.router.send_notification_email_task.delay"
    PUSH = "notifications.router.send_push_notification_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="br-route", email="br-route@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)

    def _briefing(self, *, with_calendar: bool = True) -> dict:
        return {
            "project_id": "8d79e557-2d1d-4c03-8454-cdc1b8da960d",
            "project_name": "Requiem",
            "note": "",
            "items": [
                {
                    "subject_type": "REHEARSAL",
                    "kind": "CHANGED",
                    "notification_type": NotificationType.REHEARSAL_UPDATED,
                    "level": NotificationLevel.WARNING,
                    "metadata": {"project_name": "Requiem"},
                },
                {
                    "subject_type": "CASTING",
                    "kind": "CREATED",
                    "notification_type": NotificationType.PIECE_CASTING_ASSIGNED,
                    "level": NotificationLevel.INFO,
                    "metadata": {"piece_title": "Pie Jesu", "voice_line": "S1"},
                },
            ],
            "ics": (
                [{"kind": "rehearsal", "uid": "r1@voct", "start": "x", "end": "y"}]
                if with_calendar else []
            ),
        }

    def _route(self, metadata: dict):
        from notifications.router import NotificationRouter

        with patch(self.EMAIL) as email, patch(self.PUSH) as push:
            NotificationRouter.route(
                recipient_id=str(self.user.id),
                notification_type=NotificationType.PROJECT_BRIEFING,
                metadata=metadata,
                level=NotificationLevel.WARNING,
            )
        return email, push

    def _types(self, mock) -> list[str]:
        return [
            item["notification_type"]
            for item in mock.call_args.kwargs["metadata"]["items"]
        ]

    def test_each_channel_carries_only_the_items_enabled_on_it(self) -> None:
        # Casting and rehearsals now share one group, so a divergence has to be
        # asked for — which is the case that matters anyway: a reader who
        # deliberately silenced one member of a group expects that to hold however
        # the news happens to travel.
        NotificationPreference.objects.create(
            user=self.user,
            notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
            email_enabled=False,
            push_enabled=True,
        )

        email, push = self._route(self._briefing())

        self.assertEqual(self._types(email), [NotificationType.REHEARSAL_UPDATED])
        self.assertEqual(
            self._types(push),
            [NotificationType.REHEARSAL_UPDATED, NotificationType.PIECE_CASTING_ASSIGNED],
        )

    def test_a_channel_with_nothing_enabled_is_not_written_to(self) -> None:
        for notification_type in (
            NotificationType.REHEARSAL_UPDATED,
            NotificationType.PIECE_CASTING_ASSIGNED,
        ):
            NotificationPreference.objects.create(
                user=self.user, notification_type=notification_type,
                email_enabled=False, push_enabled=True,
            )

        email, push = self._route(self._briefing())

        # Turning both off must not be overridden by the envelope's own tier — the
        # bypass this routing exists to close.
        email.assert_not_called()
        push.assert_called_once()

    def test_the_calendar_is_dropped_when_a_rehearsal_is_filtered_out(self) -> None:
        NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.REHEARSAL_UPDATED,
            email_enabled=False, push_enabled=False,
        )
        # Stated explicitly so the e-mail channel still has something to carry and
        # the dropped rehearsal is what the assertion is about.
        NotificationPreference.objects.create(
            user=self.user, notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
            email_enabled=True, push_enabled=True,
        )

        email, push = self._route(self._briefing())

        # The events were lifted out of their items at publication, so they cannot
        # be matched back one by one. An attachment naming a rehearsal this copy
        # never mentions would put a phantom date in the reader's diary.
        self.assertEqual(self._types(email), [NotificationType.PIECE_CASTING_ASSIGNED])
        self.assertEqual(email.call_args.kwargs["metadata"]["ics"], [])
        # Push carries no attachment at all, so nothing to strip there.
        self.assertEqual(self._types(push), [NotificationType.PIECE_CASTING_ASSIGNED])

    def test_the_calendar_survives_when_every_rehearsal_survives(self) -> None:
        email, _push = self._route(self._briefing())
        self.assertEqual(len(email.call_args.kwargs["metadata"]["ics"]), 1)

    def test_the_briefing_mints_no_preference_rows(self) -> None:
        self._route(self._briefing())

        # A briefing merely *mentioning* a type must not create a row for it —
        # that would freeze today's default as the reader's stated choice.
        self.assertFalse(
            NotificationPreference.objects.filter(user=self.user).exists()
        )

    def test_the_briefing_is_not_offered_as_a_preference(self) -> None:
        self.client.force_login(self.user)
        response = self.client.get("/api/notifications/preferences/")

        self.assertEqual(response.status_code, 200)
        offered = {row["notification_type"] for row in response.json()["preferences"]}
        self.assertNotIn(NotificationType.PROJECT_BRIEFING.value, offered)
        # The events it gathers are still individually addressable — that is the
        # whole point of routing per item.
        self.assertIn(NotificationType.REHEARSAL_UPDATED.value, offered)
        self.assertIn(NotificationType.PIECE_CASTING_ASSIGNED.value, offered)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://voctensemble.com",
    SITE_URL="https://voctensemble.com/panel",
)
class DigestSweepTests(TestCase):
    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="maestro", email="maestro@test.pl", password="pw123456", first_name="Maestro"
        )
        self.profile = UserProfile.objects.create(
            user=self.user, role=AppRole.MANAGER, digest_enabled=True,
            language="en", timezone="Europe/Warsaw",
        )
        # Pin digest_hour to "now" so the sweep fires this run.
        self._tz = ZoneInfo("Europe/Warsaw")
        self.profile.digest_hour = timezone.now().astimezone(self._tz).hour
        self.profile.save(update_fields=["digest_hour"])

    def _notif(self, ntype: str, meta: dict, level: str = NotificationLevel.INFO) -> Notification:
        return Notification.objects.create(
            recipient=self.user, notification_type=ntype, level=level, metadata=meta
        )

    def _sweep(self):
        from notifications.tasks import send_notification_digests
        return send_notification_digests()

    def test_digest_groups_items_and_sends_once(self) -> None:
        self._notif(NotificationType.ATTENDANCE_SUBMITTED,
                    {"artist_name": "Ada", "project_name": "Requiem", "action_details": "Present"})
        self._notif(NotificationType.ABSENCE_REQUESTED,
                    {"artist_name": "Bo", "project_name": "Requiem", "rehearsal_date": "19.06"})

        result = self._sweep()
        self.assertEqual(result["sent"], 1)
        self.assertEqual(len(mail.outbox), 1)
        msg = cast(EmailMultiAlternatives, mail.outbox[0])
        self.assertIn("2", msg.subject)
        html = str(msg.alternatives[0][0])
        self.assertIn("Ada", html)
        self.assertIn("Bo", html)
        self.assertIn("settings?tab=notifications", html)  # footer prefs link

        self.profile.refresh_from_db()
        self.assertIsNotNone(self.profile.last_digest_sent_at)

    def test_no_items_sends_nothing(self) -> None:
        self.assertEqual(self._sweep()["sent"], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_idempotent_within_the_day(self) -> None:
        self._notif(NotificationType.ATTENDANCE_SUBMITTED,
                    {"artist_name": "Ada", "project_name": "Requiem"})
        self._sweep()
        self._sweep()
        self.assertEqual(len(mail.outbox), 1)

    def test_warning_items_are_not_in_digest(self) -> None:
        # A WARNING participation decline is delivered in real time, not digested.
        self._notif(NotificationType.PARTICIPATION_RESPONSE,
                    {"artist_name": "Cy", "project_name": "Requiem"}, level=NotificationLevel.WARNING)
        self.assertEqual(self._sweep()["sent"], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_hour_mismatch_skips(self) -> None:
        self.profile.digest_hour = (timezone.now().astimezone(self._tz).hour + 1) % 24
        self.profile.save(update_fields=["digest_hour"])
        self._notif(NotificationType.ATTENDANCE_SUBMITTED, {"artist_name": "Ada"})
        self.assertEqual(self._sweep()["sent"], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_inactive_account_is_skipped_by_digest(self) -> None:
        # A not-yet-activated account is excluded from the digest sweep, matching
        # the real-time notification-email gate.
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self._notif(NotificationType.ATTENDANCE_SUBMITTED,
                    {"artist_name": "Ada", "project_name": "Requiem"})
        self.assertEqual(self._sweep()["sent"], 0)
        self.assertEqual(len(mail.outbox), 0)


class PreferenceDtoTests(SimpleTestCase):
    """SMS channel is fully removed from the preference contract."""

    def test_sms_field_is_rejected(self) -> None:
        from notifications.dtos import NotificationPreferenceUpdateDTO
        with self.assertRaises(ValidationError):
            NotificationPreferenceUpdateDTO(  # type: ignore[call-arg]
                user_id=1, notification_type="MESSAGE_RECEIVED", sms_enabled=True,
            )

    def test_email_only_toggle_is_valid(self) -> None:
        from notifications.dtos import NotificationPreferenceUpdateDTO
        dto = NotificationPreferenceUpdateDTO(
            user_id=1, notification_type="MESSAGE_RECEIVED", email_enabled=False,
        )
        self.assertFalse(dto.email_enabled)

    def test_requires_at_least_one_channel(self) -> None:
        from notifications.dtos import NotificationPreferenceUpdateDTO
        with self.assertRaises(ValidationError):
            NotificationPreferenceUpdateDTO(user_id=1, notification_type="MESSAGE_RECEIVED")


class ESPTrackingTests(TestCase):
    """Anymail bounce/complaint webhook → address suppression."""

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="b1", email="bounce@test.pl", password="pw123456"
        )
        self.profile = UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)

    def _fire(self, **kw) -> None:
        from notifications.signals import handle_esp_tracking
        base = {"recipient": self.user.email, "event_type": "", "reject_reason": None}
        base.update(kw)
        handle_esp_tracking(sender=None, event=SimpleNamespace(**base), esp_name="resend")
        self.profile.refresh_from_db()

    def test_hard_bounce_marks_undeliverable(self) -> None:
        self._fire(event_type="bounced", reject_reason="invalid")
        self.assertTrue(self.profile.email_undeliverable)

    def test_spam_complaint_marks_undeliverable(self) -> None:
        self._fire(event_type="complained")
        self.assertTrue(self.profile.email_undeliverable)

    def test_soft_bounce_does_not_suppress(self) -> None:
        self._fire(event_type="bounced", reject_reason="timed_out")
        self.assertFalse(self.profile.email_undeliverable)

    def test_unsubscribe_opts_out_of_operational(self) -> None:
        self._fire(event_type="unsubscribed")
        self.assertFalse(self.profile.email_notifications_enabled)
        self.assertFalse(self.profile.email_undeliverable)


class NotificationBadgeSeenTests(APITestCase):
    """The bell badge tracks 'new since seen': opening the centre (mark-seen)
    clears `new_count` without touching per-item read state (`unread_count`)."""

    UNREAD_COUNT_URL = "/api/notifications/unread-count/"
    MARK_SEEN_URL = "/api/notifications/mark-seen/"

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="seer", email="seer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.client.force_authenticate(self.user)

    def _notify(self) -> Notification:
        return Notification.objects.create(
            recipient=self.user,
            notification_type=NotificationType.REHEARSAL_REMINDER,
            level=NotificationLevel.INFO,
            metadata={},
        )

    def test_unread_count_reports_unread_and_new(self) -> None:
        self._notify()
        self._notify()
        resp = self.client.get(self.UNREAD_COUNT_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["unread_count"], 2)
        self.assertEqual(resp.data["new_count"], 2)

    def test_mark_seen_clears_new_but_keeps_unread(self) -> None:
        self._notify()
        self.client.post(self.MARK_SEEN_URL)
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.notifications_seen_at)
        resp = self.client.get(self.UNREAD_COUNT_URL)
        self.assertEqual(resp.data["unread_count"], 1)  # still unread per-item
        self.assertEqual(resp.data["new_count"], 0)  # but seen → badge cleared

    def test_notification_after_seen_counts_as_new_again(self) -> None:
        self.client.post(self.MARK_SEEN_URL)
        self._notify()
        resp = self.client.get(self.UNREAD_COUNT_URL)
        self.assertEqual(resp.data["new_count"], 1)


class EventTimeMetadataTests(SimpleTestCase):
    """The canonical event-moment contract: structured ISO in, localized display
    out, with legacy and malformed inputs degrading gracefully and never leaking
    a raw ISO timestamp into channel copy."""

    def test_normalize_timezone_name_walks_the_fallback_chain(self) -> None:
        from .time_metadata import normalize_timezone_name

        self.assertEqual(normalize_timezone_name("Europe/Warsaw", "UTC"), "Europe/Warsaw")
        self.assertEqual(normalize_timezone_name(None, "Europe/Warsaw"), "Europe/Warsaw")
        self.assertEqual(normalize_timezone_name("", "Europe/Warsaw"), "Europe/Warsaw")
        # Both the requested and the domain fallback are invalid → safe UTC.
        self.assertEqual(normalize_timezone_name("Invalid/Zone", "Also/Invalid"), "UTC")

    def test_format_event_time_renders_in_venue_timezone(self) -> None:
        from .time_metadata import format_event_time

        value = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)
        self.assertEqual(format_event_time(value, "Europe/Warsaw", "UTC"), "19.06.2026, 19:00")

    def test_format_event_time_tolerates_naive_datetime(self) -> None:
        from .time_metadata import format_event_time

        # A naive value must not raise; it is rendered as-is in the canonical format.
        rendered = format_event_time(datetime(2026, 6, 19, 17, 0), "Europe/Warsaw", "UTC")
        self.assertEqual(rendered, "19.06.2026, 17:00")

    def test_display_event_time_prefers_the_iso_moment_over_stored_copy(self) -> None:
        from .time_metadata import display_event_time

        # A past date keeps the assertion deterministic: the relative wording and
        # the year are both resolved against "now" at render time.
        meta = {
            "starts_at": "2020-06-19T17:00:00+00:00",
            "starts_at_display": "19.06.2020, 19:00",
            "timezone": "Europe/Warsaw",
        }
        # The stored display string is frozen at emission time and shared by every
        # recipient, so the ISO moment outranks it — that is what lets the copy
        # render in the reader's own language.
        with translation.override("en"):
            self.assertEqual(
                display_event_time(meta, "starts_at"), "Friday, 19 June 2020 at 19:00"
            )
        with translation.override("pl"):
            self.assertEqual(
                display_event_time(meta, "starts_at"), "piątek, 19 czerwca 2020 o 19:00"
            )
        # A multi-day range has no single moment to render, so its copy stands.
        self.assertEqual(display_event_time({"date_range_display": "19-21 June"}), "19-21 June")

    def test_display_event_time_formats_iso_in_timezone_without_leaking_raw(self) -> None:
        from .time_metadata import display_event_time

        with translation.override("en"):
            meta = {"starts_at": "2020-06-19T17:00:00+00:00", "timezone": "Europe/Warsaw"}
            rendered = display_event_time(meta)
            self.assertEqual(rendered, "Friday, 19 June 2020 at 19:00")
            self.assertNotIn("T", rendered)
            # A trailing-Z ISO value is normalized the same way.
            self.assertEqual(
                display_event_time(
                    {"starts_at": "2020-06-19T17:00:00Z", "timezone": "Europe/Warsaw"}
                ),
                "Friday, 19 June 2020 at 19:00",
            )

    def test_display_event_time_survives_bad_timezone(self) -> None:
        from .time_metadata import display_event_time

        meta = {"starts_at": "2020-06-19T17:00:00+00:00", "timezone": "Invalid/Zone"}
        # Falls back to the value's own offset (UTC) rather than raising.
        with translation.override("en"):
            self.assertEqual(display_event_time(meta), "Friday, 19 June 2020 at 17:00")

    def test_humanize_event_time_speaks_relative_days(self) -> None:
        from .time_metadata import humanize_event_time

        tomorrow = (timezone.localtime(timezone.now()) + timedelta(days=1)).replace(
            hour=19, minute=0
        )
        with translation.override("en"):
            self.assertEqual(humanize_event_time(tomorrow), "tomorrow at 19:00")
        with translation.override("pl"):
            self.assertEqual(humanize_event_time(tomorrow), "jutro o 19:00")

    def test_display_event_time_falls_back_to_legacy_keys(self) -> None:
        from .time_metadata import display_event_time

        # A legacy display string lives under starts_at (no "T") — treated as copy.
        self.assertEqual(
            display_event_time({"starts_at": "Thu 19 Jun, 19:00"}, "starts_at", "rehearsal_date"),
            "Thu 19 Jun, 19:00",
        )
        self.assertEqual(
            display_event_time({"rehearsal_date": "Thu 19 Jun"}, "starts_at", "rehearsal_date"),
            "Thu 19 Jun",
        )

    def test_display_event_time_returns_empty_when_nothing_is_known(self) -> None:
        from .time_metadata import display_event_time

        self.assertEqual(display_event_time({}, "starts_at", "rehearsal_date"), "")


class NotificationPreferenceSettingsAPITests(APITestCase):
    """The settings matrix (`/api/notifications/preferences/`) advertises the shared
    default contract, hides channel-scoped and role-scoped rows, never leaks one
    user's saved choice, and persists a single-channel toggle without disturbing the
    other channel's default."""

    URL = "/api/notifications/preferences/"

    def _detail_url(self, ntype: str) -> str:
        return f"{self.URL}{ntype}/"

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            username="pref-mgr", email="pref-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.artist = User.objects.create_user(
            username="pref-artist", email="pref-artist@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.artist, role=AppRole.ARTIST)

    def _matrix(self, user) -> dict:
        self.client.force_authenticate(user)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def _rows(self, user) -> dict[str, dict]:
        return {
            row["notification_type"]: row
            for row in self._matrix(user)["preferences"]
        }

    def test_unpersisted_rows_mirror_the_shared_default_contract(self) -> None:
        rows = self._rows(self.manager)
        for ntype, row in rows.items():
            expected = default_channel_preferences(ntype)
            self.assertEqual(
                (row["email_enabled"], row["push_enabled"]),
                (expected["email_enabled"], expected["push_enabled"]),
                f"{ntype}: settings default diverged from the shared contract",
            )

    def test_inert_and_offplatform_types_are_hidden_from_the_matrix(self) -> None:
        # No per-channel preference to express, so they never appear:
        #  CHANNEL_MESSAGE (per-channel push), NOTIFICATION_READ_RECEIPT (in-app
        #  only — never routed), CONTRACT_ISSUED (issued off-platform for now),
        #  SYSTEM_ALERT (no emitter yet, so the toggle would govern nothing).
        rows = self._rows(self.manager)
        for hidden in (
            NotificationType.CHANNEL_MESSAGE.value,
            NotificationType.NOTIFICATION_READ_RECEIPT.value,
            NotificationType.CONTRACT_ISSUED.value,
            NotificationType.SYSTEM_ALERT.value,
        ):
            self.assertNotIn(hidden, rows)

    def test_rows_carry_recommended_baseline_matching_the_contract(self) -> None:
        # The client needs the recommended baseline to flag "at default" rows and
        # offer Restore-recommended without re-deriving the backend policy.
        for ntype, row in self._rows(self.manager).items():
            expected = default_channel_preferences(ntype)
            self.assertEqual(
                (row["recommended_email"], row["recommended_push"]),
                (expected["email_enabled"], expected["push_enabled"]),
                f"{ntype}: recommended baseline diverged from the shared contract",
            )

    def test_manager_only_rows_are_hidden_from_artists(self) -> None:
        manager_only = {
            NotificationType.PARTICIPATION_RESPONSE.value,
            NotificationType.ATTENDANCE_SUBMITTED.value,
            NotificationType.ABSENCE_REQUESTED.value,
            # Only someone who may publish can answer an unpublished queue, and a
            # singer shown the row would read it as news about their own concert.
            NotificationType.ANNOUNCEMENT_PENDING.value,
        }
        artist_rows = self._rows(self.artist)
        self.assertTrue(manager_only.isdisjoint(artist_rows))
        self.assertTrue(manager_only.issubset(self._rows(self.manager)))

    def test_persisted_choice_overrides_the_default(self) -> None:
        # Casting email defaults ON since it joined the commitments group; a saved
        # opt-out must win over the default.
        NotificationPreference.objects.create(
            user=self.manager,
            notification_type=NotificationType.PIECE_CASTING_ASSIGNED,
            email_enabled=False,
            push_enabled=True,
        )
        row = self._rows(self.manager)[NotificationType.PIECE_CASTING_ASSIGNED.value]
        self.assertFalse(row["email_enabled"])
        self.assertTrue(row["push_enabled"])
        # …and it still reports the baseline it diverges from, so the ledger can
        # mark the row below-recommended rather than looking merely different.
        self.assertTrue(row["recommended_email"])

    def test_single_channel_toggle_seeds_untouched_channel_from_contract(self) -> None:
        # Materials email defaults OFF (≠ model default True). Toggling only push
        # must create the row with email seeded from the SSOT (False), not the
        # model's blanket True — proving the untouched channel follows the contract.
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(
            self._detail_url(NotificationType.MATERIAL_UPLOADED.value),
            {"push_enabled": False},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        pref = NotificationPreference.objects.get(
            user=self.manager, notification_type=NotificationType.MATERIAL_UPLOADED
        )
        self.assertFalse(pref.email_enabled)  # untouched channel keeps the SSOT default
        self.assertFalse(pref.push_enabled)

        row = self._rows(self.manager)[NotificationType.MATERIAL_UPLOADED.value]
        self.assertEqual((row["email_enabled"], row["push_enabled"]), (False, False))

    def test_single_channel_toggle_preserves_existing_other_channel(self) -> None:
        # An existing conscious choice on the other channel is never reset by a
        # later single-channel toggle.
        NotificationPreference.objects.create(
            user=self.manager,
            notification_type=NotificationType.REHEARSAL_SCHEDULED,
            email_enabled=True,
            push_enabled=False,  # user deliberately silenced push
        )
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(
            self._detail_url(NotificationType.REHEARSAL_SCHEDULED.value),
            {"email_enabled": False},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        pref = NotificationPreference.objects.get(
            user=self.manager, notification_type=NotificationType.REHEARSAL_SCHEDULED
        )
        self.assertFalse(pref.email_enabled)
        self.assertFalse(pref.push_enabled)  # preserved, not reset to the True default

    def test_bulk_put_applies_a_whole_section_in_one_request(self) -> None:
        # Restore-recommended sends the section's target state as one atomic PUT.
        self.client.force_authenticate(self.manager)
        resp = self.client.put(
            self.URL,
            {"preferences": [
                {"notification_type": NotificationType.REHEARSAL_SCHEDULED.value,
                 "email_enabled": False, "push_enabled": False},
                {"notification_type": NotificationType.PIECE_CASTING_ASSIGNED.value,
                 "email_enabled": True, "push_enabled": True},
            ]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        scheduled = NotificationPreference.objects.get(
            user=self.manager, notification_type=NotificationType.REHEARSAL_SCHEDULED
        )
        casting = NotificationPreference.objects.get(
            user=self.manager, notification_type=NotificationType.PIECE_CASTING_ASSIGNED
        )
        self.assertEqual((scheduled.email_enabled, scheduled.push_enabled), (False, False))
        self.assertEqual((casting.email_enabled, casting.push_enabled), (True, True))

    def test_bulk_put_rejects_an_empty_payload(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.put(self.URL, {"preferences": []}, format="json")
        self.assertEqual(resp.status_code, 400)


class PreferenceGroupPolicyTests(SimpleTestCase):
    """The group map is the SSOT the ledger and the router both read.

    These cover the invariants that make a *group* control honest: it governs
    every type it claims to, it promises only what its members share, and no type
    is left outside the map where it would render its raw English Django label.
    """

    def test_every_notification_type_is_placed_exactly_once(self) -> None:
        from .delivery import assert_preference_policy_is_coherent
        assert_preference_policy_is_coherent()

    def test_a_controllable_group_governs_what_it_promises(self) -> None:
        # The whole premise of one switch over several types: every member must
        # already answer the way the group's control says it does, or the reader
        # is shown a position their events do not hold.
        from .delivery import PREFERENCE_GROUPS, default_channel_preferences

        for group in PREFERENCE_GROUPS:
            if not group.controllable:
                continue
            for ntype in group.types:
                defaults = default_channel_preferences(ntype)
                self.assertEqual(
                    (defaults["email_enabled"], defaults["push_enabled"]),
                    (group.email, group.push),
                    f"{ntype} does not follow its own group '{group.id}'",
                )

    def test_casting_is_a_commitment(self) -> None:
        # The load-bearing move of the group rewrite. "You now sing S2 instead of
        # S1" changes what the reader has to prepare, so it travels with the moved
        # rehearsal rather than with the new sheet music.
        from .delivery import GROUP_OF_TYPE, default_channel_preferences

        for ntype in (
            NotificationType.PIECE_CASTING_ASSIGNED,
            NotificationType.PIECE_CASTING_UPDATED,
        ):
            self.assertEqual(GROUP_OF_TYPE[ntype], "commitments")
            self.assertTrue(default_channel_preferences(ntype)["email_enabled"])

    def test_everything_a_briefing_can_carry_shares_one_group(self) -> None:
        # The invariant that retires the fold's bypass in practice. The router
        # still filters a briefing per item — that stays as the enforcement — but
        # while every briefable type shares one control, a reader cannot end up
        # with a preference the fold has to work around.
        #
        # Read from QUEUEABLE_TYPES rather than from a list written out here: a
        # list would pass unchanged the day a new emitter starts queueing a type
        # nobody added to it, which is the one case this test exists for.
        from .announcements import QUEUEABLE_TYPES
        from .delivery import GROUP_OF_TYPE

        self.assertEqual(
            {GROUP_OF_TYPE[ntype] for ntype in QUEUEABLE_TYPES},
            {"commitments"},
        )

    def test_queueing_an_undeclared_type_is_refused(self) -> None:
        # The other half of the same invariant: the declaration is only worth
        # something if a type outside it cannot reach the queue.
        from .announcements import queue_broadcast
        from .models import AnnouncementKind, AnnouncementSubject

        with self.assertRaises(ValueError):
            queue_broadcast(
                project=None,  # type: ignore[arg-type]
                subject_type=AnnouncementSubject.PROJECT,
                subject_id="x",
                kind=AnnouncementKind.CHANGED,
                notification_type=NotificationType.MATERIAL_UPLOADED,
            )

    def test_a_type_with_no_control_has_no_group(self) -> None:
        # A group *is* a control, so the types kept out of the ledger are exactly
        # the types outside the group map — one rule, not two lists to keep in step.
        from .delivery import GROUP_OF_TYPE, HIDDEN_FROM_PREFS

        self.assertTrue(HIDDEN_FROM_PREFS.isdisjoint(GROUP_OF_TYPE))
        self.assertIn(NotificationType.PROJECT_BRIEFING.value, HIDDEN_FROM_PREFS)


class PreferenceLedgerShapeTests(APITestCase):
    """What the settings ledger hands the client: groups in render order, and the
    rows behind each one tagged with the group that speaks for them."""

    URL = "/api/notifications/preferences/"

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            username="ledger-mgr", email="ledger-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.artist = User.objects.create_user(
            username="ledger-artist", email="ledger-artist@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.artist, role=AppRole.ARTIST)

    def _matrix(self, user) -> dict:
        self.client.force_authenticate(user)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def test_groups_arrive_in_render_order_with_the_reader_first(self) -> None:
        matrix = self._matrix(self.manager)
        self.assertEqual(
            [group["id"] for group in matrix["groups"]],
            ["commitments", "messages", "materials", "team"],
        )

    def test_every_row_names_a_group_the_response_declares(self) -> None:
        matrix = self._matrix(self.manager)
        declared = {group["id"] for group in matrix["groups"]}
        for row in matrix["preferences"]:
            self.assertIn(row["group"], declared)
        # …and no group arrives empty, which would render as a control over nothing.
        self.assertEqual(declared, {row["group"] for row in matrix["preferences"]})

    def test_a_controllable_group_states_the_recommendation_it_targets(self) -> None:
        groups = {g["id"]: g for g in self._matrix(self.manager)["groups"]}
        self.assertEqual(
            (groups["commitments"]["recommended_email"], groups["commitments"]["controllable"]),
            (True, True),
        )
        self.assertEqual(groups["materials"]["recommended_email"], False)

    def test_a_group_whose_members_disagree_promises_nothing(self) -> None:
        # Team ops mixes three digestible alerts with the queue's safety net, so it
        # offers no group switch and states no recommendation of its own — its rows
        # carry theirs individually.
        team = {g["id"]: g for g in self._matrix(self.manager)["groups"]}["team"]
        self.assertFalse(team["controllable"])
        self.assertIsNone(team["recommended_email"])

        rows = {
            row["notification_type"]: row
            for row in self._matrix(self.manager)["preferences"]
        }
        self.assertFalse(rows[NotificationType.ATTENDANCE_SUBMITTED.value]["recommended_email"])
        self.assertTrue(rows[NotificationType.ANNOUNCEMENT_PENDING.value]["recommended_email"])

    def test_the_manager_group_is_absent_entirely_for_an_artist(self) -> None:
        matrix = self._matrix(self.artist)
        self.assertNotIn("team", {group["id"] for group in matrix["groups"]})
        self.assertNotIn(
            NotificationType.ANNOUNCEMENT_PENDING.value,
            {row["notification_type"] for row in matrix["preferences"]},
        )


class CastingDefaultReleaseMigrationTests(TestCase):
    """The casting rows the router minted on the reader's behalf.

    Flipping casting e-mail ON is only a default change for someone with no stored
    row — and the router creates one on first delivery. The migration releases
    exactly the rows that hold the old default on both channels, and nothing else.
    """

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="casting-default", email="casting-default@test.pl", password="pw123456"
        )

    def _run(self) -> None:
        from importlib import import_module

        from django.apps import apps as global_apps

        # The migration module name is not an identifier, so it is imported rather
        # than `from`-imported. Running the real function keeps this a test of the
        # rule that ships, not of a copy of it.
        migration = import_module(
            "notifications.migrations.0014_release_casting_email_default"
        )
        migration.release_system_seeded_casting_rows(global_apps, None)

    def _pref(self, ntype: str, *, email: bool, push: bool) -> NotificationPreference:
        return NotificationPreference.objects.create(
            user=self.user, notification_type=ntype, email_enabled=email, push_enabled=push,
        )

    def test_a_row_at_the_old_default_is_released(self) -> None:
        self._pref(NotificationType.PIECE_CASTING_ASSIGNED, email=False, push=True)
        self._run()
        # Gone, so the reader floats up to the new default instead of being pinned
        # to a choice the system made for them.
        self.assertFalse(
            NotificationPreference.objects.filter(
                user=self.user, notification_type=NotificationType.PIECE_CASTING_ASSIGNED
            ).exists()
        )

    def test_a_row_expressing_a_real_choice_survives(self) -> None:
        # Push off is an opinion nobody else could have written; the row stays, and
        # with it the e-mail value beside it.
        self._pref(NotificationType.PIECE_CASTING_UPDATED, email=False, push=False)
        self._run()
        pref = NotificationPreference.objects.get(
            user=self.user, notification_type=NotificationType.PIECE_CASTING_UPDATED
        )
        self.assertEqual((pref.email_enabled, pref.push_enabled), (False, False))

    def test_no_other_type_is_touched(self) -> None:
        self._pref(NotificationType.MATERIAL_UPLOADED, email=False, push=True)
        self._run()
        self.assertTrue(
            NotificationPreference.objects.filter(
                user=self.user, notification_type=NotificationType.MATERIAL_UPLOADED
            ).exists()
        )


class AnnouncementNudgeCopyTests(SimpleTestCase):
    """How the queue's safety net reads.

    The nudge exists to be answered, so most of what matters here is that it lands
    the reader on the review sheet in one tap and states honest numbers on the way.
    """

    META: ClassVar[dict[str, object]] = {
        "project_id": "8d79e557-2d1d-4c03-8454-cdc1b8da960d",
        "project_name": "Requiem",
        "change_count": 3,
        "recipient_count": 12,
        "waiting_hours": 26,
    }

    def _build(self, **overrides):
        return MessageContentBuilder.build(
            NotificationType.ANNOUNCEMENT_PENDING,
            NotificationLevel.WARNING,
            {**self.META, **overrides},
            is_manager=True,
        )

    def test_the_link_opens_the_review_sheet_not_just_the_project(self) -> None:
        """A nudge that lands the reader somewhere they still have to go looking is
        the same silence with extra steps."""
        with translation.override("en"):
            content = self._build()
        self.assertEqual(
            content.url_path,
            f"/panel/projects/{self.META['project_id']}?announce=1",
        )
        self.assertEqual(content.actions[0].url, content.url_path)

    def test_the_tag_is_per_project_so_a_second_nudge_replaces_the_first(self) -> None:
        with translation.override("en"):
            first = self._build()
            again = self._build(change_count=5, waiting_hours=50)
            other = self._build(project_id="0f2b1c64-1111-4c03-8454-cdc1b8da960d")
        self.assertEqual(first.tag, again.tag)
        self.assertNotEqual(first.tag, other.tag)

    def test_waiting_reads_in_hours_below_two_days_and_days_beyond(self) -> None:
        with translation.override("en"):
            self.assertIn("26 hours", self._build(waiting_hours=26).body)
            self.assertIn("3 days", self._build(waiting_hours=74).body)

    def test_a_queue_just_over_the_fuse_never_reads_as_zero(self) -> None:
        """Integer hours floor to 0 inside the first hour, and "waiting 0 hours"
        would read as a bug in the very message meant to restore trust."""
        with translation.override("en"):
            self.assertIn("1 hour", self._build(waiting_hours=0).body)

    def test_polish_gets_all_three_plural_forms(self) -> None:
        with translation.override("pl"):
            one = self._build(change_count=1).body
            few = self._build(change_count=3).body
            many = self._build(change_count=5).body
        self.assertIn("1 zmiana", one)
        self.assertIn("3 zmiany", few)
        self.assertIn("5 zmian", many)

    def test_the_project_is_named_on_every_surface(self) -> None:
        with translation.override("en"):
            content = self._build()
        self.assertIn("Requiem", content.title)
        self.assertIn("Requiem", content.subject)
        self.assertIn("Requiem", content.email_lead)
        self.assertIn("Requiem", next(row.value for row in content.details))

    def test_a_cast_of_nobody_leaves_the_row_out_rather_than_saying_zero(self) -> None:
        with translation.override("en"):
            labels = [row.label for row in self._build(recipient_count=0).details]
        self.assertNotIn("Not yet told", labels)
