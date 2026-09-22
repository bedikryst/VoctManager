"""A sectional calls a RULE, not a list: `Rehearsal.called_sections`.

Booked as "Soprany & Alty" it used to be a frozen set of participation ids, so
every singer who joined the cast later had to be added to every sectional by
hand — and the three intermediate voices were sorted by the first letter of
their code (a baritone with the basses, a mezzo and a countertenor nowhere).
Now the letters are stored and resolved on every read, against the seat first
and the voice type second (`core.voice_labels.section_letters_of_seat`).

Two implementations read that rule — `called_participations` from the room's
side and `calling_q` from the member's side, with `calls_seat` as the in-memory
twin for the printed sheets — so the cases below drive all three through the
same cast and assert they agree, for every voice type, with and without a seat.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole, VoiceLine
from core.ical_service import ICalGeneratorService
from core.models import UserProfile
from core.voice_labels import (
    canonical_section_letters,
    section_letters_of_seat,
    section_letters_of_voice_line,
    section_letters_of_voice_type,
)
from roster.invitations import build_invitation_context, build_invitation_metadata
from roster.models import (
    Artist,
    Participation,
    Project,
    Rehearsal,
    VoiceType,
    validate_called_sections,
)
from roster.queries.schedule_queries import get_artist_rehearsals_in_window
from roster.tasks import dispatch_due_reminders


class SectionLettersTests(SimpleTestCase):
    """Decision 3 of the rehearsal-plan spec, pinned per voice type."""

    def test_every_voice_type_has_its_declared_sections(self) -> None:
        self.assertEqual(section_letters_of_voice_type(VoiceType.SOPRANO), "S")
        self.assertEqual(section_letters_of_voice_type(VoiceType.MEZZO), "SA")
        self.assertEqual(section_letters_of_voice_type(VoiceType.ALTO), "A")
        self.assertEqual(section_letters_of_voice_type(VoiceType.COUNTERTENOR), "A")
        self.assertEqual(section_letters_of_voice_type(VoiceType.TENOR), "T")
        self.assertEqual(section_letters_of_voice_type(VoiceType.BARITONE), "TB")
        self.assertEqual(section_letters_of_voice_type(VoiceType.BASS), "B")
        self.assertEqual(section_letters_of_voice_type(VoiceType.CONDUCTOR), "")
        self.assertEqual(section_letters_of_voice_type(VoiceType.INSTRUMENTALIST), "")
        self.assertEqual(section_letters_of_voice_type(None), "")

    def test_a_line_answers_by_family_or_by_its_declared_home(self) -> None:
        self.assertEqual(section_letters_of_voice_line("S2"), "S")
        self.assertEqual(section_letters_of_voice_line("B3"), "B")
        self.assertEqual(section_letters_of_voice_line(VoiceLine.MEZZO), "SA")
        self.assertEqual(section_letters_of_voice_line(VoiceLine.COUNTERTENOR), "A")
        self.assertEqual(section_letters_of_voice_line(VoiceLine.BARITONE), "TB")
        # Role lines name no section; the voice type decides.
        self.assertEqual(section_letters_of_voice_line(VoiceLine.SOLO), "")
        self.assertEqual(section_letters_of_voice_line("V1"), "")
        self.assertEqual(section_letters_of_voice_line(""), "")

    def test_the_seat_wins_over_the_voice_type(self) -> None:
        # A mezzo seated as an alto is an alto for this concert's sectionals.
        self.assertEqual(section_letters_of_seat(VoiceType.MEZZO, "A1"), "A")
        # A bass seated as a baritone is now called by the tenors too.
        self.assertEqual(section_letters_of_seat(VoiceType.BASS, VoiceLine.BARITONE), "TB")
        # A solo seat says nothing about the section; the voice type does.
        self.assertEqual(section_letters_of_seat(VoiceType.TENOR, VoiceLine.SOLO), "T")
        self.assertEqual(section_letters_of_seat(VoiceType.BARITONE, ""), "TB")
        self.assertEqual(section_letters_of_seat(VoiceType.INSTRUMENTALIST, ""), "")

    def test_canonical_spelling_and_the_validator(self) -> None:
        self.assertEqual(canonical_section_letters("AS"), "SA")
        self.assertEqual(canonical_section_letters(["B", "T", "T"]), "TB")
        self.assertEqual(canonical_section_letters("xyz"), "")
        for value in ("", "S", "SA", "TB", "SATB"):
            validate_called_sections(value)
        for value in ("AS", "SS", "X", "sa", "SATBB"):
            with self.assertRaises(ValidationError, msg=value):
                validate_called_sections(value)


# Every voice type on the roster paired with the seat that tests its mapping:
# no seat (the voice type decides), a divisi seat of the other family for the
# intermediate voices (the seat wins), and a solo seat (falls back).
_CAST: tuple[tuple[str, str, str], ...] = (
    ("sop", VoiceType.SOPRANO, ""),
    ("sop-s2", VoiceType.SOPRANO, "S2"),
    ("mez", VoiceType.MEZZO, ""),
    ("mez-a1", VoiceType.MEZZO, "A1"),
    ("alt", VoiceType.ALTO, ""),
    ("alt-solo", VoiceType.ALTO, VoiceLine.SOLO),
    ("ct", VoiceType.COUNTERTENOR, ""),
    ("ct-t1", VoiceType.COUNTERTENOR, "T1"),
    ("ten", VoiceType.TENOR, ""),
    ("ten-bar", VoiceType.TENOR, VoiceLine.BARITONE),
    ("bar", VoiceType.BARITONE, ""),
    ("bar-b1", VoiceType.BARITONE, "B1"),
    ("bas", VoiceType.BASS, ""),
    ("bas-ms", VoiceType.BASS, VoiceLine.MEZZO),
    ("org", VoiceType.INSTRUMENTALIST, ""),
)

_CALLS: tuple[str, ...] = ("", "S", "A", "T", "B", "SA", "TB", "AT", "SATB")


class SectionalCallAgreementTests(APITestCase):
    """The three readings of the rule agree, for every seat and every call."""

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Laudes creaturarum",
            date_time=timezone.now() + timedelta(days=40),
            status=Project.Status.ACTIVE,
        )
        self.users: dict[str, AbstractBaseUser] = {}
        self.seats: dict[str, Participation] = {}
        for handle, voice_type, line in _CAST:
            user, seat = self._member(handle, voice_type, line)
            self.users[handle] = user
            self.seats[handle] = seat
        self.rehearsals = {
            letters: Rehearsal.objects.create(
                project=self.project,
                date_time=timezone.now() + timedelta(days=7 + index),
                called_sections=letters,
                # Every rehearsal here calls the players, so the cases exercise
                # the section rule over the singers and, on the organist, the
                # independence of the two axes.
                calls_instrumentalists=True,
            )
            for index, letters in enumerate(_CALLS)
        }

    def _member(
        self, handle: str, voice_type: str, line: str,
    ) -> tuple[AbstractBaseUser, Participation]:
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456", first_name=handle, last_name="X",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=handle, last_name="X", email=f"{handle}@test.pl",
            voice_type=voice_type,
            instrument="Organy" if voice_type == VoiceType.INSTRUMENTALIST else "",
        )
        seat = Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED, default_voice_line=line,
        )
        return user, seat

    @staticmethod
    def _expected(letters: str, seat: Participation) -> bool:
        """The rule restated by hand, so the three readings are checked
        against the spec and not against one another only."""
        if seat.artist.voice_type == VoiceType.INSTRUMENTALIST:
            # No section names a player, so the flag is their whole call —
            # and every rehearsal in this fixture sets it.
            return True
        if not letters:
            return True
        own = section_letters_of_seat(seat.artist.voice_type, seat.default_voice_line)
        return any(letter in letters for letter in own)

    def test_the_room_side_reading(self) -> None:
        for letters, rehearsal in self.rehearsals.items():
            called = set(rehearsal.called_participations())
            for handle, seat in self.seats.items():
                self.assertEqual(
                    seat in called, self._expected(letters, seat),
                    f"called_participations {letters!r} x {handle}",
                )

    def test_the_member_side_reading(self) -> None:
        for handle, seat in self.seats.items():
            seats = Participation.live_seats(artist=seat.artist)
            listed = set(
                Rehearsal.objects.filter(project=self.project).filter(
                    Rehearsal.calling_q(
                        seats,
                        instrumentalist=seat.artist.voice_type == VoiceType.INSTRUMENTALIST,
                        section_letters=Participation.section_letters_of_seats(
                            seats.select_related("artist")
                        ),
                    )
                ).distinct()
            )
            for letters, rehearsal in self.rehearsals.items():
                self.assertEqual(
                    rehearsal in listed, self._expected(letters, seat),
                    f"calling_q {letters!r} x {handle}",
                )

    def test_the_in_memory_reading(self) -> None:
        for letters, rehearsal in self.rehearsals.items():
            for handle, seat in self.seats.items():
                self.assertEqual(
                    rehearsal.calls_seat(seat, set()), self._expected(letters, seat),
                    f"calls_seat {letters!r} x {handle}",
                )

    def test_the_schedule_endpoint_lists_the_same_evenings(self) -> None:
        for handle in ("mez", "mez-a1", "bar", "ten-bar", "org"):
            self.client.force_authenticate(user=self.users[handle])
            response = self.client.get("/api/rehearsals/")
            self.assertEqual(response.status_code, 200, handle)
            listed = {row["id"] for row in response.data}
            expected = {
                str(rehearsal.id)
                for letters, rehearsal in self.rehearsals.items()
                if self._expected(letters, self.seats[handle])
            }
            self.assertEqual(listed, expected, handle)

    def test_a_player_answers_to_the_flag_alone(self) -> None:
        """The two axes are independent: a section names singers and says
        nothing about the players, so the flag calls the pianist to a sectional
        exactly as it calls them to a tutti — and unset, neither."""
        for letters, rehearsal in self.rehearsals.items():
            with self.subTest(letters=letters, flag=True):
                self.assertIn(self.seats["org"], set(rehearsal.called_participations()))
                self.assertTrue(rehearsal.calls_seat(self.seats["org"], set()))

        for letters in ("", "SA"):
            silent = Rehearsal.objects.create(
                project=self.project,
                date_time=timezone.now() + timedelta(days=40),
                called_sections=letters,
                calls_instrumentalists=False,
            )
            with self.subTest(letters=letters, flag=False):
                self.assertNotIn(self.seats["org"], set(silent.called_participations()))
                self.assertFalse(silent.calls_seat(self.seats["org"], set()))

    def test_a_named_list_still_overrides_the_sections(self) -> None:
        sectional = self.rehearsals["SA"]
        sectional.invited_participations.set([self.seats["bas"]])
        self.assertEqual(set(sectional.called_participations()), {self.seats["bas"]})
        self.assertTrue(sectional.calls_seat(self.seats["bas"], {self.seats["bas"].pk}))
        self.assertFalse(sectional.calls_seat(self.seats["sop"], {self.seats["bas"].pk}))


class SectionalReachesTheJoinerTests(APITestCase):
    """Florent's ask: a sectional booked today calls the alto who joins next
    week — on the roll call, in her calendar feed, on the absence window, in
    the reminder and in her invitation, without anyone re-saving it."""

    BULK = "roster.tasks.send_bulk_notifications_task.delay"

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Lumen",
            date_time=timezone.now() + timedelta(days=40),
            status=Project.Status.ACTIVE,
        )
        self.sectional = Rehearsal.objects.create(
            project=self.project,
            date_time=timezone.now() + timedelta(hours=12),
            called_sections="SA",
            focus="Lumen",
        )
        self.tenor_user, self.tenor_seat = self._joiner("ten-late", VoiceType.TENOR)
        self.alto_user, self.alto_seat = self._joiner("alt-late", VoiceType.ALTO)

    def _joiner(self, handle: str, voice_type: str) -> tuple[AbstractBaseUser, Participation]:
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456", first_name=handle, last_name="X",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=handle, last_name="X", email=f"{handle}@test.pl",
            voice_type=voice_type,
        )
        seat = Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        return user, seat

    def test_the_roll_call_has_her(self) -> None:
        self.assertEqual(set(self.sectional.called_participations()), {self.alto_seat})

    def test_her_calendar_feed_has_it_and_his_does_not(self) -> None:
        self.assertIn(
            str(self.sectional.id), ICalGeneratorService.generate_user_feed(self.alto_user),
        )
        self.assertNotIn(
            str(self.sectional.id), ICalGeneratorService.generate_user_feed(self.tenor_user),
        )

    def test_the_absence_window_asks_the_same_question(self) -> None:
        now = timezone.localtime().replace(tzinfo=None)
        found = get_artist_rehearsals_in_window(
            self.alto_seat.artist_id, now, now + timedelta(days=14),
        )
        self.assertEqual([r.pk for r, _seat in found], [self.sectional.pk])
        self.assertEqual(
            get_artist_rehearsals_in_window(
                self.tenor_seat.artist_id, now, now + timedelta(days=14),
            ),
            [],
        )

    def test_the_reminder_reaches_her_alone(self) -> None:
        with patch(self.BULK) as bulk:
            self.assertEqual(dispatch_due_reminders()["rehearsals"], 1)
        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["recipient_ids"], [str(self.alto_user.pk)],
        )

    def test_her_invitation_lists_it_with_its_sections_and_his_does_not(self) -> None:
        context = build_invitation_context(self.project)
        hers = build_invitation_metadata(self.alto_seat, context)["rehearsals"]
        self.assertEqual([row["rehearsal_id"] for row in hers], [str(self.sectional.id)])
        self.assertEqual(hers[0]["sections"], ["S", "A"])
        self.assertEqual(build_invitation_metadata(self.tenor_seat, context)["rehearsals"], [])

    def test_a_mezzo_is_invited_to_a_two_section_call_once(self) -> None:
        _user, mezzo_seat = self._joiner("mez-late", VoiceType.MEZZO)
        context = build_invitation_context(self.project)
        hers = build_invitation_metadata(mezzo_seat, context)["rehearsals"]
        self.assertEqual([row["rehearsal_id"] for row in hers], [str(self.sectional.id)])

    def test_the_pianist_is_invited_to_a_sectional_that_calls_the_players(self) -> None:
        """No letter files a player under a section, so the context lists the
        sectionals that call them separately — and only those."""
        _user, pianist_seat = self._joiner("pia-late", VoiceType.INSTRUMENTALIST)
        self.assertEqual(
            build_invitation_metadata(
                pianist_seat, build_invitation_context(self.project),
            )["rehearsals"],
            [],
        )

        self.sectional.calls_instrumentalists = True
        self.sectional.save(update_fields=["calls_instrumentalists"])
        theirs = build_invitation_metadata(
            pianist_seat, build_invitation_context(self.project),
        )["rehearsals"]
        self.assertEqual([row["rehearsal_id"] for row in theirs], [str(self.sectional.id)])
        self.assertIn(pianist_seat, set(self.sectional.called_participations()))
