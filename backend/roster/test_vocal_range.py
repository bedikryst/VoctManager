"""
The singer's own tessitura/extremes self-report — Stage 1 (backend) of
docs/specs/vocal-range-self-report-2026-09.md.

Two guarantees matter more than the happy path. First, `Artist.vocal_range_bottom
/top` (the conductor's own free-text assessment) must never be touched by this
write, and must never reach a chorister — the proposal lives in entirely
separate fields for exactly that reason. Second, `ArtistBasicSerializer` is
built with `exclude`, so every one of the six new fields leaks to every
chorister who can see another singer's row unless it is named here — not just
in the model or in `ArtistMeSerializer`, but everywhere `ArtistBasicSerializer`
actually reaches another singer's data, including a non-manager rehearsal
delegate's roll-call read.
"""
import json
from datetime import timedelta
from typing import ClassVar

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from pydantic import ValidationError
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from core.services import UserPreferencesService
from core.signals import account_soft_deleted

from .dtos import VOCAL_RANGE_MIDI_MAX, VOCAL_RANGE_MIDI_MIN, VocalRangeProposalDTO
from .models import Artist, Participation, Project, Rehearsal, RehearsalDelegate, VoiceType
from .serializers import ArtistBasicSerializer, ArtistDetailedSerializer, ArtistMeSerializer
from .services import VocalRangeService

User = get_user_model()

PROPOSAL_FIELDS = (
    "proposed_tessitura_low", "proposed_tessitura_high",
    "proposed_extreme_low", "proposed_extreme_high",
    "vocal_range_comment", "vocal_range_proposed_at",
)


class VocalRangeProposalDTOTests(SimpleTestCase):
    """The validation matrix in the spec's Data model section."""

    def test_accepts_a_minimal_valid_proposal(self) -> None:
        dto = VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74)
        self.assertIsNone(dto.extreme_low)
        self.assertIsNone(dto.extreme_high)
        self.assertEqual(dto.comment, "")

    def test_accepts_extremes_and_comment(self) -> None:
        dto = VocalRangeProposalDTO(
            tessitura_low=57, tessitura_high=74, extreme_low=55, extreme_high=76,
            comment="Wysoki sopran",
        )
        self.assertEqual(dto.extreme_low, 55)
        self.assertEqual(dto.comment, "Wysoki sopran")

    def test_extra_field_forbidden(self) -> None:
        with self.assertRaises(ValidationError):
            # Deliberately naming an unknown field, so mypy's static field list
            # does not apply — silence it rather than skip the runtime check.
            VocalRangeProposalDTO(  # type: ignore[call-arg]
                tessitura_low=57, tessitura_high=74, vocal_range_bottom="G2",
            )

    def test_values_out_of_midi_range_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=VOCAL_RANGE_MIDI_MIN - 1, tessitura_high=74)
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=VOCAL_RANGE_MIDI_MAX + 1)

    def test_tessitura_low_must_be_strictly_lower(self) -> None:
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=60, tessitura_high=60)
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=61, tessitura_high=60)

    def test_extreme_low_above_tessitura_low_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, extreme_low=58)

    def test_extreme_high_below_tessitura_high_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, extreme_high=73)

    def test_extreme_equal_to_tessitura_bound_is_allowed(self) -> None:
        # "≤"/"≥" in the spec, not "<"/">" — an extreme flush with the
        # tessitura edge is a real (if unremarkable) answer.
        dto = VocalRangeProposalDTO(
            tessitura_low=57, tessitura_high=74, extreme_low=57, extreme_high=74,
        )
        self.assertEqual(dto.extreme_low, 57)
        self.assertEqual(dto.extreme_high, 74)

    def test_comment_too_long_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, comment="x" * 501)

    def test_blank_comment_normalizes_to_empty_string(self) -> None:
        dto = VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, comment=None)
        self.assertEqual(dto.comment, "")


def _make_artist(**overrides) -> Artist:
    defaults = {
        "first_name": "Ada", "last_name": "Lovelace",
        "email": f"ada-{Artist.objects.count()}@example.com",
        "voice_type": VoiceType.ALTO,
    }
    defaults.update(overrides)
    return Artist.objects.create(**defaults)


