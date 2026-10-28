"""
@file test_annotation_voices.py
@description Marks addressed to voices.

    A mark names sections, stored in SATB order, with tutti as an empty list
    whichever way it was spelled; anything else is refused, and neither a
    private pencil nor the conductor's desk carries voices. Opening a mark to a
    voice it did not reach is news to that voice, narrowing it is not. The
    fingerprint tells the stand which sections its reader answers to, from
    their seat on the music and the line each piece casts them on.

@module archive/test_annotation_voices
"""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from archive.annotation_voices import addresses, clean_mark_voices, widens
from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
)
from archive.test_annotation_integrity import _ENDPOINT, _MarksFixture
from core.constants import VoiceLine
from roster.models import Participation, Project, ProjectPieceCasting, VoiceType


class VoiceRulesTests(_MarksFixture):
    def test_voices_are_stored_in_score_order_and_tutti_has_one_spelling(self) -> None:
        self.assertEqual(clean_mark_voices(["T", "S", "T"]), ["S", "T"])
        self.assertEqual(clean_mark_voices(["B", "T", "A", "S"]), [])
        self.assertEqual(clean_mark_voices([]), [])

    def test_a_reader_with_no_section_is_addressed_by_everything(self) -> None:
        self.assertTrue(addresses(["T"], "T"))
        self.assertTrue(addresses(["T"], "TB"))
        self.assertFalse(addresses(["T"], "S"))
        self.assertTrue(addresses(["T"], ""))
        self.assertTrue(addresses([], "S"))
        self.assertTrue(addresses(None, "S"))

    def test_only_reaching_a_new_voice_widens_a_mark(self) -> None:
        self.assertTrue(widens(["T"], []))
        self.assertTrue(widens(["T"], ["S", "T"]))
        self.assertFalse(widens([], ["T"]))
        self.assertFalse(widens(["S", "T"], ["T"]))
        self.assertFalse(widens([], []))

    def test_a_create_stores_the_cleaned_voices(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            _ENDPOINT,
            self._body(layer_name=SHARED_ANNOTATION_LAYER, voices=["T", "S"]),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["voices"], ["S", "T"])

    def test_an_unknown_voice_is_refused(self) -> None:
        self.client.force_authenticate(self.manager)
        for voices in (["S1"], ["X"], "S", [1]):
            response = self.client.post(
                _ENDPOINT,
                self._body(layer_name=SHARED_ANNOTATION_LAYER, voices=voices),
                format="json",
            )
            self.assertEqual(response.status_code, 400, voices)
            self.assertIn("voices", response.json()["errors"])

    def test_a_private_pencil_carries_no_voices(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.post(
            _ENDPOINT, self._body(layer_name=PERSONAL_ANNOTATION_LAYER, voices=["T"]),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["voices"], [])

    def test_a_mark_moved_to_the_conductors_desk_sheds_its_voices_for_good(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["T"])
        self.client.force_authenticate(self.manager)
        moved = self.client.patch(
            f"{_ENDPOINT}{mark.pk}/", {"layer_name": CONDUCTOR_ANNOTATION_LAYER}, format="json",
        )
        self.assertEqual(moved.status_code, 200, moved.content)
        self.assertEqual(moved.json()["voices"], [])
        back = self.client.patch(
            f"{_ENDPOINT}{mark.pk}/", {"layer_name": SHARED_ANNOTATION_LAYER}, format="json",
        )
        self.assertEqual(back.json()["voices"], [])

    def test_opening_a_mark_to_another_voice_is_news_and_narrowing_it_is_not(self) -> None:
        mark = self._mark(self.manager, SHARED_ANNOTATION_LAYER, voices=["T"])
        past = timezone.now() - timedelta(days=2)
        Annotation.objects.filter(pk=mark.pk).update(content_at=past)
        self.client.force_authenticate(self.manager)

        narrowed = self.client.patch(f"{_ENDPOINT}{mark.pk}/", {"voices": ["T"]}, format="json")
        self.assertEqual(narrowed.status_code, 200, narrowed.content)
        mark.refresh_from_db()
        self.assertEqual(mark.content_at, past)

        opened = self.client.patch(f"{_ENDPOINT}{mark.pk}/", {"voices": ["T", "B"]}, format="json")
        self.assertEqual(opened.status_code, 200, opened.content)
        mark.refresh_from_db()
        self.assertGreater(mark.content_at, past)

        widened_at = mark.content_at
        self.client.patch(f"{_ENDPOINT}{mark.pk}/", {"voices": ["B"]}, format="json")
        mark.refresh_from_db()
        self.assertEqual(mark.content_at, widened_at)


class ReaderSectionsTests(_MarksFixture):
    def _sections(self, user) -> str:
        self.client.force_authenticate(user)
        response = self.client.get(f"{_ENDPOINT}fingerprint/", {"edition": str(self.edition.pk)})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["reader_sections"]

    def _seat(self, user) -> Participation:
        return Participation.objects.get(artist__user=user, project=self.project)

    def test_a_singer_answers_to_their_section(self) -> None:
        self.assertEqual(self._sections(self.singer_user), "T")

    def test_a_declared_seat_outranks_the_voice_type(self) -> None:
        seat = self._seat(self.singer_user)
        seat.default_voice_line = "B1"
        seat.save(update_fields=["default_voice_line"])
        self.assertEqual(self._sections(self.singer_user), "B")

    def test_an_unseated_baritone_answers_to_both_of_his_sections(self) -> None:
        artist = self._seat(self.singer_user).artist
        artist.voice_type = VoiceType.BARITONE
        artist.save(update_fields=["voice_type"])
        self.assertEqual(self._sections(self.singer_user), "TB")
        seat = self._seat(self.singer_user)
        seat.default_voice_line = VoiceLine.BARITONE
        seat.save(update_fields=["default_voice_line"])
        self.assertEqual(self._sections(self.singer_user), "TB")

    def test_the_line_this_piece_casts_them_on_counts_beside_their_seat(self) -> None:
        piece = self.edition.piece
        assert piece is not None
        ProjectPieceCasting.objects.create(
            participation=self._seat(self.singer_user), piece=piece, voice_line=VoiceLine.ALTO_1,
        )
        self.assertEqual(self._sections(self.singer_user), "AT")
        other_piece = self.second_edition.piece
        assert other_piece is not None
        ProjectPieceCasting.objects.create(
            participation=self._seat(self.other_user), piece=other_piece,
            voice_line=VoiceLine.BASS_1,
        )
        self.assertEqual(self._sections(self.other_user), "T")

    def test_a_reader_with_no_seat_on_the_music_answers_to_none(self) -> None:
        self.assertEqual(self._sections(self.manager), "")
        Project.objects.filter(pk=self.project.pk).update(status=Project.Status.COMPLETED)
        self.assertEqual(self._sections(self.singer_user), "")
