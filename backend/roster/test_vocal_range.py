"""
The singer's own tessitura/extremes self-report (Stage 1) and the conductor's
assessment on the same MIDI model (Stage 8.1) — docs/specs/vocal-range-self-
report-2026-09.md.

Two guarantees matter more than the happy path. First, the two records never
write each other: the singer's proposal (`proposed_*`) is written only by the
singer, the conductor's assessment (`assessed_*`) only by a manager. Second,
the assessment never reaches a chorister, and the proposal never reaches any
chorister but its author. `ArtistBasicSerializer` and `ArtistMeSerializer` are
built with `exclude`, so every new `Artist` field leaks through them unless
somebody decides otherwise; their output is therefore pinned to an explicit
allowlist, and a new field fails here until it is placed. The same holds
wherever `ArtistBasicSerializer` reaches another singer's data, including a
non-manager rehearsal delegate's roll-call read.
"""
import importlib
import json
from datetime import timedelta
from typing import Any, ClassVar

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from pydantic import ValidationError
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from core.services import UserPreferencesService
from core.signals import account_soft_deleted

from .domain.vocal_range import VOCAL_RANGE_MIDI_MAX, VOCAL_RANGE_MIDI_MIN, range_shape_error
from .dtos import ArtistCreateDTO, VocalRangeProposalDTO
from .models import Artist, Participation, Project, Rehearsal, RehearsalDelegate, VoiceType
from .serializers import ArtistBasicSerializer, ArtistDetailedSerializer, ArtistMeSerializer
from .services import VocalRangeService

User = get_user_model()

PROPOSAL_FIELDS = (
    "proposed_tessitura_low", "proposed_tessitura_high",
    "proposed_extreme_low", "proposed_extreme_high",
    "vocal_range_comment", "vocal_range_proposed_at",
)
ASSESSED_FIELDS = (
    "assessed_tessitura_low", "assessed_tessitura_high",
    "assessed_extreme_low", "assessed_extreme_high",
)

# What another chorister may read about a singer. Adding a key here is a
# privacy decision, not a test fix.
BASIC_KEYS = frozenset({
    "id", "created_at", "updated_at", "is_deleted", "is_active",
    "user", "username", "is_manager",
    "first_name", "last_name", "avatar_thumb_url",
    "voice_type", "voice_type_display", "instrument",
    "activation_email_sent_at",
})
# What a singer reads about themselves: their own contact data and their own
# proposal, never the conductor's verdict on them.
ME_KEYS = frozenset({
    "id", "created_at", "updated_at", "is_deleted", "is_active",
    "user", "username", "is_manager", "profile",
    "first_name", "last_name", "first_name_vocative",
    "email", "phone_number",
    "voice_type", "voice_type_display", "instrument",
    "activation_email_sent_at",
    *PROPOSAL_FIELDS,
})

MIGRATION_0067 = importlib.import_module("roster.migrations.0067_artist_assessed_range_from_text")


class RangeShapeRuleTests(SimpleTestCase):
    """The one rule both records share, as `range_shape_error` states it."""

    def test_empty_is_valid_only_when_not_required(self) -> None:
        self.assertIsNone(range_shape_error(None, None, None, None, required=False))
        error = range_shape_error(None, None, None, None, required=True)
        assert error is not None
        self.assertEqual(error.slot, "tessitura_low")

    def test_an_extreme_alone_needs_the_tessitura(self) -> None:
        error = range_shape_error(None, None, None, 80, required=False)
        assert error is not None
        self.assertEqual(error.slot, "tessitura_low")

    def test_a_lone_tessitura_bound_names_the_missing_one(self) -> None:
        error = range_shape_error(57, None, None, None, required=False)
        assert error is not None
        self.assertEqual(error.slot, "tessitura_high")

    def test_each_order_rule_names_its_slot(self) -> None:
        cases = {
            (60, 60, None, None): "tessitura_low",
            (57, 74, 58, None): "extreme_low",
            (57, 74, None, 73): "extreme_high",
        }
        for notes, slot in cases.items():
            error = range_shape_error(*notes, required=False)
            assert error is not None, notes
            self.assertEqual(error.slot, slot, notes)

    def test_extremes_flush_with_the_tessitura_are_valid(self) -> None:
        self.assertIsNone(range_shape_error(57, 74, 57, 74, required=True))


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
                tessitura_low=57, tessitura_high=74, assessed_tessitura_low=57,
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