class VocalRangeServiceTests(TestCase):
    def test_submit_proposal_writes_all_fields_and_stamps(self) -> None:
        artist = _make_artist()
        dto = VocalRangeProposalDTO(
            tessitura_low=57, tessitura_high=74, extreme_low=55, extreme_high=76,
            comment="Test",
        )
        before = timezone.now()
        updated = VocalRangeService.submit_proposal(artist, dto)

        self.assertEqual(updated.proposed_tessitura_low, 57)
        self.assertEqual(updated.proposed_tessitura_high, 74)
        self.assertEqual(updated.proposed_extreme_low, 55)
        self.assertEqual(updated.proposed_extreme_high, 76)
        self.assertEqual(updated.vocal_range_comment, "Test")
        assert updated.vocal_range_proposed_at is not None
        self.assertGreaterEqual(updated.vocal_range_proposed_at, before)

    def test_submit_proposal_never_touches_the_conductors_assessment(self) -> None:
        artist = _make_artist(vocal_range_bottom="G2", vocal_range_top="C5")
        VocalRangeService.submit_proposal(
            artist, VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74),
        )
        artist.refresh_from_db()
        self.assertEqual(artist.vocal_range_bottom, "G2")
        self.assertEqual(artist.vocal_range_top, "C5")

    def test_resubmission_overwrites_and_restamps(self) -> None:
        artist = _make_artist()
        VocalRangeService.submit_proposal(
            artist, VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, extreme_low=55),
        )
        first_stamp = artist.vocal_range_proposed_at
        assert first_stamp is not None

        VocalRangeService.submit_proposal(
            artist, VocalRangeProposalDTO(tessitura_low=60, tessitura_high=79),
        )
        artist.refresh_from_db()
        self.assertEqual(artist.proposed_tessitura_low, 60)
        self.assertIsNone(artist.proposed_extreme_low)  # cleared, not carried over
        assert artist.vocal_range_proposed_at is not None
        self.assertGreaterEqual(artist.vocal_range_proposed_at, first_stamp)


class ArtistSerializerPrivacyTests(TestCase):
    """`exclude`-based serializers leak every new field by default."""

    def setUp(self) -> None:
        self.artist = _make_artist()
        VocalRangeService.submit_proposal(
            self.artist,
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, comment="Prywatne"),
        )

    def test_basic_serializer_excludes_every_proposal_field(self) -> None:
        data = ArtistBasicSerializer(self.artist).data
        for field in PROPOSAL_FIELDS:
            self.assertNotIn(field, data)

    def test_me_serializer_keeps_the_proposal_but_never_the_conductors_fields(self) -> None:
        self.artist.vocal_range_bottom = "G2"
        self.artist.vocal_range_top = "C5"
        self.artist.save(update_fields=["vocal_range_bottom", "vocal_range_top"])

        data = ArtistMeSerializer(self.artist).data
        self.assertEqual(data["proposed_tessitura_low"], 57)
        self.assertEqual(data["vocal_range_comment"], "Prywatne")
        self.assertNotIn("vocal_range_bottom", data)
        self.assertNotIn("vocal_range_top", data)

    def test_detailed_serializer_lists_the_proposal_as_read_only(self) -> None:
        serializer = ArtistDetailedSerializer(self.artist)
        data = serializer.data
        for field in PROPOSAL_FIELDS:
            self.assertIn(field, data)
            self.assertTrue(serializer.fields[field].read_only, field)


