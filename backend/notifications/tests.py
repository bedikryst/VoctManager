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
from types import SimpleNamespace
from typing import cast
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

from .email_service import EmailDispatcherService, EmailType
from .message_content import (
    _COMPOSERS,
    MessageContent,
    MessageContentBuilder,
    PushPayload,
)
from .models import Notification, NotificationLevel, NotificationType

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
            self.assertIn("Ada", c.body)
            self.assertIn("15", c.body)
            # The old half-English "Status: LATE. Note:" prose must be gone.
            self.assertNotIn("Status:", c.body)

    def test_participation_status_renders_phrase(self) -> None:
        with translation.override("en"):
            c = MessageContentBuilder.build(
                NotificationType.PARTICIPATION_RESPONSE, "INFO",
                {"artist_name": "Bo", "project_name": "Requiem", "status": "DEC"},
                is_manager=True,
            )
            self.assertIn("declined", c.body.lower())
            self.assertNotIn("Changed status", c.body)

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


class LocalizedRenderTests(SimpleTestCase):
    """The compiled .mo catalogs render the warm copy in PL/FR (no English leak)."""

    def test_polish_casting_uses_native_copy(self) -> None:
        with translation.override("pl"):
            c = MessageContentBuilder.build(
                NotificationType.PIECE_CASTING_ASSIGNED, "INFO",
                {"piece_title": "Lacrimosa", "voice_line": "Alt"}, is_manager=False,
            )
            self.assertIn("Śpiewasz", c.title)
            self.assertIn("nuty", c.body)

    def test_polish_participation_has_no_english_leak(self) -> None:
        with translation.override("pl"):
            c = MessageContentBuilder.build(
                NotificationType.PARTICIPATION_RESPONSE, "INFO",
                {"artist_name": "Ada", "project_name": "Requiem", "status": "DEC"},
                is_manager=True,
            )
            self.assertIn("rezygnuje", c.body)
            self.assertNotIn("declined", c.body.lower())


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
        email, push = self._route(NotificationType.PARTICIPATION_RESPONSE, NotificationLevel.WARNING)
        email.assert_called_once()
        push.assert_called_once()

    def test_non_digestible_is_delivered_immediately(self) -> None:
        email, push = self._route(NotificationType.REHEARSAL_REMINDER, NotificationLevel.INFO)
        email.assert_called_once()
        push.assert_called_once()

    def test_digest_disabled_restores_immediate_delivery(self) -> None:
        self.profile.digest_enabled = False
        self.profile.save(update_fields=["digest_enabled"])
        email, push = self._route(NotificationType.ATTENDANCE_SUBMITTED, NotificationLevel.INFO)
        email.assert_called_once()
        push.assert_called_once()


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