def _make_artist(**overrides: Any) -> Artist:
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
        artist = _make_artist(
            assessed_tessitura_low=55, assessed_tessitura_high=72, assessed_extreme_high=76,
        )
        VocalRangeService.submit_proposal(
            artist, VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74),
        )
        artist.refresh_from_db()
        self.assertEqual(artist.assessed_tessitura_low, 55)
        self.assertEqual(artist.assessed_tessitura_high, 72)
        self.assertIsNone(artist.assessed_extreme_low)
        self.assertEqual(artist.assessed_extreme_high, 76)

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
    """`exclude`-based serializers leak every new field by default, so their
    output is pinned to an allowlist rather than checked against a denylist."""

    def setUp(self) -> None:
        self.artist = _make_artist(
            assessed_tessitura_low=55, assessed_tessitura_high=72,
            assessed_extreme_low=53, assessed_extreme_high=76,
        )
        VocalRangeService.submit_proposal(
            self.artist,
            VocalRangeProposalDTO(tessitura_low=57, tessitura_high=74, comment="Prywatne"),
        )

    # The declared fields, not one row's data: a row without an account drops
    # the `user.*` keys, which would hide a field another row does send.
    def test_basic_serializer_carries_only_the_allowlist(self) -> None:
        self.assertEqual(set(ArtistBasicSerializer(self.artist).fields), BASIC_KEYS)

    def test_me_serializer_carries_only_the_allowlist(self) -> None:
        self.assertEqual(set(ArtistMeSerializer(self.artist).fields), ME_KEYS)

    def test_me_serializer_keeps_the_proposal_but_never_the_assessment(self) -> None:
        data = ArtistMeSerializer(self.artist).data
        self.assertEqual(data["proposed_tessitura_low"], 57)
        self.assertEqual(data["vocal_range_comment"], "Prywatne")
        for field in ASSESSED_FIELDS:
            self.assertNotIn(field, data)

    def test_detailed_serializer_lists_the_proposal_as_read_only(self) -> None:
        serializer = ArtistDetailedSerializer(self.artist)
        data = serializer.data
        for field in PROPOSAL_FIELDS:
            self.assertIn(field, data)
            self.assertTrue(serializer.fields[field].read_only, field)

    def test_detailed_serializer_carries_the_assessment_as_writable(self) -> None:
        serializer = ArtistDetailedSerializer(self.artist)
        data = serializer.data
        self.assertEqual(
            [data[field] for field in ASSESSED_FIELDS], [55, 72, 53, 76],
        )
        for field in ASSESSED_FIELDS:
            self.assertFalse(serializer.fields[field].read_only, field)


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


