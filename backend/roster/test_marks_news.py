"""
@file test_marks_news.py
@description "Powiadom chór": what the button offers and what a press sends.

    Only choir marks that said something new since the cast was last told are
    news — a tidy is not, nor an undo, while a restored set is. A press sends
    one notice per live cast member, withholds instrumental items from the
    singers, stamps the project, and cannot be repeated within the cooldown; a
    notice the task queue refuses leaves the stamp where it was. A manager or
    the podium conductor may press it; a singer may not.

@module roster/test_marks_news
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
)
from archive.test_annotation_integrity import _MarksFixture
from core.constants import AppRole, VoiceLine
from core.models import UserProfile
from notifications.models import NotificationType
from roster.marks_news import MARKS_NOTICE_COOLDOWN
from roster.models import Artist, Participation, ProjectPieceCasting, VoiceType

_TASK = "roster.marks_news.send_bulk_notifications_task"


class MarksNewsTests(_MarksFixture):
    def setUp(self) -> None:
        super().setUp()
        self.url = f"/api/projects/{self.project.pk}/"
        conductor_user = get_user_model().objects.create_user(
            "maestro", "maestro@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=conductor_user, role=AppRole.ARTIST)
        self.project.conductor = Artist.objects.create(
            user=conductor_user, first_name="Jan", last_name="Maestro",
            email="maestro@test.pl", voice_type=VoiceType.CONDUCTOR,
        )
        self.project.save(update_fields=["conductor"])
        self.conductor_user = conductor_user

    def _news(self, user=None):
        self.client.force_authenticate(user or self.manager)
        return self.client.get(f"{self.url}marks_news/")

    def _press(self, user=None):
        self.client.force_authenticate(user or self.manager)
        with patch(_TASK) as task, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{self.url}notify_marks/")
        return response, task.delay

    def _piece_titles(self, response) -> list[str]:
        return [piece["title"] for piece in response.json()["pieces"]]

    def test_only_new_choir_marks_are_news(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._mark(self.manager, CONDUCTOR_ANNOTATION_LAYER, edition=self.second_edition)
        self._mark(self.singer_user, PERSONAL_ANNOTATION_LAYER, edition=self.second_edition)

        news = self._news()
        self.assertEqual(news.status_code, 200, news.content)
        self.assertEqual(self._piece_titles(news), ["Dixit Dominus"])
        self.assertEqual(news.json()["pieces"][0]["count"], 1)
        self.assertEqual(news.json()["recipients"], 3)
        self.assertIsNone(news.json()["notified_at"])

    def test_marks_older_than_the_project_are_not_news(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        Annotation.objects.filter(pk=mark.pk).update(
            content_at=self.project.created_at - timedelta(days=300),
        )
        self.assertEqual(self._news().json()["pieces"], [])

    def test_a_set_aside_mark_is_not_news(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, archived_at=timezone.now())
        self.assertEqual(self._news().json()["pieces"], [])

    def test_a_press_tells_every_live_seat_and_stamps_the_project(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        response, delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["recipients"], 3)
        self.assertEqual(response.json()["pieces"], 1)

        delay.assert_called_once()
        kwargs = delay.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.SCORE_MARKS_SHARED)
        self.assertEqual(
            sorted(kwargs["recipient_ids"]),
            sorted(str(u.pk) for u in (self.singer_user, self.other_user, self.deputy_user)),
        )
        self.assertEqual(
            [piece["title"] for piece in kwargs["metadata"]["pieces"]], ["Dixit Dominus"],
        )
        self.project.refresh_from_db()
        self.assertIsNotNone(self.project.marks_notified_at)

    def test_after_a_press_a_tidy_is_not_news_but_new_words_are(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._press()
        told_at = timezone.now() - timedelta(minutes=1)
        self.project.marks_notified_at = told_at
        self.project.save(update_fields=["marks_notified_at"])
        Annotation.objects.filter(pk=mark.pk).update(
            content_at=told_at - timedelta(minutes=1), updated_at=timezone.now(),
        )
        self.assertEqual(self._news().json()["pieces"], [])
        Annotation.objects.filter(pk=mark.pk).update(content_at=told_at + timedelta(seconds=30))
        self.assertEqual(self._piece_titles(self._news()), ["Dixit Dominus"])

    def test_a_second_press_waits_for_the_cooldown(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._press()
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition)
        response, delay = self._press()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "too_soon")
        self.assertIsNotNone(response.json()["next_allowed_at"])
        self.assertIsNotNone(self._news().json()["next_allowed_at"])
        delay.assert_not_called()

    def test_nothing_new_after_the_cooldown_is_refused(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._press()
        self.project.refresh_from_db()
        told_at = self.project.marks_notified_at
        assert told_at is not None
        told_at -= MARKS_NOTICE_COOLDOWN + timedelta(minutes=1)
        self.project.marks_notified_at = told_at
        self.project.save(update_fields=["marks_notified_at"])
        Annotation.objects.filter(pk=mark.pk).update(content_at=told_at - timedelta(minutes=1))
        response, delay = self._press()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "nothing_new")
        delay.assert_not_called()

    def test_a_notice_the_queue_refuses_puts_the_stamp_back(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.client.force_authenticate(self.manager)
        with patch(_TASK) as task:
            task.delay.side_effect = ConnectionError("broker down")
            response = self.client.post(f"{self.url}notify_marks/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "unavailable")
        self.project.refresh_from_db()
        self.assertIsNone(self.project.marks_notified_at)
        news = self._news().json()
        self.assertEqual([piece["title"] for piece in news["pieces"]], ["Dixit Dominus"])
        self.assertIsNone(news["next_allowed_at"])
        retried, delay = self._press()
        self.assertEqual(retried.status_code, 200, retried.content)
        delay.assert_called_once()

    def test_undoing_a_mistaken_clear_offers_the_choir_nothing(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        told_at = timezone.now() - MARKS_NOTICE_COOLDOWN - timedelta(minutes=1)
        self.project.marks_notified_at = told_at
        self.project.save(update_fields=["marks_notified_at"])
        Annotation.objects.filter(pk=mark.pk).update(content_at=told_at - timedelta(minutes=1))
        self.client.force_authenticate(self.manager)
        cleared = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": str(self.edition.pk), "ids": [str(mark.pk)]}, format="json",
        )
        self.assertEqual(cleared.json()["deleted"], 1)
        undone = self.client.post(
            "/api/archive/annotations/restore/", {"ids": [str(mark.pk)]}, format="json",
        )
        self.assertEqual(len(undone.json()["restored"]), 1)
        self.assertEqual(self._news().json()["pieces"], [])

    def test_a_finished_concert_has_nobody_to_tell(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.project.status = self.project.Status.COMPLETED
        self.project.save(update_fields=["status"])
        self.assertEqual(self._news().json()["recipients"], 0)
        response, _delay = self._press()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "nobody")

    def test_the_podium_may_press_and_a_singer_may_not(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.assertEqual(self._news(self.singer_user).status_code, 403)
        response, _delay = self._press(self.singer_user)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._news(self.conductor_user).status_code, 200)
        response, _delay = self._press(self.conductor_user)
        self.assertEqual(response.status_code, 200, response.content)

    def test_singers_are_not_told_about_an_instrumental_item(self) -> None:
        player_user = get_user_model().objects.create_user("organ", "organ@test.pl", "pw123456")
        UserProfile.objects.create(user=player_user, role=AppRole.ARTIST)
        player = Artist.objects.create(
            user=player_user, first_name="Ola", last_name="Organ", email="organ@test.pl",
            voice_type=VoiceType.INSTRUMENTALIST, instrument="Organy",
        )
        seat = Participation.objects.create(
            artist=player, project=self.project, status=Participation.Status.CONFIRMED,
        )
        organ_piece = self.second_edition.piece
        assert organ_piece is not None
        ProjectPieceCasting.objects.create(
            participation=seat, piece=organ_piece,
            voice_line=VoiceLine.ACCOMPANIMENT,
        )
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition)

        response, delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        sent = {
            tuple(call.kwargs["recipient_ids"]): [
                piece["title"] for piece in call.kwargs["metadata"]["pieces"]
            ]
            for call in delay.call_args_list
        }
        self.assertEqual(sent[(str(player_user.pk),)], ["Dixit Dominus", "Laudate pueri"])
        singers = tuple(
            sorted(str(u.pk) for u in (self.singer_user, self.other_user, self.deputy_user)),
        )
        self.assertEqual(sent[singers], ["Dixit Dominus"])

    def _make_soprano(self, user) -> None:
        Artist.objects.filter(user=user).update(voice_type=VoiceType.SOPRANO)

    def test_a_mark_for_one_voice_is_news_to_that_voice_only(self) -> None:
        self._make_soprano(self.other_user)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["T"])
        self.assertEqual(self._news().json()["recipients"], 2)

        response, delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        delay.assert_called_once()
        self.assertEqual(
            sorted(delay.call_args.kwargs["recipient_ids"]),
            sorted(str(u.pk) for u in (self.singer_user, self.deputy_user)),
        )

    def test_each_voice_hears_of_the_pieces_addressed_to_it(self) -> None:
        self._make_soprano(self.other_user)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["T"])
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition, voices=["S"])
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition, voices=["T"])

        response, delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["recipients"], 3)
        sent = {
            tuple(sorted(call.kwargs["recipient_ids"])): [
                piece["title"] for piece in call.kwargs["metadata"]["pieces"]
            ]
            for call in delay.call_args_list
        }
        tenors = tuple(sorted(str(u.pk) for u in (self.singer_user, self.deputy_user)))
        self.assertEqual(sent[tenors], ["Dixit Dominus", "Laudate pueri"])
        self.assertEqual(sent[(str(self.other_user.pk),)], ["Laudate pueri"])

    def test_one_tutti_mark_makes_the_piece_news_to_everyone(self) -> None:
        self._make_soprano(self.other_user)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["T"])
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self.assertEqual(self._news().json()["recipients"], 3)

    def test_a_mark_for_a_voice_nobody_sings_names_that_voice(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["B"])
        news = self._news().json()
        self.assertEqual(news["pieces"], [])
        self.assertEqual(news["recipients"], 0)
        self.assertEqual(news["unreached_sections"], "B")
        response, delay = self._press()
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["code"], "unreached")
        self.assertEqual(response.json()["sections"], "B")
        delay.assert_not_called()

    def test_a_piece_nobody_would_hear_of_is_not_on_offer(self) -> None:
        self._mark(self.manager, SHARED_ANNOTATION_LAYER)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition, voices=["B"])
        news = self._news().json()
        self.assertEqual([piece["title"] for piece in news["pieces"]], ["Dixit Dominus"])
        self.assertEqual(news["unreached_sections"], "B")
        response, _delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["pieces"], 1)

    def test_a_cast_without_accounts_is_told_apart_from_a_missing_voice(self) -> None:
        Artist.objects.filter(user__isnull=False).exclude(
            voice_type=VoiceType.CONDUCTOR,
        ).update(user=None)
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["B"])
        news = self._news().json()
        self.assertEqual(self._piece_titles(self._news()), ["Dixit Dominus"])
        self.assertEqual(news["unreached_sections"], "")
        response, _delay = self._press()
        self.assertEqual(response.json()["code"], "nobody")

    def test_the_line_a_piece_casts_a_singer_on_reaches_them(self) -> None:
        piece = self.edition.piece
        assert piece is not None
        seat = Participation.objects.get(artist__user=self.other_user, project=self.project)
        ProjectPieceCasting.objects.create(
            participation=seat, piece=piece, voice_line=VoiceLine.BASS_1,
        )
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["B"])
        self._mark(self.manager, SHARED_ANNOTATION_LAYER, edition=self.second_edition, voices=["B"])

        response, delay = self._press()
        self.assertEqual(response.status_code, 200, response.content)
        delay.assert_called_once()
        self.assertEqual(delay.call_args.kwargs["recipient_ids"], [str(self.other_user.pk)])
        self.assertEqual(
            [piece["title"] for piece in delay.call_args.kwargs["metadata"]["pieces"]],
            ["Dixit Dominus"],
        )
