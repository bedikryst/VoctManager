"""
@file test_score_marks_shared.py
@description The notice "Powiadom chór" sends: one piece opens that piece, several
    open the library, every piece is named, and a project title typed with a line
    break cannot break the e-mail's subject. It sits with the materials: push on,
    e-mail off by default, and both halves of the e-mail render for whoever
    turns it on.

@module notifications/test_score_marks_shared
"""

from __future__ import annotations

from typing import cast

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import translation

from core.constants import AppRole
from core.models import UserProfile
from notifications.delivery import GROUP_OF_TYPE, default_channel_preferences
from notifications.email_service import EmailDispatcherService, EmailType
from notifications.message_content import MessageContentBuilder
from notifications.models import NotificationLevel, NotificationType

_PROJECT = "00000000-0000-4000-8000-000000000001"


def _piece(n: int) -> dict[str, str]:
    return {
        "piece_id": f"00000000-0000-4000-8000-{n:012d}",
        "title": f"Motet {n}",
        "composer_name": "Anon.",
    }


class ScoreMarksSharedContentTests(SimpleTestCase):
    def _build(self, pieces: list[dict[str, str]], project: str = "Nieszpory"):
        with translation.override("pl"):
            return MessageContentBuilder.build(
                notification_type=NotificationType.SCORE_MARKS_SHARED,
                level=NotificationLevel.INFO,
                metadata={
                    "project_id": _PROJECT,
                    "project_name": project,
                    "event_kind": "CONCERT",
                    "pieces": pieces,
                },
                is_manager=False,
            )

    def test_one_piece_opens_that_piece(self) -> None:
        content = self._build([_piece(4)])
        self.assertEqual(content.notification_type, NotificationType.SCORE_MARKS_SHARED)
        self.assertIn("Motet 4", content.title)
        self.assertEqual(content.url_path, f"/panel/materials/{_PROJECT}/{_piece(4)['piece_id']}")
        self.assertEqual(content.tag, f"score-marks:{_PROJECT}")

    def test_several_pieces_open_the_library_and_are_all_named(self) -> None:
        pieces = [_piece(n) for n in range(1, 11)]
        content = self._build(pieces)
        self.assertEqual(content.url_path, "/panel/materials")
        self.assertIn("10", content.title)
        # The project row, eight pieces, and one row for the rest.
        self.assertEqual(len(content.details), 10)

    def test_a_line_break_in_the_title_never_reaches_the_subject(self) -> None:
        content = self._build([_piece(1)], project="Nieszpory\nmaryjne")
        self.assertNotIn("\n", content.subject)
        self.assertIn("Nieszpory maryjne", content.subject)

    def test_it_sits_with_the_materials(self) -> None:
        self.assertEqual(GROUP_OF_TYPE[NotificationType.SCORE_MARKS_SHARED], "materials")
        self.assertEqual(
            default_channel_preferences(NotificationType.SCORE_MARKS_SHARED),
            {"email_enabled": False, "push_enabled": True},
        )


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://voctensemble.com",
    SITE_URL="https://voctensemble.com/panel",
)
class ScoreMarksSharedEmailTests(TestCase):
    """For whoever turns the e-mail on: both halves name the piece and link to it."""

    def test_both_templates_name_the_piece_and_link_to_it(self) -> None:
        user = get_user_model().objects.create_user(
            "a1", "a1@test.pl", "pw123456", first_name="Jan",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST, language="pl")
        EmailDispatcherService.dispatch_from_notification(
            recipient_id=str(user.id),
            notification_type=NotificationType.SCORE_MARKS_SHARED,
            template_name="transactional",
            metadata={
                "project_id": _PROJECT,
                "project_name": "Nieszpory",
                "event_kind": "CONCERT",
                "pieces": [_piece(4)],
            },
            level=NotificationLevel.INFO,
            email_type=EmailType.OPERATIONAL,
        )
        self.assertEqual(len(mail.outbox), 1)
        message = cast(EmailMultiAlternatives, mail.outbox[0])
        link = f"https://voctensemble.com/panel/materials/{_PROJECT}/{_piece(4)['piece_id']}"
        for body in (str(message.alternatives[0][0]), message.body):
            self.assertIn("Motet 4", body)
            self.assertIn(link, body)
