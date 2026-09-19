"""The organist: an Artist who is not a singer.

Instrumentalists hold a `Participation` like anyone else — an account, an
invitation, the scores, a fee — and differ in exactly two places, both pinned
here because both are silent when wrong:

* they are **not called to a whole-cast rehearsal** unless that rehearsal says
  so, so the choir's eight sectionals never appear in the organist's schedule
  and never wait for their attendance row; and
* their **instrument replaces the voice** on anything printed, starting with the
  contract, which would otherwise commit them to a vocal part under Polish law.

The rehearsal rule lives in one place (`Rehearsal.called_participations` and its
query-side twin `calling_q`) because it used to live in seven, and the cases
below approach it from both ends — the roll call that reads the room and the
member's own schedule that reads the diary.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from roster.dtos import ArtistCreateDTO
from roster.infrastructure.document_generator import DocumentGenerator
from roster.models import (
    Artist,
    Participation,
    Project,
    Rehearsal,
    VoiceType,
)
from roster.queries.dossier_queries import get_artist_dossier
from roster.queries.schedule_queries import get_artist_rehearsals_in_window


class InstrumentFieldTests(APITestCase):
    """The instrument belongs to a player and to nobody else, on both write paths."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("ins-mgr", "ins-mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.client.force_authenticate(user=self.manager)

    def _dto_payload(self, **overrides: object) -> dict[str, object]:
        payload: dict[str, object] = {
            "first_name": "Jan",
            "last_name": "Organista",
            "email": "organista@test.pl",
            "voice_type": VoiceType.INSTRUMENTALIST,
            "instrument": "Organy",
        }
        payload.update(overrides)
        return payload

    def test_dto_requires_an_instrument_from_a_player(self) -> None:
        with self.assertRaises(ValueError):
            ArtistCreateDTO(**self._dto_payload(instrument=""))

    def test_dto_refuses_an_instrument_on_a_singer(self) -> None:
        with self.assertRaises(ValueError):
            ArtistCreateDTO(
                **self._dto_payload(voice_type=VoiceType.SOPRANO, instrument="Organy")
            )

    def test_dto_accepts_a_singer_without_one(self) -> None:
        dto = ArtistCreateDTO(
            **self._dto_payload(voice_type=VoiceType.SOPRANO, instrument=None)
        )
        self.assertIsNone(dto.instrument)

    def test_api_creates_a_player_with_their_instrument(self) -> None:
        response = self.client.post("/api/artists/", self._dto_payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        artist = Artist.objects.get(email="organista@test.pl")
        self.assertEqual(artist.instrument, "Organy")
        self.assertFalse(artist.is_singer)
        self.assertEqual(artist.role_label, "Organy")

    def test_patching_a_player_into_a_singer_clears_the_instrument(self) -> None:
        artist = Artist.objects.create(
            first_name="Jan", last_name="Organista", email="organista@test.pl",
            voice_type=VoiceType.INSTRUMENTALIST, instrument="Organy",
        )
        response = self.client.patch(
            f"/api/artists/{artist.pk}/",
            {"voice_type": VoiceType.BASS},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        artist.refresh_from_db()
        self.assertEqual(artist.instrument, "")
        self.assertTrue(artist.is_singer)

    def test_patching_an_instrument_onto_a_singer_is_refused(self) -> None:
        artist = Artist.objects.create(
            first_name="Ala", last_name="Sopran", email="sopran@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        response = self.client.patch(
            f"/api/artists/{artist.pk}/", {"instrument": "Organy"}, format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        artist.refresh_from_db()
        self.assertEqual(artist.instrument, "")


class RehearsalCallTests(APITestCase):
    """Who a rehearsal summons, read from the room and from the diary."""

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Msza koronacyjna",
            date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.singer_user, self.singer = self._member(
            "sop", "Ala", "Sopran", VoiceType.SOPRANO
        )
        self.player_user, self.player = self._member(
            "org", "Jan", "Organista", VoiceType.INSTRUMENTALIST, instrument="Organy",
        )
        self.singer_seat = self._seat(self.singer)
        self.player_seat = self._seat(self.player)

    def _member(
        self, handle: str, first: str, last: str, voice: str, instrument: str = "",
    ) -> tuple[AbstractBaseUser, Artist]:
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456", first_name=first, last_name=last,
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=first, last_name=last, email=f"{handle}@test.pl",
            voice_type=voice, instrument=instrument,
        )
        return user, artist

    def _seat(self, artist: Artist) -> Participation:
        return Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

    def _rehearsal(self, **kwargs: object) -> Rehearsal:
        return Rehearsal.objects.create(
            project=self.project,
            date_time=timezone.now() + timedelta(days=7),
            **kwargs,
        )

    def test_a_whole_cast_call_leaves_the_players_out(self) -> None:
        rehearsal = self._rehearsal()
        called = set(rehearsal.called_participations())
        self.assertEqual(called, {self.singer_seat})

    def test_a_dress_rehearsal_calls_them(self) -> None:
        rehearsal = self._rehearsal(calls_instrumentalists=True)
        called = set(rehearsal.called_participations())
        self.assertEqual(called, {self.singer_seat, self.player_seat})

    def test_a_named_call_reaches_a_player_without_the_flag(self) -> None:
        """An explicit list IS the call — the flag answers a question it never asks."""
        rehearsal = self._rehearsal()
        rehearsal.invited_participations.set([self.player_seat])
        self.assertEqual(set(rehearsal.called_participations()), {self.player_seat})

    def test_the_players_schedule_skips_a_choir_rehearsal(self) -> None:
        self._rehearsal()
        dress = self._rehearsal(calls_instrumentalists=True)

        self.client.force_authenticate(user=self.player_user)
        response = self.client.get("/api/rehearsals/")
        self.assertEqual(response.status_code, 200)
        listed = {row["id"] for row in response.data}
        self.assertEqual(listed, {str(dress.pk)})

    def test_the_singers_schedule_keeps_both(self) -> None:
        choir = self._rehearsal()
        dress = self._rehearsal(calls_instrumentalists=True)

        self.client.force_authenticate(user=self.singer_user)
        response = self.client.get("/api/rehearsals/")
        self.assertEqual(response.status_code, 200)
        listed = {row["id"] for row in response.data}
        self.assertEqual(listed, {str(choir.pk), str(dress.pk)})

    def test_the_absence_window_asks_the_same_question(self) -> None:
        """The window writes attendance rows, so it must not offer an evening
        the member was never called to — an EXCUSED row against a rehearsal
        nobody expected them at is an absence invented by the form."""
        self._rehearsal()
        dress = self._rehearsal(calls_instrumentalists=True)

        # Wall-clock, as the absence range submits it: each rehearsal is
        # judged on its own venue clock, so the window carries no offset.
        now = timezone.localtime().replace(tzinfo=None)
        window_start = now
        window_end = now + timedelta(days=14)
        found = get_artist_rehearsals_in_window(
            self.player.pk, window_start, window_end
        )
        self.assertEqual([rehearsal.pk for rehearsal, _seat in found], [dress.pk])

    def test_the_roll_call_lists_only_who_was_summoned(self) -> None:
        rehearsal = self._rehearsal()
        User = get_user_model()
        manager = User.objects.create_user("roll-mgr", "roll-mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=manager, role=AppRole.MANAGER)

        self.client.force_authenticate(user=manager)
        response = self.client.get(f"/api/rehearsals/{rehearsal.pk}/lead-sheet/")
        self.assertEqual(response.status_code, 200, response.data)
        seats = {row["id"] for row in response.data["cast"]}
        self.assertEqual(seats, {str(self.singer_seat.pk)})

    def test_the_dossier_counts_only_the_evenings_they_were_called_to(self) -> None:
        """The HR card's "rehearsals invited" reads the same rule; before it did
        not, and an organist was credited with every choir sectional."""
        self._rehearsal()
        self._rehearsal()
        self._rehearsal(calls_instrumentalists=True)

        self.assertEqual(get_artist_dossier(self.player)["stats"]["rehearsals_invited"], 1)
        self.assertEqual(get_artist_dossier(self.singer)["stats"]["rehearsals_invited"], 3)

    def test_the_printed_sheet_asks_per_seat(self) -> None:
        """`calls_seat` is the in-memory twin the call sheet walks with a
        prefetched invited list — the same answer for every shape of call."""
        choir = self._rehearsal()
        dress = self._rehearsal(calls_instrumentalists=True)
        named = self._rehearsal()
        named.invited_participations.set([self.player_seat])

        self.assertFalse(choir.calls_seat(self.player_seat, set()))
        self.assertTrue(choir.calls_seat(self.singer_seat, set()))
        self.assertTrue(dress.calls_seat(self.player_seat, set()))
        self.assertTrue(named.calls_seat(self.player_seat, {self.player_seat.pk}))
        self.assertFalse(named.calls_seat(self.singer_seat, {self.player_seat.pk}))


class InstrumentalistDocumentTests(APITestCase):
    """What the printed and sent artifacts say about a player."""

    def setUp(self) -> None:
        self.project = Project.objects.create(title="Nieszpory")
        self.player = Artist.objects.create(
            first_name="Jan", last_name="Organista", email="organista@test.pl",
            voice_type=VoiceType.INSTRUMENTALIST, instrument="Organy",
        )
        self.participation = Participation.objects.create(
            artist=self.player, project=self.project, fee=Decimal("900.00"),
        )

    def test_the_contract_commits_an_instrumental_part(self) -> None:
        with patch(
            "roster.infrastructure.document_generator._render_pdf",
            return_value=b"%PDF-",
        ) as render:
            DocumentGenerator.generate_participation_contract_pdf(self.participation)
        html = str(render.call_args.args[0])
        self.assertIn("partii instrumentalnej", html)
        self.assertIn("Organy", html)
        self.assertNotIn("partii wokalnej", html)

    def test_the_cast_list_groups_them_under_their_own_heading(self) -> None:
        singer = Artist.objects.create(
            first_name="Ala", last_name="Sopran", email="sopran@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        singer_seat = Participation.objects.create(
            artist=singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

        sections = DocumentGenerator._group_participations_by_voice(
            [self.participation, singer_seat]
        )
        labels = [section["label"] for section in sections]
        self.assertEqual(labels[0], singer.get_voice_type_display())
        self.assertEqual(labels[-1], self.player.get_voice_type_display())
        # The heading names the role, the line names the instrument: one section
        # can hold an organist and a trumpeter.
        self.assertEqual(sections[-1]["members"], ["Jan Organista (Organy)"])
