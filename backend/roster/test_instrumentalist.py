"""The organist: an Artist who is not a singer.

Instrumentalists hold a `Participation` like anyone else — an account, an
invitation, the scores, a fee — and differ in exactly two places, both pinned
here because both are silent when wrong:

* they are **not called to a whole-cast rehearsal** unless that rehearsal says
  so, so the choir's eight sectionals never appear in the organist's schedule
  and never wait for their attendance row; and
* their **instrument replaces the voice** on anything printed. The contract,
  which would otherwise commit them to a vocal part under Polish law, is pinned
  in `finance/tests/test_documents.py`.

The rehearsal rule lives in one place (`Rehearsal.called_participations` and its
query-side twin `calling_q`) because it used to live in seven, and the cases
below approach it from both ends — the roll call that reads the room and the
member's own schedule that reads the diary.
"""

from __future__ import annotations

import tempfile
from datetime import timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from archive.models import Annotation, Composer, Piece, ScoreEdition, Track
from core.constants import AppRole, VoiceLine
from core.models import UserProfile
from roster.dtos import ArtistCreateDTO
from roster.infrastructure.document_generator import (
    Audience,
    DocumentGenerator,
    DocumentKind,
)
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    RehearsalDelegate,
    VoiceType,
)
from roster.queries.dossier_queries import get_artist_dossier
from roster.queries.schedule_queries import get_artist_rehearsals_in_window
from roster.score_package_config import book_binds_instrumental_item, book_program_items
from roster.score_package_service import ScorePackageService


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


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class InstrumentalItemTests(APITestCase):
    """Whose music an item cast on players only is.

    The organ voluntary is programmed like any piece, but its score is not the
    choir's: a singer sees the title and a badge, the book leaves it out, and
    the organist — who follows the whole evening — is refused nothing.
    """

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Nieszpory",
            date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        User = get_user_model()
        self.manager = User.objects.create_user("iit-mgr", "iit-mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.singer_user, self.singer = self._member(
            "iit-sop", "Ala", "Sopran", VoiceType.SOPRANO
        )
        self.player_user, self.player = self._member(
            "iit-org", "Jan", "Organista", VoiceType.INSTRUMENTALIST, instrument="Organy",
        )
        self.singer_seat = self._seat(self.singer)
        self.player_seat = self._seat(self.player)

        composer = Composer.objects.create(first_name="Johann", last_name="Bach")
        self.choir_piece = Piece.objects.create(title="Motet", composer=composer)
        self.organ_piece = Piece.objects.create(title="Toccata", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.choir_piece, order=1)
        ProgramItem.objects.create(project=self.project, piece=self.organ_piece, order=2)
        ProjectPieceCasting.objects.create(
            participation=self.player_seat, piece=self.organ_piece,
            voice_line=VoiceLine.ACCOMPANIMENT,
        )
        self.choir_edition = self._edition(self.choir_piece, "motet.pdf")
        self.organ_edition = self._edition(self.organ_piece, "toccata.pdf")
        for piece in (self.choir_piece, self.organ_piece):
            Track.objects.create(
                piece=piece, voice_part=VoiceLine.SOPRANO_1,
                audio_file=SimpleUploadedFile(
                    "take.mp3", b"ID3\x03\x00\x00\x00take", content_type="audio/mpeg",
                ),
            )

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

    @staticmethod
    def _edition(piece: Piece, name: str) -> ScoreEdition:
        return ScoreEdition.objects.create(
            piece=piece, original_filename=name, sha256="", page_count=1,
            pdf_file=SimpleUploadedFile(
                name, b"%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", content_type="application/pdf",
            ),
        )

    def _cast_the_soprano_on_the_organ_piece(self) -> None:
        ProjectPieceCasting.objects.create(
            participation=self.singer_seat, piece=self.organ_piece,
            voice_line=VoiceLine.SOPRANO_1,
        )

    def _dashboard_row(self, user: AbstractBaseUser, query: str = "") -> dict[str, Any]:
        self.client.force_authenticate(user=user)
        response = self.client.get(f"/api/participations/materials-dashboard/{query}")
        self.assertEqual(response.status_code, 200, response.data)
        rows = [row for row in response.data if row["project"]["id"] == str(self.project.id)]
        self.assertEqual(len(rows), 1)
        return rows[0]

    def _dashboard_pieces(
        self, user: AbstractBaseUser, query: str = "",
    ) -> dict[str, dict[str, Any]]:
        row = self._dashboard_row(user, query)
        return {item["piece"]["title"]: item["piece"] for item in row["program"]}

    # --- the songbook ---------------------------------------------------- #

    def test_the_singer_gets_the_title_and_nothing_else(self) -> None:
        pieces = self._dashboard_pieces(self.singer_user)
        organ = pieces["Toccata"]
        self.assertTrue(organ["is_instrumental"])
        self.assertTrue(organ["materials_withheld"])
        self.assertEqual(organ["editions"], [])
        self.assertEqual(organ["tracks"], [])
        choir = pieces["Motet"]
        self.assertFalse(choir["is_instrumental"])
        self.assertFalse(choir["materials_withheld"])
        self.assertEqual(len(choir["editions"]), 1)
        self.assertEqual(len(choir["tracks"]), 1)

    def test_the_organist_follows_the_whole_evening(self) -> None:
        self.project.score_pdf = SimpleUploadedFile("book.pdf", b"%PDF-1.4\n%%EOF")
        self.project.save(update_fields=["score_pdf"])
        pieces = self._dashboard_pieces(self.player_user)
        for title in ("Motet", "Toccata"):
            self.assertFalse(pieces[title]["materials_withheld"], title)
            self.assertEqual(len(pieces[title]["editions"]), 1, title)
            self.assertEqual(len(pieces[title]["tracks"]), 1, title)
        self.assertTrue(pieces["Toccata"]["is_instrumental"])
        self.assertFalse(pieces["Motet"]["is_instrumental"])
        # The choir's book, opened as is — no book of their own.
        self.assertTrue(self._dashboard_row(self.player_user)["project"]["has_score_pdf"])

    def test_one_singer_on_the_board_makes_it_a_choir_piece(self) -> None:
        self._cast_the_soprano_on_the_organ_piece()
        for user in (self.singer_user, self.player_user):
            organ = self._dashboard_pieces(user)["Toccata"]
            self.assertFalse(organ["is_instrumental"])
            self.assertFalse(organ["materials_withheld"])
            self.assertEqual(len(organ["editions"]), 1)

    def test_the_managers_preview_withholds_exactly_what_the_singer_is_refused(self) -> None:
        own = self._dashboard_pieces(self.singer_user)
        preview = self._dashboard_pieces(self.manager, f"?artist={self.singer.id}")
        for title in ("Motet", "Toccata"):
            for key in ("is_instrumental", "materials_withheld"):
                self.assertEqual(preview[title][key], own[title][key], (title, key))
            self.assertEqual(len(preview[title]["editions"]), len(own[title]["editions"]))
            self.assertEqual(len(preview[title]["tracks"]), len(own[title]["tracks"]))

    # --- the download gate, and the marks behind it ----------------------- #

    def _download(self, user: AbstractBaseUser, edition: ScoreEdition) -> int:
        self.client.force_authenticate(user=user)
        with patch("roster.views.stamp_pdf", return_value=b"%PDF-stamped"):
            return self.client.get(f"/api/materials/scores/{edition.id}/download/").status_code

    def test_the_singer_cannot_open_the_organ_score(self) -> None:
        self.assertEqual(self._download(self.singer_user, self.organ_edition), 404)
        self.assertEqual(self._download(self.singer_user, self.choir_edition), 200)

    def test_the_organist_opens_both(self) -> None:
        self.assertEqual(self._download(self.player_user, self.organ_edition), 200)
        self.assertEqual(self._download(self.player_user, self.choir_edition), 200)

    def test_the_singer_cannot_list_marks_on_the_organ_score(self) -> None:
        Annotation.objects.create(
            edition=self.organ_edition, page_number=1, annotation_type="FH",
            payload={"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
            layer_name="shared", created_by=self.manager,
        )
        self.client.force_authenticate(user=self.singer_user)
        response = self.client.get(f"/api/archive/annotations/?edition={self.organ_edition.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    # --- the book --------------------------------------------------------- #

    def test_the_book_binds_the_choirs_programme_only(self) -> None:
        self.assertEqual(
            [item.piece.title for item in book_program_items(self.project)],
            ["Motet"],
        )

    def test_a_soprano_joining_the_organ_piece_makes_the_book_stale(self) -> None:
        package = ScorePackageService.get_or_create(self.project)
        before = ScorePackageService.compute_source_hash(self.project, package)
        self._cast_the_soprano_on_the_organ_piece()
        after = ScorePackageService.compute_source_hash(self.project, package)
        self.assertNotEqual(before, after)
        self.assertEqual(
            [item.piece.title for item in book_program_items(self.project)],
            ["Motet", "Toccata"],
        )

    def test_the_cockpit_names_what_the_book_leaves_out(self) -> None:
        state = ScorePackageService.compute_state(self.project)
        self.assertEqual(state["total_pieces"], 1)
        self.assertEqual(state["instrumental_pieces"], ["Toccata"])
        self.assertFalse(state["book_withheld_from_choir"])

    # --- a singer who runs the evening ------------------------------------ #

    def test_the_stand_in_leader_with_a_seat_is_refused_nothing(self) -> None:
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.singer, granted_by=self.manager,
        )
        organ = self._dashboard_pieces(self.singer_user)["Toccata"]
        self.assertTrue(organ["is_instrumental"])
        self.assertFalse(organ["materials_withheld"])
        self.assertEqual(len(organ["editions"]), 1)
        self.assertEqual(len(organ["tracks"]), 1)

    # --- a book bound before the item turned instrumental ----------------- #

    def _bind_a_book_carrying_the_organ_piece(self) -> None:
        """The page map a build would have left had the organ piece been a
        choir piece at the time — one card page and one music page of it."""
        self.project.score_pdf = SimpleUploadedFile("book.pdf", b"%PDF-1.4\n%%EOF")
        self.project.save(update_fields=["score_pdf"])
        organ_item = ProgramItem.objects.get(project=self.project, piece=self.organ_piece)
        package = ScorePackageService.get_or_create(self.project)
        package.page_map = [
            {"kind": "card", "phys": 0, "folio": 1, "item": str(organ_item.pk)},
            {
                "kind": "music", "phys": 1, "folio": 2, "item": str(organ_item.pk),
                "edition": str(self.organ_edition.pk), "src_page": 1,
                "box": [0.0, 0.0, 595.0, 842.0],
            },
        ]
        package.save(update_fields=["page_map"])

    def test_a_book_still_binding_the_organ_piece_is_withheld_from_the_singer(self) -> None:
        self._bind_a_book_carrying_the_organ_piece()
        self.assertTrue(book_binds_instrumental_item(self.project))
        self.assertFalse(self._dashboard_row(self.singer_user)["project"]["has_score_pdf"])
        self.assertTrue(self._dashboard_row(self.player_user)["project"]["has_score_pdf"])

        self.client.force_authenticate(user=self.singer_user)
        self.assertEqual(
            self.client.get(f"/api/projects/{self.project.id}/score_pdf/").status_code, 403,
        )
        self.assertFalse(
            self.client.get(f"/api/projects/{self.project.id}/score_map/").data["available"],
        )
        self.client.force_authenticate(user=self.player_user)
        self.assertTrue(
            self.client.get(f"/api/projects/{self.project.id}/score_map/").data["available"],
        )
        self.assertTrue(ScorePackageService.compute_state(self.project)["book_withheld_from_choir"])

    def test_a_soprano_joining_the_organ_piece_hands_the_book_back(self) -> None:
        self._bind_a_book_carrying_the_organ_piece()
        self._cast_the_soprano_on_the_organ_piece()
        self.assertFalse(book_binds_instrumental_item(self.project))
        self.assertTrue(self._dashboard_row(self.singer_user)["project"]["has_score_pdf"])

    def test_a_hand_uploaded_book_is_the_conductors_decision(self) -> None:
        self.project.score_pdf = SimpleUploadedFile("book.pdf", b"%PDF-1.4\n%%EOF")
        self.project.save(update_fields=["score_pdf"])
        package = ScorePackageService.get_or_create(self.project)
        self.assertEqual(package.page_map, [])
        self.assertFalse(book_binds_instrumental_item(self.project))
        self.assertTrue(self._dashboard_row(self.singer_user)["project"]["has_score_pdf"])

    # --- the printed sheet ------------------------------------------------- #

    def _program_cards(self, recipient: Participation | None) -> dict[str, dict[str, Any]]:
        from roster.views import ProjectViewSet

        parts, crew, program, reh, cast = ProjectViewSet._call_sheet_querysets(self.project)
        context = DocumentGenerator._build_call_sheet_context(
            project=self.project, participations=parts, crew=crew, program=program,
            rehearsals=reh, castings=cast, audience=Audience.CHORISTER,
            recipient=recipient, base_url="http://testserver/", kind=DocumentKind.DAY_CARD,
        )
        return {card["title"]: card for card in context["program_cards"]}

    def test_the_singers_sheet_carries_the_badge_and_no_dead_link(self) -> None:
        cards = self._program_cards(self.singer_seat)
        self.assertTrue(cards["Toccata"]["is_instrumental"])
        self.assertEqual(cards["Toccata"]["sheet_music_url"], "")
        self.assertFalse(cards["Motet"]["is_instrumental"])
        self.assertIn("/api/materials/scores/", cards["Motet"]["sheet_music_url"])

    def test_the_organists_sheet_keeps_the_link(self) -> None:
        cards = self._program_cards(self.player_seat)
        self.assertTrue(cards["Toccata"]["is_instrumental"])
        self.assertIn("/api/materials/scores/", cards["Toccata"]["sheet_music_url"])