class VocalRangeManagerCannotRewriteTests(APITestCase):
    """A manager may read the singer's words through `ArtistDetailedSerializer`
    but the generic PATCH must not be able to overwrite them."""

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            "vr-edit-mgr", "vr-edit-mgr@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.artist = _make_artist(email="vr-edit-ada@example.com")
        VocalRangeService.submit_proposal(
            self.artist,
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, comment="Oryginal"),
        )
        self.client.force_authenticate(self.manager)

    def test_get_shows_the_proposal_to_the_manager(self) -> None:
        response = self.client.get(f"/api/artists/{self.artist.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["proposed_tessitura_low"], 57)
        self.assertEqual(response.data["vocal_range_comment"], "Oryginal")

    def test_patch_cannot_rewrite_the_singers_words(self) -> None:
        response = self.client.patch(
            f"/api/artists/{self.artist.id}/",
            {"proposed_tessitura_low": 30, "vocal_range_comment": "Nadpisane"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.proposed_tessitura_low, 57)
        self.assertEqual(self.artist.vocal_range_comment, "Oryginal")


_VOCAL_RANGE_URL = "/api/artists/me/vocal-range/"


class VocalRangeSubmitEndpointTests(APITestCase):
    """`PUT /api/artists/me/vocal-range/` — the authenticated artist's own row,
    and only theirs."""

    VALID_PAYLOAD: ClassVar[dict[str, object]] = {
        "tessitura_low": 57, "tessitura_high": 74,
        "extreme_low": 55, "extreme_high": 76,
        "comment": "Wysoki sopran",
    }

    def setUp(self) -> None:
        self.singer_user = User.objects.create_user(
            "vr-singer2", "vr-singer2@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Ola", last_name="Sopran",
            email="vr-singer2@test.pl", voice_type=VoiceType.SOPRANO,
        )

        self.conductor_user = User.objects.create_user(
            "vr-conductor", "vr-conductor@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.conductor_user, role=AppRole.MANAGER)
        Artist.objects.create(
            user=self.conductor_user, first_name="Piotr", last_name="Dyrygent",
            email="vr-conductor@test.pl", voice_type=VoiceType.CONDUCTOR,
        )

        self.instrumentalist_user = User.objects.create_user(
            "vr-organ", "vr-organ@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.instrumentalist_user, role=AppRole.ARTIST)
        Artist.objects.create(
            user=self.instrumentalist_user, first_name="Ola", last_name="Organy",
            email="vr-organ@test.pl", voice_type=VoiceType.INSTRUMENTALIST,
            instrument="Organy",
        )

        self.manager_without_artist = User.objects.create_user(
            "vr-mgr2", "vr-mgr2@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.manager_without_artist, role=AppRole.MANAGER)

    def test_unauthenticated_refused(self) -> None:
        response = self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.assertIn(response.status_code, (401, 403))

    def test_singer_can_submit(self) -> None:
        self.client.force_authenticate(self.singer_user)
        response = self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, 200)

        self.singer.refresh_from_db()
        self.assertEqual(self.singer.proposed_tessitura_low, 57)
        self.assertEqual(self.singer.proposed_tessitura_high, 74)
        self.assertEqual(self.singer.proposed_extreme_low, 55)
        self.assertEqual(self.singer.proposed_extreme_high, 76)
        self.assertEqual(self.singer.vocal_range_comment, "Wysoki sopran")
        self.assertIsNotNone(self.singer.vocal_range_proposed_at)

        self.assertEqual(response.data["proposed_tessitura_low"], 57)
        self.assertNotIn("vocal_range_bottom", response.data)
        self.assertNotIn("vocal_range_top", response.data)

    def test_resubmission_overwrites_and_restamps(self) -> None:
        self.client.force_authenticate(self.singer_user)
        self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.singer.refresh_from_db()
        first_stamp = self.singer.vocal_range_proposed_at
        assert first_stamp is not None

        response = self.client.put(
            _VOCAL_RANGE_URL,
            {"tessitura_low": 60, "tessitura_high": 79, "comment": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.singer.refresh_from_db()
        self.assertEqual(self.singer.proposed_tessitura_low, 60)
        self.assertIsNone(self.singer.proposed_extreme_low)
        assert self.singer.vocal_range_proposed_at is not None
        self.assertGreaterEqual(self.singer.vocal_range_proposed_at, first_stamp)

    def test_conductor_cannot_submit(self) -> None:
        self.client.force_authenticate(self.conductor_user)
        response = self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, 403)

    def test_instrumentalist_cannot_submit(self) -> None:
        self.client.force_authenticate(self.instrumentalist_user)
        response = self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, 403)

    def test_manager_without_own_artist_row_refused(self) -> None:
        self.client.force_authenticate(self.manager_without_artist)
        response = self.client.put(_VOCAL_RANGE_URL, self.VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, 403)

    def test_invalid_payload_rejected(self) -> None:
        self.client.force_authenticate(self.singer_user)
        bad = {**self.VALID_PAYLOAD, "tessitura_low": 80, "tessitura_high": 74}
        response = self.client.put(_VOCAL_RANGE_URL, bad, format="json")
        self.assertEqual(response.status_code, 400)

    def test_extra_field_rejected(self) -> None:
        self.client.force_authenticate(self.singer_user)
        bad = {**self.VALID_PAYLOAD, "vocal_range_bottom": "G2"}
        response = self.client.put(_VOCAL_RANGE_URL, bad, format="json")
        self.assertEqual(response.status_code, 400)


class VocalRangeDelegateLeadSheetPrivacyTests(APITestCase):
    """The sharpest case of that leak: a non-manager rehearsal delegate (assistant
    conductor) reads the cast through `ArtistBasicSerializer` on the roll-call
    read model (`RehearsalViewSet.lead_sheet`). The on-screen privacy promise
    depends on that serializer, not on this delegate lacking permission —
    `RehearsalDelegate.can_take_roll_call` deliberately grants access to other
    singers' attendance rows, so this pins that the grant stops there.
    """

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            "vr-lead-mgr", "vr-lead-mgr@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="VR Rehearsal", status=Project.Status.ACTIVE,
        )

        self.deputy_user = User.objects.create_user(
            "vr-deputy", "vr-deputy@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.deputy_user, role=AppRole.ARTIST)
        self.deputy = Artist.objects.create(
            user=self.deputy_user, first_name="Kasia", last_name="Zastepca",
            email="vr-deputy@test.pl", voice_type=VoiceType.SOPRANO,
        )

        self.singer_user = User.objects.create_user(
            "vr-lead-singer", "vr-lead-singer@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Jan", last_name="Spiewak",
            email="vr-lead-singer@test.pl", voice_type=VoiceType.TENOR,
        )
        VocalRangeService.submit_proposal(
            self.singer,
            VocalRangeProposalDTO(
                tessitura_low=48, tessitura_high=67, extreme_low=45,
                comment="Sekretna notatka do dyrygenta",
            ),
        )

        Participation.objects.create(
            artist=self.deputy, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

        self.rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2),
        )
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.deputy, granted_by=self.manager,
        )

    def test_delegate_can_reach_the_lead_sheet(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"/api/rehearsals/{self.rehearsal.id}/lead-sheet/")
        self.assertEqual(response.status_code, 200)
        cast_ids = {row["artist"] for row in response.data["cast"]}
        self.assertEqual(cast_ids, {str(self.deputy.id), str(self.singer.id)})

    def test_delegate_never_sees_the_proposal_or_the_comment(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"/api/rehearsals/{self.rehearsal.id}/lead-sheet/")
        self.assertEqual(response.status_code, 200)
        # default=str: the payload carries raw UUIDs (e.g. `led_by`), which
        # plain json.dumps cannot encode on its own.
        blob = json.dumps(response.data, default=str)
        self.assertNotIn("tessitura", blob)
        self.assertNotIn("proposed_extreme", blob)
        self.assertNotIn("Sekretna notatka", blob)
        self.assertNotIn("vocal_range", blob)

    def test_delegate_cannot_open_the_singers_artist_record(self) -> None:
        # A delegation is not the manager role: `ArtistViewSet` narrows a
        # non-manager to their own row, so `ArtistDetailedSerializer` (which
        # carries the proposal) is never reached for somebody else.
        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"/api/artists/{self.singer.id}/")
        self.assertEqual(response.status_code, 404)


class VocalRangeErasureTests(TestCase):
    """Account erasure clears the singer's own words but keeps the conductor's."""

    def test_erasure_clears_the_proposal_and_keeps_the_assessment(self) -> None:
        user = User.objects.create_user("vr-erase", "vr-erase@test.pl", "pw123456")
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name="Iza", last_name="Usunieta",
            email="vr-erase@test.pl", voice_type=VoiceType.ALTO,
            vocal_range_bottom="F3", vocal_range_top="D5",
        )
        VocalRangeService.submit_proposal(
            artist,
            VocalRangeProposalDTO(
                tessitura_low=53, tessitura_high=72, extreme_low=50, extreme_high=74,
                comment="Po zabiegu krtani",
            ),
        )

        account_soft_deleted.send(sender=self.__class__, user=user)

        artist = Artist.all_objects.get(pk=artist.pk)
        for field in PROPOSAL_FIELDS:
            self.assertIn(getattr(artist, field), (None, ""), field)
        self.assertEqual(artist.vocal_range_bottom, "F3")
        self.assertEqual(artist.vocal_range_top, "D5")


class VocalRangeGdprExportTests(TestCase):
    """The proposal and comment travel with the singer's own GDPR export."""

    def test_export_carries_the_proposal_and_comment(self) -> None:
        user = User.objects.create_user(
            "vr-export", "vr-export@test.pl", "pw123456",
            first_name="Ewa", last_name="Export",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name="Ewa", last_name="Export",
            email="vr-export@test.pl", voice_type=VoiceType.MEZZO,
        )
        VocalRangeService.submit_proposal(
            artist,
            VocalRangeProposalDTO(
                tessitura_low=53, tessitura_high=72, extreme_low=50,
                comment="Do dyrygenta",
            ),
        )

        export = UserPreferencesService.generate_gdpr_export(user, {})
        proposal = export["artist_profile"]["vocal_range_proposal"]
        self.assertEqual(proposal["tessitura_low"], 53)
        self.assertEqual(proposal["tessitura_high"], 72)
        self.assertEqual(proposal["extreme_low"], 50)
        self.assertIsNone(proposal["extreme_high"])
        self.assertEqual(proposal["comment"], "Do dyrygenta")
        self.assertIsNotNone(proposal["proposed_at"])
