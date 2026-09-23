"""
The manager's preview of a member's own view — `?artist=<id>` on the read-models.

Two things are being pinned here, and they pull in opposite directions. The
preview has to answer with the *member's* rows — otherwise the conductor asking
"does Kasia see the score yet" is looking at their own screen with her name on it.
And it has to answer with *fewer* rows than she gets: the songbook promises her
that her practice marks are hers alone, so the one thing withheld from the
preview is the one thing she was told nobody else can see.

The gate itself is one function, `core.preview.resolve_preview_target`, and every
endpoint resolves through it — so the refusals are asserted once per shape here
rather than once per endpoint.
"""

from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db import connection
from django.utils import timezone
from rest_framework.test import APITestCase

from archive.models import Piece
from core.constants import AppRole
from core.models import UserProfile
from documents.models import DocumentCategory
from finance.dtos import FeeBatchDTO
from finance.services.ledger import LedgerService
from roster.models import (
    Artist,
    Participation,
    PieceReadiness,
    ProgramItem,
    Project,
    Rehearsal,
    VoiceType,
)

SCHEDULE_URL = "/api/participations/schedule-dashboard/"
MATERIALS_URL = "/api/participations/materials-dashboard/"
ENSEMBLE_URL = "/api/documents/my-ensemble/"
METRICS_URL = "/api/documents/artist-metrics/"
CATEGORIES_URL = "/api/documents/categories/"

# Keys only the finance ledger writes. None may appear in a member-facing payload.
FINANCE_KEYS = frozenset({"contract_amount", "cost_amount", "cost_item_id", "ledger", "paid_on", "contract"})


def _all_keys(payload: Any) -> set[str]:
    """Every mapping key anywhere in a response body, however deep."""
    if isinstance(payload, dict):
        return set(payload) | {key for value in payload.values() for key in _all_keys(value)}
    if isinstance(payload, list):
        return {key for value in payload for key in _all_keys(value)}
    return set()


class ArtistPreviewTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()

        self.singer_user = User.objects.create_user(
            username="prev-singer", email="prev-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Kasia", last_name="Podgląd",
            email="prev-singer@test.pl", voice_type=VoiceType.SOPRANO,
        )

        self.other_user = User.objects.create_user(
            username="prev-other", email="prev-other@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.other_user, role=AppRole.ARTIST)
        self.other = Artist.objects.create(
            user=self.other_user, first_name="Olga", last_name="Obca",
            email="prev-other@test.pl", voice_type=VoiceType.ALTO,
        )

        self.manager_user = User.objects.create_user(
            username="prev-mgr", email="prev-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        # A roster row for somebody who was entered but never activated: real in
        # the roster, with nothing behind it to look at.
        self.accountless = Artist.objects.create(
            user=None, first_name="Bez", last_name="Konta",
            email="prev-none@test.pl", voice_type=VoiceType.TENOR,
        )
        self.archived = Artist.objects.create(
            user=None, first_name="Arch", last_name="Iwum",
            email="prev-arch@test.pl", voice_type=VoiceType.BASS, is_active=False,
        )

        self.project = Project.objects.create(
            title="Nieszpory Adwentowe",
            date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.seat = Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.piece = Piece.objects.create(title="Ave Maria")
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)

        # What she told nobody: she knows this one.
        PieceReadiness.objects.create(
            participation=self.seat, piece=self.piece,
            status=PieceReadiness.Status.READY,
        )

        self.rehearsal = Rehearsal.objects.create(
            project=self.project,
            date_time=timezone.now() + timedelta(days=7),
            timezone="Europe/Warsaw",
        )

        # A finished concert, so the membership card has a figure worth telling
        # apart from the manager's (who has no artist row at all).
        self.past_project = Project.objects.create(
            title="Kolędy 2025",
            date_time=timezone.now() - timedelta(days=300),
            status=Project.Status.COMPLETED,
        )
        Participation.objects.create(
            artist=self.singer, project=self.past_project,
            status=Participation.Status.CONFIRMED,
        )

    def _get(self, user, url: str, artist: Artist | None = None):
        self.client.force_authenticate(user=user)
        params = {"artist": str(artist.id)} if artist is not None else {}
        return self.client.get(url, params)

    # ── The gate ─────────────────────────────────────────────────────────

    def test_a_singer_naming_somebody_else_is_refused_not_redirected(self) -> None:
        # The dangerous failure mode is a silent fallback to the caller's own
        # rows: the page would then show Olga's name over Kasia's schedule, and
        # nothing on screen would say so.
        response = self._get(self.singer_user, SCHEDULE_URL, artist=self.other)

        self.assertEqual(response.status_code, 403)

    def test_a_manager_naming_a_stranger_gets_a_not_found(self) -> None:
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(
            SCHEDULE_URL, {"artist": "00000000-0000-0000-0000-000000000000"}
        )

        self.assertEqual(response.status_code, 404)

    def test_a_manager_naming_a_non_uuid_gets_a_not_found(self) -> None:
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(SCHEDULE_URL, {"artist": "kasia"})

        self.assertEqual(response.status_code, 404)

    def test_a_member_with_no_account_reports_that_rather_than_an_empty_view(self) -> None:
        response = self._get(self.manager_user, SCHEDULE_URL, artist=self.accountless)

        self.assertEqual(response.status_code, 409)
        # The shared envelope flattens DRF's own code into `error_code` by status,
        # so the reason travels as the sentence — which is translated server-side
        # and is what the preview page shows verbatim.
        self.assertTrue(response.data["errors"]["detail"])

    def test_an_archived_member_has_no_current_view(self) -> None:
        response = self._get(self.manager_user, SCHEDULE_URL, artist=self.archived)

        self.assertEqual(response.status_code, 409)

    def test_without_the_parameter_everyone_still_gets_their_own(self) -> None:
        response = self._get(self.singer_user, SCHEDULE_URL)

        self.assertEqual(response.status_code, 200)
        project_ids = {
            item["project"]["id"] for item in response.data if item["type"] == "PROJECT"
        }
        self.assertIn(str(self.project.id), project_ids)

    # ── The schedule ─────────────────────────────────────────────────────

    def test_the_preview_shows_the_members_timeline_not_the_managers(self) -> None:
        # The manager's own timeline is the season read from the office: every
        # evening is there and a seat in none of them, so what separates it from
        # a member's is the participation, not the dates.
        own = self._get(self.manager_user, SCHEDULE_URL)
        self.assertTrue(own.data)
        self.assertEqual({item["participation_id"] for item in own.data}, {None})

        preview = self._get(self.manager_user, SCHEDULE_URL, artist=self.singer)

        self.assertEqual(preview.status_code, 200)
        kinds = [item["type"] for item in preview.data]
        self.assertIn("PROJECT", kinds)
        self.assertIn("REHEARSAL", kinds)
        # Her seats, so the rows carry the participation the RSVP would hang off —
        # the frontend needs it to render the same card she sees.
        her_seats = set(
            Participation.objects.filter(artist=self.singer).values_list("id", flat=True)
        )
        seen = {item["participation_id"] for item in preview.data}
        self.assertIn(str(self.seat.id), seen)
        self.assertTrue(seen <= {str(pid) for pid in her_seats})

    # ── The songbook, and the one thing withheld ─────────────────────────

    def test_a_singer_still_sees_her_own_readiness(self) -> None:
        response = self._get(self.singer_user, MATERIALS_URL)

        self.assertEqual(response.status_code, 200)
        [row] = [r for r in response.data if r["participation_id"] == str(self.seat.id)]
        self.assertEqual(row["program"][0]["piece"]["my_readiness"], "READY")

    def test_the_preview_withholds_readiness_as_null_never_as_not_started(self) -> None:
        # NOT_STARTED would read as "she has not touched it", which is a claim
        # about her; null is the refusal to make one.
        response = self._get(self.manager_user, MATERIALS_URL, artist=self.singer)

        self.assertEqual(response.status_code, 200)
        [row] = [r for r in response.data if r["participation_id"] == str(self.seat.id)]
        self.assertIsNone(row["program"][0]["piece"]["my_readiness"])

    def test_the_preview_otherwise_carries_the_members_programme(self) -> None:
        response = self._get(self.manager_user, MATERIALS_URL, artist=self.singer)

        titles = {
            item["piece"]["title"] for row in response.data for item in row["program"]
        }
        self.assertEqual(titles, {"Ave Maria"})

    def test_the_songbook_carries_no_money_for_anybody(self) -> None:
        # The singer's own figure reaches them through a contract, never through
        # the songbook. Asserted on the key rather than on its value, so a `fee`
        # re-added to the seat as `None` still fails.
        own = self._get(self.singer_user, MATERIALS_URL)
        preview = self._get(self.manager_user, MATERIALS_URL, artist=self.singer)

        for response in (own, preview):
            for row in response.data:
                self.assertNotIn("fee", row)

    def test_the_finance_ledger_is_refused_to_members_and_absent_from_their_views(self) -> None:
        # The ledger is the managers' alone and is never embedded elsewhere: a
        # member's own figure reaches them on paper, not through the app. Priced
        # through the real service, so the keys scanned for are the ledger's own.
        LedgerService.apply_fee_batch(
            self.project,
            FeeBatchDTO.model_validate(
                {"items": [{"ref": {"participation": str(self.seat.id)}, "contract_amount": "250"}]}
            ),
            actor=self.manager_user,
        )
        budget_url = f"/api/finance/projects/{self.project.id}/budget/"

        self.assertEqual(self._get(self.singer_user, budget_url).status_code, 403)
        self.assertEqual(self._get(self.singer_user, budget_url, artist=self.singer).status_code, 403)
        for url in (SCHEDULE_URL, MATERIALS_URL, ENSEMBLE_URL, METRICS_URL):
            own = self._get(self.singer_user, url)
            preview = self._get(self.manager_user, url, artist=self.singer)
            for label, response in (("own", own), ("preview", preview)):
                with self.subTest(url=url, view=label):
                    self.assertEqual(response.status_code, 200)
                    self.assertFalse(FINANCE_KEYS & _all_keys(response.data))

    # ── The card ─────────────────────────────────────────────────────────

    def test_the_ensemble_directory_answers_as_the_member(self) -> None:
        own = self._get(self.manager_user, ENSEMBLE_URL)
        self.assertFalse(own.data["me"]["is_linked"])

        preview = self._get(self.manager_user, ENSEMBLE_URL, artist=self.singer)

        self.assertTrue(preview.data["me"]["is_linked"])
        self.assertEqual(preview.data["me"]["voice_type_display"], "Sopran")

    def test_the_membership_figures_are_the_members(self) -> None:
        own = self._get(self.manager_user, METRICS_URL)
        self.assertEqual(own.data["total_concerts"], 0)

        preview = self._get(self.manager_user, METRICS_URL, artist=self.singer)

        self.assertEqual(preview.data["total_concerts"], 1)

    def test_the_knowledge_base_is_filtered_to_the_artist_shelf(self) -> None:
        if connection.vendor != "postgresql":
            self.skipTest("allowed_roles filtering needs JSONField __contains")

        DocumentCategory.objects.create(
            name="Statut", slug="prev-statut", allowed_roles=[AppRole.ARTIST],
        )
        DocumentCategory.objects.create(
            name="Umowy", slug="prev-umowy", allowed_roles=[AppRole.MANAGER],
        )

        own = self._get(self.manager_user, CATEGORIES_URL)
        self.assertEqual({c["name"] for c in own.data}, {"Statut", "Umowy"})

        preview = self._get(self.manager_user, CATEGORIES_URL, artist=self.singer)
        self.assertEqual({c["name"] for c in preview.data}, {"Statut"})

    # ── No write path honours the parameter ──────────────────────────────

    def test_the_parameter_cannot_carry_a_write(self) -> None:
        # Readiness is first-person-only at the endpoint, and the preview adds no
        # way around that: a manager aiming the parameter at a write still writes
        # as themselves, and is refused on somebody else's seat.
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.put(
            f"/api/participations/{self.seat.id}/readiness/?artist={self.singer.id}",
            {"piece": str(self.piece.id), "status": "NOT_STARTED"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            PieceReadiness.objects.get(participation=self.seat, piece=self.piece).status,
            PieceReadiness.Status.READY,
        )
