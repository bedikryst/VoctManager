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
from typing import cast

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import translation

from core.constants import AppRole
from core.models import UserProfile

from .email_service import EmailDispatcherService, EmailType
from .message_content import (
    _COMPOSERS,
    MessageContent,
    MessageContentBuilder,
    PushPayload,
)
from .models import NotificationLevel, NotificationType

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

    def test_operational_email_respects_opt_out(self) -> None:
        self.user.profile.email_notifications_enabled = False
        self.user.profile.save(update_fields=["email_notifications_enabled"])
        self._dispatch(NotificationType.REHEARSAL_SCHEDULED, metadata={"project_name": "Requiem"})
        self.assertEqual(len(mail.outbox), 0)

    def test_bespoke_message_template_uses_layer_subject(self) -> None:
        self._dispatch(
            NotificationType.MESSAGE_RECEIVED,
            template="message_received",
            metadata={"title": "Rehearsal note", "sender_name": "Krystian",
                      "message": "See you Thursday", "thread_id": "t1"},
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Rehearsal note", mail.outbox[0].subject)