class AssessedRangePatchTests(APITestCase):
    """The manager's PATCH writes the conductor's four notes, and checks them as
    they will be stored, not as this request happens to carry them."""

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            "vr-assess-mgr", "vr-assess-mgr@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.client.force_authenticate(self.manager)
        self.assessed = _make_artist(
            email="vr-assessed@example.com",
            assessed_tessitura_low=57, assessed_tessitura_high=74,
        )
        self.unassessed = _make_artist(email="vr-unassessed@example.com")

    def _patch(self, artist: Artist, payload: dict[str, Any]) -> Any:
        return self.client.patch(f"/api/artists/{artist.id}/", payload, format="json")

    def _assessment(self, artist: Artist) -> list[int | None]:
        artist.refresh_from_db()
        return [getattr(artist, field) for field in ASSESSED_FIELDS]

    def test_patch_writes_the_four(self) -> None:
        response = self._patch(self.unassessed, {
            "assessed_tessitura_low": 55, "assessed_tessitura_high": 72,
            "assessed_extreme_low": 52, "assessed_extreme_high": 79,
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._assessment(self.unassessed), [55, 72, 52, 79])
        self.assertEqual(response.data["assessed_extreme_high"], 79)

    def test_each_shape_violation_is_keyed_to_its_field(self) -> None:
        cases: list[tuple[Artist, dict[str, Any], str]] = [
            (self.unassessed, {"assessed_tessitura_low": 70, "assessed_tessitura_high": 60},
             "assessed_tessitura_low"),
            (self.unassessed, {"assessed_tessitura_low": 57}, "assessed_tessitura_high"),
            (self.unassessed, {"assessed_extreme_high": 80}, "assessed_tessitura_low"),
            (self.assessed, {"assessed_extreme_low": 58}, "assessed_extreme_low"),
            (self.assessed, {"assessed_extreme_high": 73}, "assessed_extreme_high"),
            (self.assessed, {"assessed_tessitura_low": VOCAL_RANGE_MIDI_MIN - 1}, "assessed_tessitura_low"),
            (self.assessed, {"assessed_tessitura_high": VOCAL_RANGE_MIDI_MAX + 1}, "assessed_tessitura_high"),
        ]
        for artist, payload, field in cases:
            with self.subTest(payload=payload):
                response = self._patch(artist, payload)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(set(response.data["errors"]), {field})

    def test_a_partial_patch_is_checked_against_the_stored_notes(self) -> None:
        # 57-74 is stored: an extreme inside it is refused, one outside it lands.
        refused = self._patch(self.assessed, {"assessed_extreme_high": 70})
        self.assertEqual(refused.status_code, 400)
        accepted = self._patch(self.assessed, {"assessed_extreme_high": 79})
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(self._assessment(self.assessed), [57, 74, None, 79])

    def test_clearing_one_tessitura_bound_under_a_stored_extreme_is_refused(self) -> None:
        self._patch(self.assessed, {"assessed_extreme_high": 79})
        response = self._patch(self.assessed, {"assessed_tessitura_low": None})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data["errors"]), {"assessed_tessitura_low"})

    def test_clearing_all_four_is_allowed(self) -> None:
        response = self._patch(self.assessed, {field: None for field in ASSESSED_FIELDS})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._assessment(self.assessed), [None, None, None, None])

    def test_a_patch_without_the_range_leaves_it_alone(self) -> None:
        response = self._patch(self.assessed, {"sight_reading_skill": 4})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._assessment(self.assessed), [57, 74, None, None])

    def test_proposal_fields_in_the_same_patch_are_ignored(self) -> None:
        VocalRangeService.submit_proposal(
            self.assessed, VocalRangeProposalDTO(tessitura_low=55, tessitura_high=76),
        )
        response = self._patch(self.assessed, {
            "assessed_tessitura_low": 55, "assessed_tessitura_high": 76,
            "proposed_tessitura_low": 40, "proposed_tessitura_high": 90,
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assessed.refresh_from_db()
        self.assertEqual(self.assessed.assessed_tessitura_low, 55)
        self.assertEqual(self.assessed.proposed_tessitura_low, 55)
        self.assertEqual(self.assessed.proposed_tessitura_high, 76)


class AssessedRangeCreateTests(APITestCase):
    """Adding a member may carry the assessment; the old text fields are gone."""

    PAYLOAD: ClassVar[dict[str, object]] = {
        "first_name": "Jan", "last_name": "Oceniony",
        "without_email": True, "voice_type": VoiceType.TENOR,
    }

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            "vr-create-mgr", "vr-create-mgr@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.client.force_authenticate(self.manager)

    def test_create_accepts_the_four(self) -> None:
        response = self.client.post("/api/artists/", {
            **self.PAYLOAD,
            "assessed_tessitura_low": 48, "assessed_tessitura_high": 69,
            "assessed_extreme_low": 45, "assessed_extreme_high": 72,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        artist = Artist.objects.get(pk=response.data["id"])
        self.assertEqual(
            [getattr(artist, field) for field in ASSESSED_FIELDS], [48, 69, 45, 72],
        )

    def test_create_without_an_assessment_leaves_it_empty(self) -> None:
        response = self.client.post("/api/artists/", self.PAYLOAD, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        artist = Artist.objects.get(pk=response.data["id"])
        self.assertEqual([getattr(artist, field) for field in ASSESSED_FIELDS], [None] * 4)

    def test_create_refuses_a_broken_range(self) -> None:
        response = self.client.post("/api/artists/", {
            **self.PAYLOAD, "assessed_extreme_high": 72,
        }, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Artist.objects.filter(last_name="Oceniony").exists())

    def test_create_refuses_the_old_text_fields(self) -> None:
        for field in ("vocal_range_bottom", "vocal_range_top"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/artists/", {**self.PAYLOAD, field: "C3"}, format="json",
                )
                self.assertEqual(response.status_code, 400, response.data)

    def test_dto_checks_the_shape_with_nothing_required(self) -> None:
        self.assertIsNone(ArtistCreateDTO(**self.PAYLOAD).assessed_tessitura_low)
        with self.assertRaises(ValidationError):
            ArtistCreateDTO(**self.PAYLOAD, assessed_tessitura_low=69, assessed_tessitura_high=48)


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
            assessed_tessitura_low=60, assessed_tessitura_high=81,
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
        self.assertEqual(self.singer.assessed_tessitura_low, 60)

        self.assertEqual(response.data["proposed_tessitura_low"], 57)
        for field in ASSESSED_FIELDS:
            self.assertNotIn(field, response.data)

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
        # A singer cannot write the conductor's verdict on themselves.
        self.client.force_authenticate(self.singer_user)
        bad = {**self.VALID_PAYLOAD, "assessed_tessitura_low": 40}
        response = self.client.put(_VOCAL_RANGE_URL, bad, format="json")
        self.assertEqual(response.status_code, 400)
        self.singer.refresh_from_db()
        self.assertEqual(self.singer.assessed_tessitura_low, 60)


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
            assessed_tessitura_low=48, assessed_tessitura_high=69, assessed_extreme_high=72,
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

    def test_delegate_never_sees_the_proposal_the_comment_or_the_assessment(self) -> None:
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
        self.assertNotIn("assessed", blob)

    def test_delegate_cannot_open_the_singers_artist_record(self) -> None:
        # A delegation is not the manager role: `ArtistViewSet` narrows a
        # non-manager to their own row, so `ArtistDetailedSerializer` (which
        # carries the proposal and the assessment) is never reached for
        # somebody else.
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
            assessed_tessitura_low=53, assessed_tessitura_high=74,
            assessed_extreme_low=50, assessed_extreme_high=79,
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
        self.assertEqual(
            [getattr(artist, field) for field in ASSESSED_FIELDS], [53, 74, 50, 79],
        )


class VocalRangeGdprExportTests(TestCase):
    """The proposal and comment travel with the singer's own GDPR export; the
    conductor's assessment does not."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "vr-export", "vr-export@test.pl", "pw123456",
            first_name="Ewa", last_name="Export",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=self.user, first_name="Ewa", last_name="Export",
            email="vr-export@test.pl", voice_type=VoiceType.MEZZO,
            assessed_tessitura_low=57, assessed_tessitura_high=77,
        )
        VocalRangeService.submit_proposal(
            artist,
            VocalRangeProposalDTO(
                tessitura_low=53, tessitura_high=72, extreme_low=50,
                comment="Do dyrygenta",
            ),
        )

    def test_export_carries_the_proposal_and_comment(self) -> None:
        export = UserPreferencesService.generate_gdpr_export(self.user, {})
        proposal = export["artist_profile"]["vocal_range_proposal"]
        self.assertEqual(proposal["tessitura_low"], 53)
        self.assertEqual(proposal["tessitura_high"], 72)
        self.assertEqual(proposal["extreme_low"], 50)
        self.assertIsNone(proposal["extreme_high"])
        self.assertEqual(proposal["comment"], "Do dyrygenta")
        self.assertIsNotNone(proposal["proposed_at"])

    def test_export_never_carries_the_assessment(self) -> None:
        export = UserPreferencesService.generate_gdpr_export(self.user, {})
        self.assertNotIn("assessed", json.dumps(export, default=str))


class AssessedRangeMigrationTests(SimpleTestCase):
    """`roster/0067`: the conductor's SPN text onto the MIDI tessitura pair."""

    def test_parses_spn_in_either_case_with_accidentals(self) -> None:
        cases = {"G3": 55, "a5": 81, "C#4": 61, "Bb2": 46, "bb2": 46, " c4 ": 60, "C-1": 0, "B9": 131}
        for text, midi in cases.items():
            self.assertEqual(MIGRATION_0067.parse_spn(text), midi, text)

    def test_refuses_what_is_not_one_spn_note(self) -> None:
        for text in ("", "junk", "H4", "a¹", "C10", "C#", "4", "Cis4", "G"):
            self.assertIsNone(MIGRATION_0067.parse_spn(text), text)

    def test_a_pair_becomes_the_tessitura(self) -> None:
        self.assertEqual(MIGRATION_0067.convert_pair("F3", "D5"), (53, 74))
        self.assertIsNone(MIGRATION_0067.convert_pair("", ""))
        self.assertIsNone(MIGRATION_0067.convert_pair(None, "  "))

    def test_refuses_a_lone_bound_junk_an_inverted_pair_and_the_out_of_range(self) -> None:
        for bottom, top in (("G2", ""), ("", "C5"), ("junk", "C5"), ("C5", "G2"), ("C4", "C4"), ("C0", "C4")):
            with self.assertRaises(ValueError, msg=(bottom, top)):
                MIGRATION_0067.convert_pair(bottom, top)

    def test_refusal_lists_every_bad_row_and_converts_nothing(self) -> None:
        rows = [
            ("good-1", "F3", "D5"),
            ("bad-lone", "G2", ""),
            ("blank", "", ""),
            ("bad-junk", "a¹", "c³"),
            ("bad-inverted", "C5", "G2"),
        ]
        with self.assertRaises(RuntimeError) as caught:
            MIGRATION_0067.convert_rows(rows)
        message = str(caught.exception)
        for pk in ("bad-lone", "bad-junk", "bad-inverted"):
            self.assertIn(f"id={pk}", message)
        self.assertNotIn("good-1", message)
        self.assertNotIn("id=blank", message)

    def test_clean_rows_convert_and_blanks_are_skipped(self) -> None:
        rows = [("a", "F3", "D5"), ("b", "", ""), ("c", "E2", "e4")]
        self.assertEqual(MIGRATION_0067.convert_rows(rows), {"a": (53, 74), "c": (40, 64)})

    def test_the_reverse_spelling_parses_back(self) -> None:
        for midi in (21, 46, 60, 61, 81, 108):
            self.assertEqual(MIGRATION_0067.parse_spn(MIGRATION_0067.midi_to_spn(midi)), midi)
