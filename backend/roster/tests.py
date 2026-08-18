import tempfile
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone, translation
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.exceptions import AccountAlreadyActiveException
from core.models import UserProfile
from notifications.models import NotificationLevel, NotificationType

from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectCreateDTO
from .duplicates import DuplicateSignal, find_duplicate_groups
from .exceptions import (
    ActivatedArtistMergeException,
    ActivationResendException,
    ArtistMergeException,
    CastingValidationException,
)
from .infrastructure.document_generator import (
    Audience,
    DocumentGenerator,
    DocumentKind,
    DocumentRenderDependencyError,
)
from .models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    VoiceType,
)
from .serializers import ArtistDetailedSerializer
from .services import (
    ArtistHRService,
    CastingAndCrewService,
    ProjectManagementService,
    RehearsalOperationsService,
)

# Provisioning delegates the email to core.services, so the task is patched there.
EMAIL_TASK = "core.services.send_transactional_email_task.delay"


class RosterDtoTests(SimpleTestCase):
    def test_attendance_dto_accepts_api_aliases_and_internal_field_names(self):
        participation_id = "00000000-0000-0000-0000-000000000001"
        rehearsal_id = "00000000-0000-0000-0000-000000000002"

        # Constructed via pydantic field aliases on purpose (the whole point of this
        # test); the mypy pydantic plugin only sees the field names, so silence it.
        api_dto = AttendanceRecordDTO(  # type: ignore[call-arg]
            requesting_user_id=1,
            participation=participation_id,
            rehearsal=rehearsal_id,
            status="PRESENT",
        )
        internal_dto = AttendanceRecordDTO(
            requesting_user_id=1,
            participation_id=participation_id,
            rehearsal_id=rehearsal_id,
            status="PRESENT",
        )

        self.assertEqual(api_dto.participation_id, internal_dto.participation_id)
        self.assertEqual(api_dto.rehearsal_id, internal_dto.rehearsal_id)

    def test_project_dto_normalizes_title_and_uses_immutable_run_sheet(self):
        dto = ProjectCreateDTO(
            title="  Spring Concert  ",
            date_time="2026-06-01T19:00:00+02:00",
            run_sheet=[{"label": "Doors"}],
        )

        self.assertEqual(dto.title, "Spring Concert")
        self.assertEqual(dto.run_sheet, ({"label": "Doors"},))
        self.assertFalse(hasattr(dto.run_sheet, "append"))


class ArtistProvisioningTests(TestCase):
    @patch(EMAIL_TASK)
    def test_provision_artist_creates_inactive_user_and_queues_activation(self, enqueue_mock):
        dto = ArtistCreateDTO(
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            voice_type="ALT",
        )

        with self.captureOnCommitCallbacks(execute=True):
            artist = ArtistHRService.provision_artist(dto)

        self.assertEqual(artist.email, "ada@example.com")
        assert artist.user is not None  # provisioning always links a user; narrows for the type checker
        self.assertFalse(artist.user.is_active)

        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "account_activation")


class ArtistActivationResendTests(TestCase):
    """Covers re-sending the activation invite to an artist who never activated."""

    def _provision(self, enqueue_mock) -> Artist:
        dto = ArtistCreateDTO(
            first_name="Grace",
            last_name="Hopper",
            email="grace@example.com",
            voice_type="ALT",
        )
        with self.captureOnCommitCallbacks(execute=True):
            artist = ArtistHRService.provision_artist(dto)
        enqueue_mock.reset_mock()
        return artist

    @patch(EMAIL_TASK)
    def test_resend_requeues_activation_email_for_pending_account(self, enqueue_mock):
        artist = self._provision(enqueue_mock)
        original_sent_at = artist.activation_email_sent_at
        assert original_sent_at is not None  # stamped at provisioning; narrows for mypy

        ArtistHRService.resend_activation(artist)

        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "account_activation")
        self.assertEqual(enqueue_mock.call_args.kwargs["recipient_email"], "grace@example.com")
        # The resend advances the recorded send time so the roster reflects it.
        artist.refresh_from_db()
        new_sent_at = artist.activation_email_sent_at
        assert new_sent_at is not None
        self.assertGreaterEqual(new_sent_at, original_sent_at)

    @patch(EMAIL_TASK)
    def test_resend_rejects_already_activated_account(self, enqueue_mock):
        artist = self._provision(enqueue_mock)
        assert artist.user is not None
        # A usable password is the marker of a completed activation.
        artist.user.set_password("already-activated-pw")
        artist.user.is_active = True
        artist.user.save(update_fields=["password", "is_active"])

        with self.assertRaises(AccountAlreadyActiveException):
            ArtistHRService.resend_activation(artist)
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_resend_rejects_artist_without_linked_account(self, enqueue_mock):
        artist = self._provision(enqueue_mock)
        artist.user = None
        artist.save(update_fields=["user"])

        with self.assertRaises(ActivationResendException):
            ArtistHRService.resend_activation(artist)
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_activation_link_expired_flag_tracks_the_validity_window(self, enqueue_mock):
        artist = self._provision(enqueue_mock)
        serializer = ArtistDetailedSerializer()

        # Freshly invited → link still valid.
        self.assertFalse(serializer.get_activation_link_expired(artist))

        # Sent longer ago than PASSWORD_RESET_TIMEOUT (default 3 days) → expired.
        timeout = getattr(settings, "PASSWORD_RESET_TIMEOUT", 60 * 60 * 24 * 3)
        artist.activation_email_sent_at = timezone.now() - timedelta(seconds=timeout + 3600)
        artist.save(update_fields=["activation_email_sent_at"])
        self.assertTrue(serializer.get_activation_link_expired(artist))

        # Once activated, expiry is irrelevant → False even for an old send.
        assert artist.user is not None
        artist.user.set_password("activated-now")
        artist.user.save(update_fields=["password"])
        self.assertFalse(serializer.get_activation_link_expired(artist))


class ArtistResendActivationEndpointTests(APITestCase):
    """API cover for POST /api/artists/{id}/resend-activation/: the manager-only
    gate, the 204 success contract, and the already-activated rejection surfaced
    as a stable ``account_already_active`` code the client maps to copy."""

    @patch(EMAIL_TASK)
    def setUp(self, enqueue_mock) -> None:
        # The throttle bucket lives in the process cache, not the DB — clear it so
        # a rate hit from a previous test never leaks into this one.
        from django.core.cache import cache
        cache.clear()

        User = get_user_model()
        self.manager = User.objects.create_user(
            username="mgr-resend", email="mgr-resend@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.non_manager = User.objects.create_user(
            username="singer-resend", email="singer-resend@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.non_manager, role=AppRole.ARTIST)

        dto = ArtistCreateDTO(
            first_name="Grace",
            last_name="Hopper",
            email="grace-endpoint@example.com",
            voice_type="ALT",
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.artist = ArtistHRService.provision_artist(dto)

    def _url(self, artist: Artist) -> str:
        return f"/api/artists/{artist.id}/resend-activation/"

    @patch(EMAIL_TASK)
    def test_manager_resend_returns_204_and_dispatches(self, enqueue_mock):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(self._url(self.artist))
        self.assertEqual(resp.status_code, 204)
        enqueue_mock.assert_called_once()

    @patch(EMAIL_TASK)
    def test_non_manager_is_forbidden(self, enqueue_mock):
        self.client.force_authenticate(user=self.non_manager)
        resp = self.client.post(self._url(self.artist))
        self.assertEqual(resp.status_code, 403)
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_already_activated_rejected_with_stable_code(self, enqueue_mock):
        assert self.artist.user is not None
        self.artist.user.set_password("already-activated-pw")
        self.artist.user.save(update_fields=["password"])

        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(self._url(self.artist))

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error_code"], "account_already_active")
        enqueue_mock.assert_not_called()


class ProjectUpdateServiceTests(TestCase):
    """Regression cover for the location FK being dropped on project update."""

    def _make_project(self):
        from django.utils import timezone

        from .models import Project

        return Project.objects.create(
            title="Spring Gala",
            date_time=timezone.now(),
            timezone="UTC",
        )

    def _make_location(self, name="National Philharmonic", tz="Europe/Warsaw"):
        from logistics.models import Location

        return Location.objects.create(
            name=name,
            category="CONCERT_HALL",
            formatted_address="Jasna 5, Warsaw",
            timezone=tz,
        )

    def test_update_persists_location_and_overrides_timezone(self):
        from .dtos import ProjectUpdateDTO
        from .services import ProjectManagementService

        project = self._make_project()
        location = self._make_location()

        ProjectManagementService.update_project(
            project, ProjectUpdateDTO(location_id=location.id)
        )
        project.refresh_from_db()

        self.assertEqual(project.location_id, location.id)
        # Timezone is the single source of truth from the resolved location.
        self.assertEqual(project.timezone, "Europe/Warsaw")

    def test_update_of_unrelated_field_keeps_existing_location(self):
        from .dtos import ProjectUpdateDTO
        from .services import ProjectManagementService

        project = self._make_project()
        location = self._make_location()

        ProjectManagementService.update_project(
            project, ProjectUpdateDTO(location_id=location.id)
        )
        ProjectManagementService.update_project(
            project, ProjectUpdateDTO(title="Renamed Gala")
        )
        project.refresh_from_db()

        self.assertEqual(project.title, "Renamed Gala")
        self.assertEqual(project.location_id, location.id)

    def test_update_can_clear_location(self):
        from .dtos import ProjectUpdateDTO
        from .services import ProjectManagementService

        project = self._make_project()
        location = self._make_location()

        ProjectManagementService.update_project(
            project, ProjectUpdateDTO(location_id=location.id)
        )
        ProjectManagementService.update_project(
            project, ProjectUpdateDTO(location_id=None)
        )
        project.refresh_from_db()

        self.assertIsNone(project.location_id)


class ArtistDossierQueryTests(TestCase):
    def test_dossier_aggregates_participation_casting_and_attendance(self):
        from datetime import timedelta

        from django.utils import timezone

        from archive.models import Piece

        from .models import (
            Artist,
            Attendance,
            Participation,
            Project,
            ProjectPieceCasting,
            Rehearsal,
        )
        from .queries import get_artist_dossier

        artist = Artist.objects.create(
            first_name="Jan", last_name="Kowalski", email="jan@example.com", voice_type="TEN"
        )

        future = Project.objects.create(
            title="Future Gala",
            date_time=timezone.now() + timedelta(days=10),
            status=Project.Status.ACTIVE,
        )
        past = Project.objects.create(
            title="Past Concert",
            date_time=timezone.now() - timedelta(days=10),
            status=Project.Status.COMPLETED,
        )
        skipped = Project.objects.create(
            title="Skipped",
            date_time=timezone.now() + timedelta(days=5),
            status=Project.Status.ACTIVE,
        )

        p_future = Participation.objects.create(
            artist=artist, project=future, status=Participation.Status.CONFIRMED
        )
        p_past = Participation.objects.create(
            artist=artist, project=past, status=Participation.Status.CONFIRMED
        )
        Participation.objects.create(
            artist=artist, project=skipped, status=Participation.Status.DECLINED
        )

        piece = Piece.objects.create(title="Lacrimosa")
        ProjectPieceCasting.objects.create(participation=p_past, piece=piece, voice_line="T1")
        ProjectPieceCasting.objects.create(participation=p_future, piece=piece, voice_line="T1")

        rehearsal = Rehearsal.objects.create(
            project=past, date_time=timezone.now() - timedelta(days=12)
        )
        rehearsal.invited_participations.add(p_past)
        Attendance.objects.create(
            rehearsal=rehearsal, participation=p_past, status=Attendance.Status.PRESENT
        )

        dossier = get_artist_dossier(artist)
        stats = dossier["stats"]

        self.assertEqual(stats["projects_total"], 3)
        self.assertEqual(stats["projects_confirmed"], 2)
        self.assertEqual(stats["projects_upcoming"], 1)
        self.assertEqual(stats["projects_completed"], 1)
        self.assertEqual(stats["invitations_declined"], 1)
        self.assertAlmostEqual(stats["acceptance_rate"], 2 / 3)
        self.assertEqual(stats["attendance_present"], 1)
        self.assertEqual(stats["attendance_rate"], 1.0)
        self.assertEqual(stats["rehearsals_invited"], 1)
        self.assertEqual(stats["top_voice_lines"][0]["voice_line"], "T1")
        self.assertEqual(stats["top_voice_lines"][0]["count"], 2)
        self.assertEqual(stats["top_voice_lines"][0]["label"], "Tenor 1")
        self.assertEqual(len(dossier["projects"]), 3)
        # History is ordered newest-first by project date; each carries its castings.
        self.assertEqual(dossier["projects"][0]["title"], "Future Gala")
        past_entry = next(p for p in dossier["projects"] if p["title"] == "Past Concert")
        self.assertEqual(past_entry["castings"][0]["voice_line_label"], "Tenor 1")

    def test_dossier_reports_earnings_excluding_declined(self):
        from datetime import timedelta
        from decimal import Decimal

        from django.utils import timezone

        from .models import Artist, Participation, Project
        from .queries import get_artist_dossier

        artist = Artist.objects.create(
            first_name="Eve", last_name="Earner", email="eve@example.com", voice_type="SOP"
        )
        p1 = Project.objects.create(title="Gala A", date_time=timezone.now() - timedelta(days=5))
        p2 = Project.objects.create(title="Gala B", date_time=timezone.now() - timedelta(days=2))
        p3 = Project.objects.create(title="Gala C", date_time=timezone.now() + timedelta(days=5))

        # Paid 500, owed 300, and a declined 999 that must be ignored entirely.
        Participation.objects.create(
            artist=artist, project=p1, status=Participation.Status.CONFIRMED,
            fee=Decimal("500.00"), is_paid=True,
        )
        Participation.objects.create(
            artist=artist, project=p2, status=Participation.Status.CONFIRMED,
            fee=Decimal("300.00"), is_paid=False,
        )
        Participation.objects.create(
            artist=artist, project=p3, status=Participation.Status.DECLINED,
            fee=Decimal("999.00"), is_paid=False,
        )

        stats = get_artist_dossier(artist)["stats"]
        self.assertEqual(stats["earnings_paid"], 500.0)
        self.assertEqual(stats["earnings_outstanding"], 300.0)
        self.assertEqual(stats["projects_paid"], 1)


class ContractsSettlementTests(APITestCase):
    """
    API cover for the settlement cockpit: the payment toggle, the crew label
    payload, and the contract PDF / project ZIP endpoints (the latter were
    previously called by the frontend but had no backing route).
    """

    def setUp(self) -> None:
        from decimal import Decimal

        from django.utils import timezone

        from core.constants import AppRole
        from core.models import UserProfile

        from .models import Artist, Collaborator, CrewAssignment, Participation, Project, VoiceType

        User = get_user_model()

        self.manager = User.objects.create_user(
            username="mgr", email="mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.artist_user = User.objects.create_user(
            username="singer", email="singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.artist_user, role=AppRole.ARTIST)

        # Announced, not the model default: what a chorister may read here is
        # gated on holding a seat in a project they have been told about.
        self.project = Project.objects.create(
            title="Spring Gala", date_time=timezone.now(), timezone="UTC",
            status=Project.Status.ACTIVE,
        )
        self.artist = Artist.objects.create(
            user=self.artist_user, first_name="Ada", last_name="Lovelace",
            email="singer@test.pl", voice_type=VoiceType.ALTO,
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.CONFIRMED, fee=Decimal("500.00"),
        )
        self.collaborator = Collaborator.objects.create(
            first_name="Sound", last_name="Engineer",
            specialty=Collaborator.Specialty.SOUND,
        )
        self.crew = CrewAssignment.objects.create(
            collaborator=self.collaborator, project=self.project,
            role_description="FOH mix", fee=Decimal("800.00"),
        )

    # ------------------------------------------------------------------ #
    # Payment toggle                                                     #
    # ------------------------------------------------------------------ #

    def test_payment_toggle_sets_and_clears_paid_at_for_cast(self) -> None:
        self.client.force_authenticate(user=self.manager)
        url = f"/api/participations/{self.participation.id}/payment/"

        resp = self.client.patch(url, {"is_paid": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.participation.refresh_from_db()
        self.assertTrue(self.participation.is_paid)
        self.assertIsNotNone(self.participation.paid_at)

        resp = self.client.patch(url, {"is_paid": False}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.participation.refresh_from_db()
        self.assertFalse(self.participation.is_paid)
        self.assertIsNone(self.participation.paid_at)

    def test_payment_toggle_works_for_crew(self) -> None:
        self.client.force_authenticate(user=self.manager)
        url = f"/api/crew-assignments/{self.crew.id}/payment/"

        resp = self.client.patch(url, {"is_paid": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.crew.refresh_from_db()
        self.assertTrue(self.crew.is_paid)
        self.assertIsNotNone(self.crew.paid_at)

    def test_payment_rejects_non_boolean(self) -> None:
        self.client.force_authenticate(user=self.manager)
        url = f"/api/participations/{self.participation.id}/payment/"
        resp = self.client.patch(url, {"is_paid": "yes"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_payment_forbidden_for_non_manager(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        url = f"/api/participations/{self.participation.id}/payment/"
        resp = self.client.patch(url, {"is_paid": True}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_fee_action_updates_fee_and_ignores_payment_fields(self) -> None:
        from decimal import Decimal

        # The dedicated fee action sidesteps the conditional UniqueConstraint that
        # makes the generic Participation PATCH 500, and only ever touches `fee`.
        self.client.force_authenticate(user=self.manager)
        url = f"/api/participations/{self.participation.id}/fee/"
        resp = self.client.patch(url, {"fee": "750.50", "is_paid": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.participation.refresh_from_db()
        self.assertEqual(self.participation.fee, Decimal("750.50"))
        self.assertFalse(self.participation.is_paid)

    def test_fee_action_rejects_negative_value(self) -> None:
        self.client.force_authenticate(user=self.manager)
        url = f"/api/participations/{self.participation.id}/fee/"
        resp = self.client.patch(url, {"fee": "-10"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_fee_action_clears_fee_on_null(self) -> None:
        self.client.force_authenticate(user=self.manager)
        url = f"/api/crew-assignments/{self.crew.id}/fee/"
        resp = self.client.patch(url, {"fee": None}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.crew.refresh_from_db()
        self.assertIsNone(self.crew.fee)

    def test_bulk_fee_skips_paid_and_declined(self) -> None:
        from decimal import Decimal

        from .models import Artist, Participation, VoiceType

        paid_artist = Artist.objects.create(
            first_name="Paid", last_name="Singer",
            email="paid@test.pl", voice_type=VoiceType.SOPRANO,
        )
        paid_part = Participation.objects.create(
            artist=paid_artist, project=self.project,
            status=Participation.Status.CONFIRMED, fee=Decimal("800.00"),
            is_paid=True,
        )
        declined_artist = Artist.objects.create(
            first_name="Out", last_name="Singer",
            email="out@test.pl", voice_type=VoiceType.BASS,
        )
        declined_part = Participation.objects.create(
            artist=declined_artist, project=self.project,
            status=Participation.Status.DECLINED,
        )

        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            "/api/participations/bulk-fee/",
            {"project_id": str(self.project.id), "fee": "500"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        # The unpaid, confirmed singer is re-priced…
        self.participation.refresh_from_db()
        self.assertEqual(self.participation.fee, Decimal("500.00"))
        # …but the already-settled fee and the declined artist are left untouched.
        paid_part.refresh_from_db()
        self.assertEqual(paid_part.fee, Decimal("800.00"))
        declined_part.refresh_from_db()
        self.assertIsNone(declined_part.fee)
        self.assertEqual(resp.data["updated_count"], 1)

    def test_crew_bulk_fee_skips_paid(self) -> None:
        from decimal import Decimal

        from .models import Collaborator, CrewAssignment

        paid_collab = Collaborator.objects.create(
            first_name="Paid", last_name="Tech", specialty=Collaborator.Specialty.LIGHT,
        )
        paid_crew = CrewAssignment.objects.create(
            collaborator=paid_collab, project=self.project,
            fee=Decimal("900.00"), is_paid=True,
        )

        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            "/api/crew-assignments/bulk-fee/",
            {"project_id": str(self.project.id), "fee": "300"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

        self.crew.refresh_from_db()
        self.assertEqual(self.crew.fee, Decimal("300.00"))  # unpaid crew re-priced
        paid_crew.refresh_from_db()
        self.assertEqual(paid_crew.fee, Decimal("900.00"))  # settled fee untouched
        self.assertEqual(resp.data["updated_count"], 1)

    def test_crew_bulk_fee_forbidden_for_non_manager(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.patch(
            "/api/crew-assignments/bulk-fee/",
            {"project_id": str(self.project.id), "fee": "300"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_crew_fee_hidden_from_non_managers(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.get(f"/api/crew-assignments/{self.crew.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("fee", resp.data)
        self.assertNotIn("is_paid", resp.data)
        # Non-sensitive labels stay available.
        self.assertEqual(resp.data["collaborator_name"], "Sound Engineer")

    # ------------------------------------------------------------------ #
    # Crew label payload                                                 #
    # ------------------------------------------------------------------ #

    def test_crew_serializer_exposes_name_and_specialty(self) -> None:
        self.client.force_authenticate(user=self.manager)
        # Pin the language so the translated choice display is deterministic.
        # LocaleMiddleware IS active, so it activates the request's Accept-Language
        # mid-request — a bare translation.override() gets overridden. Send the
        # header to render the choice display under English.
        #
        # And put it back: the middleware activates for the whole thread and
        # never deactivates, so without this every later test in the process
        # runs under English — which is invisible until some other suite asserts
        # on translated copy, as the call sheet's now does.
        self.addCleanup(translation.deactivate)
        resp = self.client.get(
            f"/api/crew-assignments/{self.crew.id}/",
            HTTP_ACCEPT_LANGUAGE="en",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["collaborator_name"], "Sound Engineer")
        self.assertEqual(resp.data["collaborator_specialty_display"], "Sound Engineering")

    # ------------------------------------------------------------------ #
    # Contract PDF                                                       #
    # ------------------------------------------------------------------ #

    @patch("roster.views.DocumentGenerator.generate_participation_contract_pdf")
    def test_contract_pdf_streams_for_cast(self, render_mock) -> None:
        render_mock.return_value = b"%PDF-1.4 fake"
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/participations/{self.participation.id}/contract/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertIn("attachment", resp["Content-Disposition"])
        self.assertEqual(b"".join(resp.streaming_content), b"%PDF-1.4 fake")  # type: ignore[attr-defined]
        render_mock.assert_called_once()

    @patch("roster.views.DocumentGenerator.generate_crew_contract_pdf")
    def test_contract_pdf_streams_for_crew(self, render_mock) -> None:
        render_mock.return_value = b"%PDF-1.4 crew"
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/crew-assignments/{self.crew.id}/contract/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b"".join(resp.streaming_content), b"%PDF-1.4 crew")  # type: ignore[attr-defined]

    @patch("roster.views.DocumentGenerator.generate_participation_contract_pdf")
    def test_contract_pdf_returns_503_when_renderer_missing(self, render_mock) -> None:
        render_mock.side_effect = DocumentRenderDependencyError("no native libs")
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/participations/{self.participation.id}/contract/")
        self.assertEqual(resp.status_code, 503)

    # ------------------------------------------------------------------ #
    # Project ZIP                                                        #
    # ------------------------------------------------------------------ #

    @patch("roster.views.generate_project_zip_task")
    def test_request_project_zip_enqueues_task(self, task_mock) -> None:
        task_mock.delay.return_value = MagicMock(id="task-123")
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/participations/request_project_zip/",
            {"project_id": str(self.project.id)}, format="json",
        )
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.data["task_id"], "task-123")
        task_mock.delay.assert_called_once_with(str(self.project.id))

    def test_request_project_zip_requires_project_id(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/participations/request_project_zip/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    @patch("roster.views.AsyncResult")
    def test_check_zip_status_reports_success(self, async_mock) -> None:
        async_mock.return_value = MagicMock(
            state="SUCCESS", result={"download_url": "/media/exports/x.zip"}
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get("/api/participations/check_zip_status/?task_id=abc")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["state"], "SUCCESS")
        self.assertEqual(resp.data["file_url"], "/media/exports/x.zip")

    @patch("roster.views.AsyncResult")
    def test_check_zip_status_maps_empty_project_to_failure(self, async_mock) -> None:
        async_mock.return_value = MagicMock(
            state="SUCCESS", result={"error": "no_personnel_in_project"}
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get("/api/participations/check_zip_status/?task_id=abc")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["state"], "FAILURE")
        self.assertIn("error", resp.data)


class CollaboratorPiiExposureTests(APITestCase):
    """
    A non-manager must never be able to read an external collaborator's contact
    PII (email / phone) through the roster endpoints, while managers still see
    the full record. Guards against regressing the role-based serializer split
    on `CollaboratorViewSet`.
    """

    def setUp(self) -> None:
        from core.constants import AppRole
        from core.models import UserProfile

        from .models import Collaborator

        User = get_user_model()

        self.manager = User.objects.create_user(
            username="mgr-collab", email="mgr-collab@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.artist_user = User.objects.create_user(
            username="singer-collab", email="singer-collab@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.artist_user, role=AppRole.ARTIST)

        self.collaborator = Collaborator.objects.create(
            first_name="Sound", last_name="Engineer",
            email="foh@external.example", phone_number="+48123456789",
            company_name="Acme Audio", specialty=Collaborator.Specialty.SOUND,
        )

    def test_non_manager_list_hides_contact_pii(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        # Pin language so the translated specialty display is deterministic.
        # LocaleMiddleware renders the response under the request's Accept-Language
        # — and leaves it active for the thread, so it has to be put back.
        self.addCleanup(translation.deactivate)
        resp = self.client.get("/api/collaborators/", HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        row = resp.data[0]
        self.assertNotIn("email", row)
        self.assertNotIn("phone_number", row)
        # Professional identity stays visible (it is not personal contact data).
        self.assertEqual(row["last_name"], "Engineer")
        self.assertEqual(row["company_name"], "Acme Audio")
        self.assertEqual(row["specialty_display"], "Sound Engineering")

    def test_non_manager_detail_hides_contact_pii(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.get(f"/api/collaborators/{self.collaborator.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("email", resp.data)
        self.assertNotIn("phone_number", resp.data)

    def test_manager_sees_full_contact_pii(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/collaborators/{self.collaborator.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "foh@external.example")
        self.assertEqual(resp.data["phone_number"], "+48123456789")

    def test_non_manager_cannot_create_collaborator(self) -> None:
        # Write access is still manager-only (IsManagerOrReadOnly).
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.post(
            "/api/collaborators/",
            {"first_name": "New", "last_name": "Crew", "specialty": "OTHER"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


def _pdf_upload(name: str = "score.pdf") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF", content_type="application/pdf")


def _audio_upload(name: str = "track.mp3") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"ID3\x03\x00\x00\x00track", content_type="audio/mpeg")


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MaterialsAccessControlTests(APITestCase):
    """
    The chorister materials boundary: setlists / castings / crew are visible only
    for projects the singer is cast in; the raw repertoire archive is manager-only;
    and scores are delivered through a status-aware gate that revokes access the
    moment the singer's projects featuring the piece close.
    """

    def setUp(self) -> None:
        from django.utils import timezone

        from archive.models import Composer, Piece, ScoreEdition, Track
        from core.constants import AppRole, VoiceLine
        from core.models import UserProfile

        from .models import (
            Artist,
            Collaborator,
            CrewAssignment,
            Participation,
            ProgramItem,
            Project,
            ProjectPieceCasting,
            VoiceType,
        )

        User = get_user_model()
        now = timezone.now()

        self.manager = User.objects.create_user(username="mat-mgr", email="mat-mgr@test.pl", password="pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.singer_user = User.objects.create_user(username="mat-singer", email="mat-singer@test.pl", password="pw123456")
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Mia", last_name="Singer",
            email="mat-singer@test.pl", voice_type=VoiceType.SOPRANO,
        )

        self.outsider_user = User.objects.create_user(username="mat-out", email="mat-out@test.pl", password="pw123456")
        UserProfile.objects.create(user=self.outsider_user, role=AppRole.ARTIST)
        self.outsider = Artist.objects.create(
            user=self.outsider_user, first_name="Otto", last_name="Outsider",
            email="mat-out@test.pl", voice_type=VoiceType.BASS,
        )

        composer = Composer.objects.create(first_name="Johann", last_name="Bach")
        self.piece_live = Piece.objects.create(title="Live Motet", composer=composer)
        self.piece_closed = Piece.objects.create(title="Past Anthem", composer=composer)
        self.piece_foreign = Piece.objects.create(title="Foreign Cantata", composer=composer)

        # Project the singer is actively cast in.
        self.project_live = Project.objects.create(title="Spring Concert", date_time=now, status=Project.Status.ACTIVE)
        self.part_live = Participation.objects.create(
            artist=self.singer, project=self.project_live, status=Participation.Status.CONFIRMED,
        )
        ProgramItem.objects.create(project=self.project_live, piece=self.piece_live, order=1)
        self.casting_live = ProjectPieceCasting.objects.create(
            participation=self.part_live, piece=self.piece_live, voice_line=VoiceLine.SOPRANO_1,
            notes="Lead the descant",
        )
        self.edition_live = ScoreEdition.objects.create(
            piece=self.piece_live, pdf_file=_pdf_upload(), original_filename="live.pdf", sha256="", page_count=1,
        )
        Track.objects.create(piece=self.piece_live, voice_part=VoiceLine.SOPRANO_1, audio_file=_audio_upload())

        # Project the singer was cast in, now completed.
        self.project_closed = Project.objects.create(title="Winter Gala", date_time=now, status=Project.Status.COMPLETED)
        self.part_closed = Participation.objects.create(
            artist=self.singer, project=self.project_closed, status=Participation.Status.CONFIRMED,
        )
        ProgramItem.objects.create(project=self.project_closed, piece=self.piece_closed, order=1)
        self.edition_closed = ScoreEdition.objects.create(
            piece=self.piece_closed, pdf_file=_pdf_upload(), original_filename="closed.pdf", sha256="", page_count=1,
        )
        Track.objects.create(piece=self.piece_closed, voice_part=VoiceLine.ALTO_1, audio_file=_audio_upload())

        # A project the singer has nothing to do with.
        self.project_foreign = Project.objects.create(title="Other Choir Night", date_time=now, status=Project.Status.ACTIVE)
        part_foreign = Participation.objects.create(
            artist=self.outsider, project=self.project_foreign, status=Participation.Status.CONFIRMED,
        )
        ProgramItem.objects.create(project=self.project_foreign, piece=self.piece_foreign, order=1)
        ProjectPieceCasting.objects.create(
            participation=part_foreign, piece=self.piece_foreign, voice_line=VoiceLine.BASS_1,
        )
        self.edition_foreign = ScoreEdition.objects.create(
            piece=self.piece_foreign, pdf_file=_pdf_upload(), original_filename="foreign.pdf", sha256="", page_count=1,
        )
        collaborator = Collaborator.objects.create(
            first_name="Sound", last_name="Guy", specialty=Collaborator.Specialty.SOUND,
        )
        CrewAssignment.objects.create(collaborator=collaborator, project=self.project_foreign)
        self.crew_live = CrewAssignment.objects.create(
            collaborator=collaborator, project=self.project_live, role_description="FOH",
        )

    # --- cross-project partitioning ------------------------------------- #

    def test_singer_program_items_scoped_to_their_projects(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get("/api/program-items/")
        self.assertEqual(resp.status_code, 200)
        piece_ids = {str(row["piece"]) for row in resp.data}
        self.assertIn(str(self.piece_live.id), piece_ids)
        self.assertIn(str(self.piece_closed.id), piece_ids)
        self.assertNotIn(str(self.piece_foreign.id), piece_ids)  # foreign project hidden

    def test_singer_piece_castings_scoped_to_their_projects(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get("/api/piece-castings/")
        self.assertEqual(resp.status_code, 200)
        project_ids = {row["project_id"] for row in resp.data}
        self.assertIn(str(self.project_live.id), project_ids)
        self.assertNotIn(str(self.project_foreign.id), project_ids)

    def test_singer_crew_scoped_to_their_projects(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get("/api/crew-assignments/")
        self.assertEqual(resp.status_code, 200)
        project_ids = {str(row["project"]) for row in resp.data}
        self.assertIn(str(self.project_live.id), project_ids)
        self.assertNotIn(str(self.project_foreign.id), project_ids)

    def test_manager_sees_all_program_items(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get("/api/program-items/")
        piece_ids = {str(row["piece"]) for row in resp.data}
        self.assertIn(str(self.piece_foreign.id), piece_ids)

    # --- raw archive endpoints are manager-only ------------------------- #

    def test_archive_endpoints_are_manager_only_for_singers(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        for path in ("/api/pieces/", "/api/tracks/", "/api/archive/editions/",
                     "/api/composers/", "/api/piece-voice-requirements/"):
            self.assertEqual(self.client.get(path).status_code, 403, msg=path)

    def test_archive_editions_readable_by_manager(self) -> None:
        self.client.force_authenticate(user=self.manager)
        self.assertEqual(self.client.get("/api/archive/editions/").status_code, 200)

    # --- score download gate -------------------------------------------- #

    def _score_url(self, edition) -> str:
        return f"/api/materials/scores/{edition.id}/download/"

    def test_singer_can_download_score_of_live_project(self) -> None:
        # Editions default to a protected licence, so a chorister's copy is
        # watermarked on the way out (rendering is stubbed here — the host has no
        # WeasyPrint; the watermark itself is covered in test_score_protection).
        # This test only asserts the access gate still yields the score.
        self.client.force_authenticate(user=self.singer_user)
        with patch("roster.views.stamp_pdf", return_value=b"%PDF-stamped"):
            resp = self.client.get(self._score_url(self.edition_live))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_singer_cannot_download_score_of_closed_project(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self._score_url(self.edition_closed))
        # 404 (not 403): a revoked score is indistinguishable from a missing one.
        self.assertEqual(resp.status_code, 404)

    def test_singer_cannot_download_score_of_foreign_project(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self._score_url(self.edition_foreign))
        self.assertEqual(resp.status_code, 404)

    def test_manager_can_download_any_score(self) -> None:
        self.client.force_authenticate(user=self.manager)
        for edition in (self.edition_live, self.edition_closed, self.edition_foreign):
            self.assertEqual(self.client.get(self._score_url(edition)).status_code, 200)

    # --- materials dashboard reflects the gate -------------------------- #

    def test_materials_dashboard_locks_closed_project_scores_and_tracks(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get("/api/participations/materials-dashboard/")
        self.assertEqual(resp.status_code, 200)
        by_status = {entry["project"]["status"]: entry for entry in resp.data}

        live_piece = by_status[self.project_live.status]["program"][0]["piece"]
        self.assertEqual(len(live_piece["editions"]), 1)
        self.assertEqual(len(live_piece["tracks"]), 1)
        # The score URL is the gated endpoint, never a bare /media/ link.
        self.assertIn("/api/materials/scores/", live_piece["editions"][0]["pdf_file"])
        self.assertNotIn("/media/", live_piece["editions"][0]["pdf_file"])

        closed_piece = by_status[self.project_closed.status]["program"][0]["piece"]
        self.assertEqual(closed_piece["editions"], [])  # scores withheld after close
        self.assertEqual(closed_piece["tracks"], [])

    # --- project score_pdf endpoint ------------------------------------- #

    def test_project_score_pdf_blocked_for_singer_after_close(self) -> None:
        self.project_closed.score_pdf = _pdf_upload("concert.pdf")
        self.project_closed.save(update_fields=["score_pdf"])

        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/projects/{self.project_closed.id}/score_pdf/")
        self.assertEqual(resp.status_code, 403)

    def test_project_score_pdf_available_to_manager_after_close(self) -> None:
        self.project_closed.score_pdf = _pdf_upload("concert.pdf")
        self.project_closed.save(update_fields=["score_pdf"])

        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/projects/{self.project_closed.id}/score_pdf/")
        self.assertEqual(resp.status_code, 200)

    # --- serializers never leak a bare /media/ score link --------------- #

    def test_project_serializer_score_pdf_is_gated_and_hidden_after_close(self) -> None:
        self.project_live.score_pdf = _pdf_upload("live.pdf")
        self.project_live.save(update_fields=["score_pdf"])
        self.project_closed.score_pdf = _pdf_upload("past.pdf")
        self.project_closed.save(update_fields=["score_pdf"])

        self.client.force_authenticate(user=self.singer_user)
        live = self.client.get(f"/api/projects/{self.project_live.id}/")
        self.assertEqual(live.status_code, 200)
        self.assertIsNotNone(live.data["score_pdf"])
        self.assertIn("/score_pdf/", live.data["score_pdf"])
        self.assertNotIn("/media/", live.data["score_pdf"])

        closed = self.client.get(f"/api/projects/{self.project_closed.id}/")
        self.assertIsNone(closed.data["score_pdf"])  # withheld from singer after close

    def test_project_serializer_score_pdf_visible_to_manager_after_close(self) -> None:
        self.project_closed.score_pdf = _pdf_upload("past.pdf")
        self.project_closed.save(update_fields=["score_pdf"])

        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/projects/{self.project_closed.id}/")
        self.assertIsNotNone(resp.data["score_pdf"])

    def test_archive_edition_pdf_is_served_through_the_gate_for_managers(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/archive/editions/{self.edition_live.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("/api/materials/scores/", resp.data["pdf_file"])
        self.assertNotIn("/media/", resp.data["pdf_file"])

    # --- score annotations: same gate as the score itself --------------- #

    def _make_annotation(self, edition, layer="shared"):
        from archive.models import Annotation
        return Annotation.objects.create(
            edition=edition, page_number=1, annotation_type="FH",
            payload={"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
            layer_name=layer, created_by=self.manager,
        )

    def test_manager_can_create_annotation_and_created_by_is_stamped(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "CM", "payload": {"x": 0.5, "y": 0.5, "text": "Watch me here"},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(str(resp.data["created_by"]), str(self.manager.id))

    def test_singer_cannot_create_annotation(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "CM", "payload": {"x": 0.5, "y": 0.5, "text": "no"},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_singer_sees_only_shared_layer_on_live_edition(self) -> None:
        shared = self._make_annotation(self.edition_live, layer="shared")
        self._make_annotation(self.edition_live, layer="conductor")  # private
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_live.id}")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.data}
        self.assertEqual(ids, {str(shared.id)})

    def test_manager_sees_all_layers_on_live_edition(self) -> None:
        self._make_annotation(self.edition_live, layer="shared")
        self._make_annotation(self.edition_live, layer="conductor")
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_live.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_singer_cannot_see_annotations_on_closed_edition(self) -> None:
        self._make_annotation(self.edition_closed, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_closed.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_singer_cannot_see_annotations_on_foreign_edition(self) -> None:
        self._make_annotation(self.edition_foreign, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_foreign.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_singer_cannot_delete_annotation(self) -> None:
        ann = self._make_annotation(self.edition_live, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.delete(f"/api/archive/annotations/{ann.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_manager_can_clear_all_annotations_on_edition(self) -> None:
        from archive.models import Annotation
        self._make_annotation(self.edition_live, layer="shared")
        self._make_annotation(self.edition_live, layer="conductor")
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": str(self.edition_live.id)}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 2)
        self.assertEqual(
            Annotation.objects.filter(edition=self.edition_live, is_deleted=False).count(), 0,
        )

    def test_singer_clear_never_touches_shared_layer(self) -> None:
        from archive.models import Annotation
        shared = self._make_annotation(self.edition_live, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": str(self.edition_live.id)}, format="json",
        )
        # Clear is allowed for singers but scoped to their OWN personal layer —
        # the conductor's shared markup must survive untouched.
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 0)
        self.assertTrue(
            Annotation.objects.filter(pk=shared.pk, is_deleted=False).exists(),
        )

    # --- personal layer: the chorister's own pencil marks ---------------- #

    def _personal_payload(self, edition, text="my cue"):
        return {
            "edition": str(edition.id), "page_number": 1,
            "annotation_type": "CM", "payload": {"x": 0.5, "y": 0.5, "text": text},
            "layer_name": "personal",
        }

    def test_singer_can_create_personal_annotation_on_live_edition(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        )
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(str(resp.data["created_by"]), str(self.singer_user.id))
        self.assertEqual(resp.data["layer_name"], "personal")

    def test_singer_cannot_create_personal_annotation_without_live_access(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        for edition in (self.edition_closed, self.edition_foreign):
            resp = self.client.post(
                "/api/archive/annotations/",
                self._personal_payload(edition), format="json",
            )
            self.assertEqual(resp.status_code, 403, msg=resp.data)

    def test_singer_can_create_stamp_on_personal_layer(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 2,
            "annotation_type": "ST", "payload": {"x": 0.3, "y": 0.4, "symbol": "breath"},
            "layer_name": "personal",
        }, format="json")
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(resp.data["payload"]["symbol"], "breath")

    def test_singer_can_update_and_delete_own_personal_annotation(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        created = self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        ).data
        patched = self.client.patch(
            f"/api/archive/annotations/{created['id']}/",
            {"payload": {"x": 0.5, "y": 0.5, "text": "edited"}}, format="json",
        )
        self.assertEqual(patched.status_code, 200, msg=patched.data)
        self.assertEqual(patched.data["payload"]["text"], "edited")
        deleted = self.client.delete(f"/api/archive/annotations/{created['id']}/")
        self.assertEqual(deleted.status_code, 204)

    def test_singer_cannot_promote_personal_annotation_to_shared(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        created = self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        ).data
        resp = self.client.patch(
            f"/api/archive/annotations/{created['id']}/",
            {"layer_name": "shared"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_personal_annotations_are_private_even_from_the_manager(self) -> None:
        # Singer leaves a personal mark…
        self.client.force_authenticate(user=self.singer_user)
        self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live, text="secret"), format="json",
        )
        # …the manager's list must not contain it (their own personal is fine).
        self._make_annotation(self.edition_live, layer="personal")  # manager-owned
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_live.id}")
        self.assertEqual(resp.status_code, 200)
        personal_rows = [r for r in resp.data if r["layer_name"] == "personal"]
        self.assertEqual(len(personal_rows), 1)
        self.assertEqual(str(personal_rows[0]["created_by"]), str(self.manager.id))

    def test_singer_list_includes_shared_and_own_personal_only(self) -> None:
        shared = self._make_annotation(self.edition_live, layer="shared")
        self._make_annotation(self.edition_live, layer="conductor")
        self._make_annotation(self.edition_live, layer="personal")  # manager's own
        self.client.force_authenticate(user=self.singer_user)
        mine = self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        ).data
        resp = self.client.get(f"/api/archive/annotations/?edition={self.edition_live.id}")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.data}
        self.assertEqual(ids, {str(shared.id), str(mine["id"])})

    def test_manager_clear_leaves_personal_layers_alone(self) -> None:
        from archive.models import Annotation
        self._make_annotation(self.edition_live, layer="shared")
        self._make_annotation(self.edition_live, layer="conductor")
        self.client.force_authenticate(user=self.singer_user)
        self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": str(self.edition_live.id)}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 2)
        self.assertEqual(
            Annotation.objects.filter(
                edition=self.edition_live, is_deleted=False, layer_name="personal",
            ).count(),
            1,
        )

    def test_singer_clear_deletes_only_own_personal_marks(self) -> None:
        from archive.models import Annotation
        shared = self._make_annotation(self.edition_live, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live), format="json",
        )
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": str(self.edition_live.id)}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 1)
        self.assertTrue(
            Annotation.objects.filter(pk=shared.pk, is_deleted=False).exists(),
        )

    def test_edition_detail_never_embeds_personal_annotations(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        self.client.post(
            "/api/archive/annotations/",
            self._personal_payload(self.edition_live, text="secret"), format="json",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/archive/editions/{self.edition_live.id}/")
        self.assertEqual(resp.status_code, 200)
        layers = {a["layer_name"] for a in resp.data["annotations"]}
        self.assertNotIn("personal", layers)

    # --- starting pitches: the conductor's rehearsal pitch list ----------- #

    def test_manager_can_set_starting_pitches_and_they_are_sanitized(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(f"/api/pieces/{self.piece_live.id}/", {
            "starting_pitches": [
                {"voice": "  S  ", "note": 6, "octave": 4},
                {"voice": "A", "note": "2", "octave": 4},
                {"voice": "T", "note": 9, "octave": 3},
                {"voice": "B", "note": 2, "octave": 3},
            ],
        }, format="json")
        self.assertEqual(resp.status_code, 200, msg=resp.data)
        self.assertEqual(resp.data["starting_pitches"][0], {"voice": "S", "note": 6, "octave": 4})
        self.assertEqual(resp.data["starting_pitches"][1]["note"], 2)

    def test_starting_pitches_reject_out_of_range_entries(self) -> None:
        self.client.force_authenticate(user=self.manager)
        for bad in (
            [{"voice": "S", "note": 12, "octave": 4}],
            [{"voice": "S", "note": 5, "octave": 9}],
            [{"voice": "", "note": 5, "octave": 4}],
            [{"note": 5, "octave": 4}],
            "not-a-list",
        ):
            resp = self.client.patch(
                f"/api/pieces/{self.piece_live.id}/",
                {"starting_pitches": bad}, format="json",
            )
            self.assertEqual(resp.status_code, 400, msg=resp.data)

    def test_singer_cannot_set_starting_pitches(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.patch(f"/api/pieces/{self.piece_live.id}/", {
            "starting_pitches": [{"voice": "S", "note": 0, "octave": 4}],
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    # --- payload validation + sanitization ------------------------------- #

    def test_freehand_without_paths_is_rejected(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "FH", "payload": {"width": 0.004},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        # Validation errors are nested under `errors` by the RFC 7807 handler.
        self.assertIn("payload", resp.data.get("errors", resp.data))

    def test_comment_without_text_is_rejected(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "CM", "payload": {"x": 0.5, "y": 0.5, "text": "   "},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_out_of_range_coordinates_are_clamped_on_write(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "FH",
            "payload": {"paths": [[[1.8, -0.4], [0.5, 0.5]]], "width": 99},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(resp.data["payload"]["paths"][0][0], [1.0, 0.0])
        self.assertLessEqual(resp.data["payload"]["width"], 0.2)

    def test_manager_can_create_highlighter_marking(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 2,
            "annotation_type": "HL",
            "payload": {"paths": [[[0.1, 0.1], [0.4, 0.1]]], "width": 0.02},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(resp.data["annotation_type"], "HL")

    def test_inline_comment_display_persists(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/archive/annotations/", {
            "edition": str(self.edition_live.id), "page_number": 1,
            "annotation_type": "CM",
            "payload": {"x": 0.5, "y": 0.5, "text": "Oddech", "display": "inline"},
            "layer_name": "shared",
        }, format="json")
        self.assertEqual(resp.status_code, 201, msg=resp.data)
        self.assertEqual(resp.data["payload"]["display"], "inline")

    def test_manager_can_patch_comment_text(self) -> None:
        ann = self._make_annotation(self.edition_live, layer="shared")
        ann.annotation_type = "CM"
        ann.payload = {"x": 0.5, "y": 0.5, "text": "old", "display": "pin"}
        ann.save(update_fields=["annotation_type", "payload"])
        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            f"/api/archive/annotations/{ann.id}/",
            {"payload": {"x": 0.5, "y": 0.5, "text": "new", "display": "pin"}},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.data)
        self.assertEqual(resp.data["payload"]["text"], "new")

    def test_singer_cannot_patch_annotation(self) -> None:
        ann = self._make_annotation(self.edition_live, layer="shared")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.patch(
            f"/api/archive/annotations/{ann.id}/",
            {"layer_name": "conductor"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_clear_on_missing_edition_returns_404(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": "00000000-0000-0000-0000-000000000000"}, format="json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_clear_with_malformed_edition_id_returns_400(self) -> None:
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/archive/annotations/clear/",
            {"edition": "not-a-uuid"}, format="json",
        )
        self.assertEqual(resp.status_code, 400)


class ReminderDispatchTests(TestCase):
    """Beat sweep: idempotent, windowed upcoming-event reminders."""

    BULK = "roster.tasks.send_bulk_notifications_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="r1", email="r1@test.pl", password="pw123456", first_name="Ada"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="L", email="r1@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=10),
            status=Project.Status.ACTIVE,
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project, status=Participation.Status.CONFIRMED,
        )

    def _rehearsal(self, *, hours_ahead: float) -> Rehearsal:
        return Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(hours=hours_ahead)
        )

    def test_rehearsal_in_window_is_reminded_once_with_ics(self) -> None:
        from .tasks import dispatch_due_reminders
        reh = self._rehearsal(hours_ahead=12)

        with patch(self.BULK) as bulk:
            result = dispatch_due_reminders()
            self.assertEqual(result["rehearsals"], 1)
            bulk.assert_called_once()
            kwargs = bulk.call_args.kwargs
            self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_REMINDER)
            self.assertIn("T", kwargs["metadata"]["starts_at"])
            self.assertIn("starts_at_display", kwargs["metadata"])
            self.assertEqual(kwargs["metadata"]["timezone"], "Europe/Warsaw")
            self.assertEqual(kwargs["metadata"]["ics"]["kind"], "rehearsal")
            self.assertIn(str(reh.id), kwargs["metadata"]["ics"]["uid"])

        reh.refresh_from_db()
        self.assertIsNotNone(reh.reminder_sent_at)

        # Idempotent: a second sweep does nothing.
        with patch(self.BULK) as bulk2:
            dispatch_due_reminders()
            bulk2.assert_not_called()

    def test_rehearsal_outside_window_is_not_reminded(self) -> None:
        from .tasks import dispatch_due_reminders
        self._rehearsal(hours_ahead=72)  # default lead is 24h
        with patch(self.BULK) as bulk:
            dispatch_due_reminders()
            bulk.assert_not_called()

    def test_cancelled_project_rehearsal_is_skipped(self) -> None:
        from .tasks import dispatch_due_reminders
        self.project.status = Project.Status.CANCELLED
        self.project.save(update_fields=["status"])
        self._rehearsal(hours_ahead=6)
        with patch(self.BULK) as bulk:
            dispatch_due_reminders()
            bulk.assert_not_called()

    def test_project_in_window_is_reminded(self) -> None:
        from .tasks import dispatch_due_reminders
        near = Project.objects.create(
            title="Gala", date_time=timezone.now() + timedelta(hours=24),
            status=Project.Status.ACTIVE,
        )
        Participation.objects.create(
            artist=self.artist, project=near, status=Participation.Status.CONFIRMED
        )
        with patch(self.BULK) as bulk:
            dispatch_due_reminders()
            types = {c.kwargs["notification_type"] for c in bulk.call_args_list}
            self.assertIn(NotificationType.PROJECT_REMINDER, types)
        near.refresh_from_db()
        self.assertIsNotNone(near.reminder_sent_at)

    def test_draft_project_and_its_rehearsals_are_not_reminded(self) -> None:
        """A reminder would be the first the cast hears of an unpublished concert."""
        from .tasks import dispatch_due_reminders
        draft = Project.objects.create(
            title="Szkic", date_time=timezone.now() + timedelta(hours=24),
            status=Project.Status.DRAFT,
        )
        Participation.objects.create(
            artist=self.artist, project=draft, status=Participation.Status.CONFIRMED
        )
        reh = Rehearsal.objects.create(
            project=draft, date_time=timezone.now() + timedelta(hours=6)
        )

        with patch(self.BULK) as bulk:
            dispatch_due_reminders()
            bulk.assert_not_called()

        # Crucially, the one-shot claim is untouched: publishing the project later
        # leaves both reminders still available to fire.
        draft.refresh_from_db()
        reh.refresh_from_db()
        self.assertIsNone(draft.reminder_sent_at)
        self.assertIsNone(reh.reminder_sent_at)


class AbsenceRequestNotificationTests(TestCase):
    """An artist self-marking EXCUSED/ABSENT pings managers as ABSENCE_REQUESTED."""

    NOTIFY = "roster.services.ManagerNotificationHelper.notify_managers"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="s1", email="s1@test.pl", password="pw123456", first_name="Bo"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Bo", last_name="M", email="s1@test.pl",
            voice_type=VoiceType.BASS,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=5),
            status=Project.Status.ACTIVE,
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        self.rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=2)
        )

    def _record(self, status: str):
        dto = AttendanceRecordDTO(
            requesting_user_id=self.user.id,
            is_manager=False,
            participation_id=self.participation.id,
            rehearsal_id=self.rehearsal.id,
            status=status,
            excuse_note="Out of town",
        )
        with patch(self.NOTIFY) as notify, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.record_attendance(dto)
        return notify

    def test_self_excused_emits_absence_requested(self) -> None:
        notify = self._record("EXCUSED")
        notify.assert_called_once()
        self.assertEqual(notify.call_args.kwargs["notification_type"], NotificationType.ABSENCE_REQUESTED)
        meta = notify.call_args.kwargs["metadata"]
        self.assertEqual(meta["artist_name"], "Bo M")
        self.assertIn("rehearsal_id", meta)

    def test_self_present_stays_attendance_submitted(self) -> None:
        notify = self._record("PRESENT")
        notify.assert_called_once()
        self.assertEqual(notify.call_args.kwargs["notification_type"], NotificationType.ATTENDANCE_SUBMITTED)


class ScheduleDashboardTests(APITestCase):
    """
    The artist schedule read-model (`/api/participations/schedule-dashboard/`):
    only the singer's own active projects and invited rehearsals, each pre-joined
    with their participation and attendance, with no cross-artist leakage.
    """

    URL = "/api/participations/schedule-dashboard/"

    def setUp(self) -> None:
        from .models import Attendance

        User = get_user_model()
        now = timezone.now()

        self.singer_user = User.objects.create_user(
            username="sch-singer", email="sch-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Sara", last_name="Schedule",
            email="sch-singer@test.pl", voice_type=VoiceType.ALTO,
        )

        self.outsider_user = User.objects.create_user(
            username="sch-out", email="sch-out@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.outsider_user, role=AppRole.ARTIST)
        self.outsider = Artist.objects.create(
            user=self.outsider_user, first_name="Otto", last_name="Outsider",
            email="sch-out@test.pl", voice_type=VoiceType.BASS,
        )

        # Active project the singer is cast in.
        self.project_live = Project.objects.create(
            title="Spring Concert", date_time=now, status=Project.Status.ACTIVE
        )
        self.part_live = Participation.objects.create(
            artist=self.singer, project=self.project_live,
            status=Participation.Status.CONFIRMED,
        )
        # A second confirmed singer, so we can target a rehearsal at them only.
        self.part_other = Participation.objects.create(
            artist=self.outsider, project=self.project_live,
            status=Participation.Status.CONFIRMED,
        )

        # Cancelled project — cast but must drop off the schedule, and it takes
        # its rehearsals with it: an evening that leads to a concert nobody is
        # giving is not an evening.
        self.project_cancelled = Project.objects.create(
            title="Scrapped Gala", date_time=now, status=Project.Status.CANCELLED
        )
        Participation.objects.create(
            artist=self.singer, project=self.project_cancelled,
            status=Participation.Status.CONFIRMED,
        )
        self.reh_cancelled = Rehearsal.objects.create(
            project=self.project_cancelled, date_time=now + timedelta(days=1),
        )

        # Declined project — must drop off the schedule.
        self.project_declined = Project.objects.create(
            title="Passed Up", date_time=now, status=Project.Status.ACTIVE
        )
        Participation.objects.create(
            artist=self.singer, project=self.project_declined,
            status=Participation.Status.DECLINED,
        )

        # Foreign project — the singer has nothing to do with it.
        self.project_foreign = Project.objects.create(
            title="Other Choir Night", date_time=now, status=Project.Status.ACTIVE
        )
        Participation.objects.create(
            artist=self.outsider, project=self.project_foreign,
            status=Participation.Status.CONFIRMED,
        )

        # Rehearsals on the live project.
        self.reh_all = Rehearsal.objects.create(
            project=self.project_live, date_time=now + timedelta(days=1),
        )  # no invite list → everyone in the project
        self.reh_invited = Rehearsal.objects.create(
            project=self.project_live, date_time=now + timedelta(days=2),
        )
        self.reh_invited.invited_participations.add(self.part_live)
        self.reh_other = Rehearsal.objects.create(
            project=self.project_live, date_time=now + timedelta(days=3),
        )
        self.reh_other.invited_participations.add(self.part_other)  # not the singer
        self.reh_foreign = Rehearsal.objects.create(
            project=self.project_foreign, date_time=now + timedelta(days=1),
        )

        # The singer's own attendance on the all-invited rehearsal.
        Attendance.objects.create(
            rehearsal=self.reh_all, participation=self.part_live,
            status=Attendance.Status.PRESENT,
        )

    def _fetch(self):
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def test_projects_scoped_excluding_cancelled_declined_foreign(self) -> None:
        data = self._fetch()
        project_ids = {
            item["project"]["id"] for item in data if item["type"] == "PROJECT"
        }
        self.assertIn(str(self.project_live.id), project_ids)
        self.assertNotIn(str(self.project_cancelled.id), project_ids)
        self.assertNotIn(str(self.project_declined.id), project_ids)
        self.assertNotIn(str(self.project_foreign.id), project_ids)

    def test_rehearsal_invitation_scope(self) -> None:
        data = self._fetch()
        rehearsal_ids = {
            item["rehearsal"]["id"] for item in data if item["type"] == "REHEARSAL"
        }
        self.assertIn(str(self.reh_all.id), rehearsal_ids)  # all-invited
        self.assertIn(str(self.reh_invited.id), rehearsal_ids)  # explicitly invited
        self.assertNotIn(str(self.reh_other.id), rehearsal_ids)  # invites someone else
        self.assertNotIn(str(self.reh_foreign.id), rehearsal_ids)  # foreign project

    def test_a_cancelled_project_takes_its_rehearsals_with_it(self) -> None:
        # The concert row and its rehearsals leave together. They used to part
        # company: the project dropped, its evenings stayed on the timeline as
        # orphans of a concert nobody could find.
        data = self._fetch()
        rehearsal_ids = {
            item["rehearsal"]["id"] for item in data if item["type"] == "REHEARSAL"
        }
        self.assertNotIn(str(self.reh_cancelled.id), rehearsal_ids)

    def test_rehearsal_carries_attendance_and_participation(self) -> None:
        data = self._fetch()
        by_id = {
            item["rehearsal"]["id"]: item
            for item in data
            if item["type"] == "REHEARSAL"
        }
        attended = by_id[str(self.reh_all.id)]
        self.assertEqual(attended["participation_id"], str(self.part_live.id))
        self.assertEqual(attended["project_title"], self.project_live.title)
        self.assertIsNotNone(attended["my_attendance"])
        self.assertEqual(attended["my_attendance"]["status"], "PRESENT")

        # A rehearsal the singer hasn't marked carries a null attendance.
        unmarked = by_id[str(self.reh_invited.id)]
        self.assertIsNone(unmarked["my_attendance"])

    def test_outsider_does_not_see_singers_schedule(self) -> None:
        self.client.force_authenticate(user=self.outsider_user)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        project_ids = {
            item["project"]["id"] for item in resp.data if item["type"] == "PROJECT"
        }
        # The outsider is cast in the live + foreign projects, never in the
        # cancelled/declined ones, and never inherits the singer's attendance.
        self.assertIn(str(self.project_foreign.id), project_ids)
        self.assertNotIn(str(self.project_cancelled.id), project_ids)


class RehearsalNotificationEmitterTests(TestCase):
    """Schedule / update / cancel emit the canonical event-moment metadata
    (structured ISO `starts_at`, localized display fallback, IANA timezone) plus the
    rehearsal identity, so every downstream surface renders timezone-correct copy."""

    # Patching the task's own `delay` catches both routes out of the gate — the
    # queue's publication and the immediate dispatch a cancellation still uses.
    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    # 17:00 UTC == 19:00 in Warsaw — a fixed instant keeps display assertions stable.
    WHEN = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="emit1", email="emit1@test.pl", password="pw123456", first_name="Ada"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="L", email="emit1@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=10),
            status=Project.Status.ACTIVE,
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project, status=Participation.Status.CONFIRMED,
        )

    def _location(self, tz: str = "Europe/Warsaw"):
        from logistics.models import Location

        return Location.objects.create(
            name="St Anne's", category="CHURCH",
            formatted_address="Grodzka 1, Kraków", timezone=tz,
        )

    def _emit(self, fn) -> dict:
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            fn()
        bulk.assert_called_once()
        return dict(bulk.call_args.kwargs)

    def _emit_queued(self, fn) -> dict:
        """Schedule and update accrue in the queue on a live project, so the
        payload is what publication puts on the wire."""
        from notifications.announcement_queue import AnnouncementQueue

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            fn()
            AnnouncementQueue.publish(self.project)
        bulk.assert_called_once()
        return dict(bulk.call_args.kwargs)

    def test_schedule_emits_canonical_event_time_and_identity(self) -> None:
        from .dtos import RehearsalCreateDTO

        location = self._location()
        # Deliberately pass a different DTO timezone to prove the location's IANA
        # zone is the single source of truth that lands in the metadata.
        kwargs = self._emit_queued(lambda: RehearsalOperationsService.schedule_rehearsal(
            RehearsalCreateDTO(
                project_id=self.project.id, date_time=self.WHEN, timezone="UTC",
                location_id=location.id, focus="Lacrimosa",
            )
        ))
        self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_SCHEDULED)
        meta = kwargs["metadata"]
        self.assertEqual(meta["starts_at"], "2026-06-19T17:00:00+00:00")
        self.assertEqual(meta["starts_at_display"], "19.06.2026, 19:00")
        self.assertEqual(meta["timezone"], "Europe/Warsaw")
        self.assertEqual(meta["location"], "St Anne's")
        self.assertEqual(meta["focus"], "Lacrimosa")
        self.assertTrue(meta["rehearsal_id"])
        self.assertEqual(meta["project_id"], str(self.project.id))

    def test_update_emits_changes_with_current_event_facts(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=self.WHEN, timezone="Europe/Warsaw",
            focus="Intro",
        )
        kwargs = self._emit_queued(lambda: RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(focus="Lacrimosa")
        ))
        self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_UPDATED)
        meta = kwargs["metadata"]
        # Structured change is carried…
        focus_changes = [c for c in meta["changes"] if c["field"] == "focus"]
        self.assertEqual(len(focus_changes), 1)
        self.assertEqual(focus_changes[0]["new"], "Lacrimosa")
        # …alongside the current event facts for an at-a-glance read.
        self.assertEqual(meta["starts_at_display"], "19.06.2026, 19:00")
        self.assertEqual(meta["focus"], "Lacrimosa")

    def test_cancel_emits_identity_and_event_facts_after_soft_delete(self) -> None:
        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=self.WHEN, timezone="Europe/Warsaw",
            focus="Lacrimosa",
        )
        rehearsal_id = str(rehearsal.id)
        kwargs = self._emit(lambda: RehearsalOperationsService.delete_rehearsal(rehearsal))
        self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_CANCELLED)
        meta = kwargs["metadata"]
        # The soft-deleted row still carries a resolvable identity (guards against
        # reading the id after a hard delete would have nulled it).
        self.assertEqual(meta["rehearsal_id"], rehearsal_id)
        self.assertEqual(meta["project_id"], str(self.project.id))
        self.assertEqual(meta["starts_at"], "2026-06-19T17:00:00+00:00")
        self.assertEqual(meta["starts_at_display"], "19.06.2026, 19:00")


class TuttiRehearsalIsAStandingCallTests(APITestCase):
    """A rehearsal that names nobody calls the whole ensemble, for as long as it
    exists.

    Both halves of that sentence are load-bearing. "Names nobody" is what lets a
    conductor lay out a concert's rehearsals before a single singer has been
    invited — the roster the session would have been frozen against does not
    exist yet. "For as long as it exists" is what makes a singer who accepts
    their invitation next month walk into a calendar that already expects them,
    with no session to go back and amend.

    A sectional is the opposite by design: it IS its list of names, so it stays
    exactly as written and a newcomer is not swept into it.
    """

    def setUp(self) -> None:
        User = get_user_model()
        self.maestro_user = User.objects.create_user(
            username="tutti-cond", email="tutticond@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.maestro_user, role=AppRole.MANAGER)
        self.maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Wanda", last_name="Baton",
            email="tutticond@test.pl", voice_type=VoiceType.CONDUCTOR,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=60),
            status=Project.Status.ACTIVE, conductor=self.maestro,
        )
        self.client.force_authenticate(user=self.maestro_user)

    def _latecomer(self) -> tuple[AbstractBaseUser, Participation]:
        """A singer added to the project after its calendar was already built."""
        User = get_user_model()
        user = User.objects.create_user(
            username="tutti-late", email="tuttilate@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name="Sam", last_name="Singer",
            email="tuttilate@test.pl", voice_type=VoiceType.TENOR,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED
        )
        return user, participation

    def test_a_rehearsal_can_be_booked_before_anyone_is_cast(self) -> None:
        self.assertEqual(
            Participation.objects.filter(project=self.project).count(), 0
        )
        response = self.client.post(
            "/api/rehearsals/",
            {
                "project_id": str(self.project.id),
                "date_time": (timezone.now() + timedelta(days=30)).isoformat(),
                "timezone": "Europe/Warsaw",
                "focus": "Lacrimosa",
                "is_mandatory": True,
                "invited_participations": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["invited_participations"], [])

    def test_a_latecomer_walks_into_the_tutti_sessions_already_booked(self) -> None:
        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=30)
        )
        user, _participation = self._latecomer()

        self.client.force_authenticate(user=user)
        response = self.client.get("/api/rehearsals/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [row["id"] for row in response.data], [str(rehearsal.id)]
        )

    def test_a_sectional_stays_the_list_it_was_written_as(self) -> None:
        sectional = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=31)
        )
        named_user = get_user_model().objects.create_user(
            username="tutti-named", email="tuttinamed@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=named_user, role=AppRole.ARTIST)
        named_artist = Artist.objects.create(
            user=named_user, first_name="Ada", last_name="Alto",
            email="tuttinamed@test.pl", voice_type=VoiceType.ALTO,
        )
        sectional.invited_participations.add(
            Participation.objects.create(
                artist=named_artist, project=self.project,
                status=Participation.Status.CONFIRMED,
            )
        )

        latecomer_user, _ = self._latecomer()
        self.client.force_authenticate(user=latecomer_user)
        self.assertEqual(self.client.get("/api/rehearsals/").data, [])

    def test_clearing_the_guest_list_hands_a_sectional_back_to_the_ensemble(self) -> None:
        # The edit path is how a session booked as a frozen roster is converted
        # to the standing rule; an empty list has to mean "everyone", not "skip".
        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=30)
        )
        _user, participation = self._latecomer()
        rehearsal.invited_participations.add(participation)

        response = self.client.patch(
            f"/api/rehearsals/{rehearsal.id}/",
            {"invited_participations": []},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(rehearsal.invited_participations.count(), 0)

    def test_the_dossier_counts_tutti_sessions_as_rehearsals_invited(self) -> None:
        from .queries import get_artist_dossier

        Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=30)
        )
        _user, participation = self._latecomer()

        dossier = get_artist_dossier(participation.artist)
        self.assertEqual(dossier["stats"]["rehearsals_invited"], 1)


class ProjectUpdateNotificationEmitterTests(TestCase):
    """A project update surfaces only human-readable field changes to the cast.
    The run-sheet is a structured JSON list, so its diff must arrive as a
    self-describing 'day schedule' change — never the raw payload — and edits to
    non-surfaceable fields (description) must not ping the cast at all."""

    # Patching the task's own `delay` catches both routes out of the gate — the
    # queue's publication and the immediate dispatch a cancellation still uses.
    BULK = "notifications.announcements.send_bulk_notifications_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="pue1", email="pue1@test.pl", password="pw123456", first_name="Ada",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="L", email="pue1@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=10),
            status=Project.Status.ACTIVE,
        )
        self.participation = Participation.objects.create(
            artist=self.artist, project=self.project, status=Participation.Status.CONFIRMED,
        )

    def test_run_sheet_change_emits_label_only_not_json_payload(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project,
                ProjectUpdateDTO(run_sheet=[{"time": "18:00", "label": "Zbiórka"}]),
            )
            AnnouncementQueue.publish(self.project)

        bulk.assert_called_once()
        meta = bulk.call_args.kwargs["metadata"]
        run_sheet_changes = [c for c in meta["changes"] if c["field"] == "run_sheet"]
        self.assertEqual(len(run_sheet_changes), 1)
        # Label-only: no raw JSON payload leaks into old/new (the reported bug).
        self.assertIsNone(run_sheet_changes[0]["old"])
        self.assertIsNone(run_sheet_changes[0]["new"])
        self.assertNotIn("Zbiórka", str(meta["changes"]))
        # The edit still persists.
        self.project.refresh_from_db()
        self.assertEqual(self.project.run_sheet, [{"time": "18:00", "label": "Zbiórka"}])

    def test_a_moved_window_reaches_the_cast_as_one_row_with_both_ends(self) -> None:
        """The four window columns are two facts, and the diff says which moved.

        A sound check pulled forward the day before the concert used to be a
        silent save: the singer who read the card yesterday had no way of
        learning it, because the columns were added to the model and never to
        the surfaceable set.
        """
        from notifications.announcement_queue import AnnouncementQueue

        from .dtos import ProjectUpdateDTO

        self.project.soundcheck_start = time(17, 0)
        self.project.soundcheck_end = time(17, 40)
        self.project.save(update_fields=["soundcheck_start", "soundcheck_end"])

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project,
                ProjectUpdateDTO(soundcheck_start=time(15, 30), soundcheck_end=time(16, 10)),
            )
            AnnouncementQueue.publish(self.project)

        meta = bulk.call_args.kwargs["metadata"]
        self.assertEqual(
            [c for c in meta["changes"] if c["field"] == "soundcheck"],
            [{"field": "soundcheck", "old": "17:00-17:40", "new": "15:30-16:10"}],
        )
        # The window that did not move says nothing.
        self.assertNotIn("warmup", [c["field"] for c in meta["changes"]])
        # News, not an alarm: the call time is the hour the cast is held to, and
        # it has not moved.
        self.assertEqual(bulk.call_args.kwargs["level"], NotificationLevel.WARNING)

    def test_an_open_window_states_only_the_hour_it_opens(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(warmup_start=time(18, 40)),
            )
            AnnouncementQueue.publish(self.project)

        meta = bulk.call_args.kwargs["metadata"]
        self.assertEqual(
            [c for c in meta["changes"] if c["field"] == "warmup"],
            [{"field": "warmup", "old": None, "new": "18:40"}],
        )

    def test_a_door_that_moves_is_named_by_its_own_field(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        from .dtos import ProjectUpdateDTO

        self.project.entrance_note = "Wejście główne"
        self.project.save(update_fields=["entrance_note"])

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project,
                ProjectUpdateDTO(entrance_note="Wejście boczne od Rakowieckiej, brama 2"),
            )
            AnnouncementQueue.publish(self.project)

        meta = bulk.call_args.kwargs["metadata"]
        self.assertEqual(
            [c for c in meta["changes"] if c["field"] == "entrance"],
            [
                {
                    "field": "entrance",
                    "old": "Wejście główne",
                    "new": "Wejście boczne od Rakowieckiej, brama 2",
                }
            ],
        )
        # Each note is its own fact: the parking and the dressing room, untouched,
        # do not ride along on the door's row.
        self.assertEqual(len(meta["changes"]), 1)

    def test_description_only_change_does_not_notify_the_cast(self) -> None:
        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(description="Nowy opis programu."),
            )

        bulk.assert_not_called()
        self.project.refresh_from_db()
        self.assertEqual(self.project.description, "Nowy opis programu.")

    def test_cancelling_a_project_emits_its_own_alarm_not_a_status_diff(self) -> None:
        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.CANCELLED),
            )

        bulk.assert_called_once()
        kwargs = bulk.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.PROJECT_CANCELLED)
        self.assertEqual(kwargs["level"], NotificationLevel.URGENT)
        # No status diff to decode — the type itself is the message.
        self.assertNotIn("changes", kwargs["metadata"])
        self.assertEqual(kwargs["metadata"]["project_name"], "Requiem")

    def test_cancellation_supersedes_other_edits_in_the_same_save(self) -> None:
        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project,
                ProjectUpdateDTO(status=Project.Status.CANCELLED, title="Requiem II"),
            )

        # One alarm, not an alarm plus a "title changed" ping about a dead concert.
        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.PROJECT_CANCELLED
        )
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, "Requiem II")


class AnnouncementAudienceTests(TestCase):
    """One rule for who hears about a live project: confirmed *and* still
    deciding, never declined.

    The queue and the alarms that bypass it (cancellations) must resolve the same
    audience. They did not: cancellations addressed CON only, and since publication
    leaves the whole cast INVITED by mechanism, a concert called off the day after
    it went live reached nobody at all.
    """

    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    SINGLE = "notifications.announcements.send_notification_task.delay"
    WHEN = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)

    def setUp(self) -> None:
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.waiting, self.waiting_user = self._singer(
            "waiting", Participation.Status.INVITED
        )
        self.declined, self.declined_user = self._singer(
            "declined", Participation.Status.DECLINED
        )

    def _singer(self, slug: str, status: str):
        user = get_user_model().objects.create_user(
            username=f"aud-{slug}", email=f"aud-{slug}@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=slug.title(), last_name="Singer",
            email=f"aud-{slug}@test.pl", voice_type=VoiceType.SOPRANO,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project, status=status,
        )
        return participation, user

    def _rehearsal(self) -> Rehearsal:
        return Rehearsal.objects.create(
            project=self.project, date_time=self.WHEN, timezone="Europe/Warsaw",
        )

    def test_cancelling_a_project_reaches_those_still_deciding(self) -> None:
        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.CANCELLED),
            )

        kwargs = bulk.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.PROJECT_CANCELLED)
        # The person weighing the invitation is exactly who this answers; the one
        # who already said no has ended the conversation.
        self.assertEqual(kwargs["recipient_ids"], [str(self.waiting_user.id)])

    def test_cancelling_a_rehearsal_reaches_those_still_deciding(self) -> None:
        rehearsal = self._rehearsal()

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.delete_rehearsal(rehearsal)

        kwargs = bulk.call_args.kwargs
        self.assertEqual(
            kwargs["notification_type"], NotificationType.REHEARSAL_CANCELLED
        )
        # Anything else would leave them holding a date that no longer exists —
        # they were told about the rehearsal by the queue, which reaches INVITED.
        self.assertEqual(kwargs["recipient_ids"], [str(self.waiting_user.id)])

    def test_a_queued_personal_row_is_dropped_when_its_singer_declines(self) -> None:
        from archive.models import Composer, Piece
        from notifications.announcement_queue import AnnouncementQueue

        piece = Piece.objects.create(
            title="Pie Jesu",
            composer=Composer.objects.create(first_name="Gabriel", last_name="Fauré"),
        )
        CastingAndCrewService.assign_piece_casting(
            {"participation": self.waiting, "piece": piece, "voice_line": "S1"}
        )
        self.waiting.status = Participation.Status.DECLINED
        self.waiting.save(update_fields=["status"])

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            result = AnnouncementQueue.publish(self.project)

        # Sending them the voice line they have since turned down would read as the
        # app not having heard the answer.
        single.assert_not_called()
        self.assertEqual(result["messages"], 0)

    def test_a_removal_still_reaches_someone_with_no_participation_left(self) -> None:
        """Guard on the rule above: the DECLINED filter must not silence the one
        message that has no live participation behind it by definition."""
        from notifications.announcement_queue import AnnouncementQueue

        ProjectManagementService.delete_participation(self.waiting)

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            AnnouncementQueue.publish(self.project)

        single.assert_called_once()
        self.assertEqual(
            single.call_args.kwargs["recipient_id"], str(self.waiting_user.id)
        )
        self.assertEqual(
            single.call_args.kwargs["metadata"]["event"], "removed"
        )


class ReinvitationTests(TestCase):
    """Moving a seat back to INVITED asks the singer again.

    The cast tab does exactly this when someone who declined is re-added. Without
    an invitation behind it the project simply reappears in their schedule with
    nobody ever having put the question — and publication cannot rescue them,
    since it runs once.
    """

    SINGLE = "notifications.announcements.send_notification_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="reinv", email="reinv@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="Singer",
            email="reinv@test.pl", voice_type=VoiceType.SOPRANO,
        )

    def _project(self, status: str) -> Project:
        return Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=status,
        )

    def _participation(self, project: Project) -> Participation:
        return Participation.objects.create(
            artist=self.artist, project=project,
            status=Participation.Status.DECLINED,
        )

    def test_declined_to_invited_re_invites_on_a_live_project(self) -> None:
        from .services import ParticipationService

        participation = self._participation(self._project(Project.Status.ACTIVE))

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ParticipationService.update_by_manager(
                participation, {"status": Participation.Status.INVITED}
            )

        single.assert_called_once()
        self.assertEqual(
            single.call_args.kwargs["notification_type"],
            NotificationType.PROJECT_INVITATION,
        )
        self.assertEqual(single.call_args.kwargs["recipient_id"], str(self.user.id))

    def test_declined_to_invited_is_silent_on_a_draft(self) -> None:
        from .services import ParticipationService

        participation = self._participation(self._project(Project.Status.DRAFT))

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ParticipationService.update_by_manager(
                participation, {"status": Participation.Status.INVITED}
            )

        # The whole cast is invited together at publication; a draft says nothing.
        single.assert_not_called()

    def test_an_administrative_status_change_says_nothing(self) -> None:
        from .services import ParticipationService

        participation = self._participation(self._project(Project.Status.ACTIVE))

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ParticipationService.update_by_manager(
                participation, {"status": Participation.Status.CONFIRMED, "fee": 100}
            )

        # Answering CONFIRMED *for* someone is bookkeeping, not a message to them.
        single.assert_not_called()
        participation.refresh_from_db()
        self.assertEqual(participation.fee, 100)


class DraftProjectSilenceTests(TestCase):
    """A project still in DRAFT is invisible to its cast: the conductor assembles the
    people, schedule and divisi without a single message leaving the app. Publishing
    it (DRAFT → ACTIVE) is the one act that speaks, and it speaks as an invitation."""

    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    SINGLE = "notifications.announcements.send_notification_task.delay"

    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="draft1", email="draft1@test.pl", password="pw123456", first_name="Ada",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="L", email="draft1@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT,
        )

    def _confirmed(self) -> Participation:
        return Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

    def test_inviting_to_a_draft_stays_silent(self) -> None:
        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.create_or_restore_participation({
                "artist": self.artist, "project": self.project,
                "status": Participation.Status.INVITED,
            })

        single.assert_not_called()
        # The participation itself is persisted — only the announcement is withheld.
        self.assertTrue(
            Participation.objects.filter(artist=self.artist, project=self.project).exists()
        )

    def test_scheduling_rehearsals_on_a_draft_stays_silent(self) -> None:
        from .dtos import RehearsalCreateDTO

        self._confirmed()
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.schedule_rehearsal(
                RehearsalCreateDTO(
                    project_id=self.project.id,
                    date_time=timezone.now() + timedelta(days=20),
                    timezone="Europe/Warsaw",
                    focus="Lacrimosa",
                )
            )

        bulk.assert_not_called()
        self.assertEqual(Rehearsal.objects.filter(project=self.project).count(), 1)

    def test_editing_a_draft_stays_silent(self) -> None:
        from .dtos import ProjectUpdateDTO

        self._confirmed()
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(title="Requiem — wersja druga"),
            )

        bulk.assert_not_called()

    def test_cancelling_a_draft_never_announced_stays_silent(self) -> None:
        from .dtos import ProjectUpdateDTO

        self._confirmed()
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.CANCELLED),
            )

        # Nobody was told the concert existed, so nobody is told it is off.
        bulk.assert_not_called()

    def test_publishing_invites_everyone_still_awaiting_an_answer(self) -> None:
        from .dtos import ProjectUpdateDTO

        pending = Participation.objects.create(
            artist=self.artist, project=self.project,
            status=Participation.Status.INVITED,
        )

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.ACTIVE),
            )

        single.assert_called_once()
        kwargs = single.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.PROJECT_INVITATION)
        self.assertEqual(kwargs["recipient_id"], str(self.user.id))
        meta = kwargs["metadata"]
        self.assertEqual(meta["project_name"], "Requiem")
        self.assertEqual(meta["participation_id"], str(pending.id))

    def test_publishing_does_not_re_invite_those_who_already_answered(self) -> None:
        from .dtos import ProjectUpdateDTO

        self._confirmed()
        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.ACTIVE),
            )

        # A confirmed singer accepted already; re-inviting them would read as a bug.
        single.assert_not_called()

    def test_publishing_does_not_emit_a_status_field_diff(self) -> None:
        from .dtos import ProjectUpdateDTO

        self._confirmed()
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project,
                ProjectUpdateDTO(status=Project.Status.ACTIVE, title="Requiem II"),
            )

        # "Status: Szkic → Aktywny" is an implementation detail, not news for a singer.
        bulk.assert_not_called()
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, "Requiem II")

    def test_a_published_project_announces_again(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        from .dtos import ProjectUpdateDTO

        self.project.status = Project.Status.ACTIVE
        self.project.save(update_fields=["status"])
        self._confirmed()

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(title="Requiem II"),
            )
            # Past publication the silence ends, but the change waits for review
            # rather than going out on the keystroke that made it.
            self.assertEqual(len(AnnouncementQueue.pending_for(self.project)), 1)
            AnnouncementQueue.publish(self.project)

        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.PROJECT_UPDATED
        )


class DraftInvisibleToCastTests(APITestCase):
    """Silence is not only about notifications. A draft the cast was never told about
    must not surface in their schedule or materials either — otherwise the conductor
    plans in private while the singers watch it happen. The conductor keeps seeing
    their own draft: they are the one assembling it."""

    SCHEDULE_URL = "/api/participations/schedule-dashboard/"
    MATERIALS_URL = "/api/participations/materials-dashboard/"

    def setUp(self) -> None:
        User = get_user_model()
        self.singer_user = User.objects.create_user(
            username="dinv-singer", email="dinv@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Sam", last_name="Singer",
            email="dinv@test.pl", voice_type=VoiceType.TENOR,
        )

        self.maestro_user = User.objects.create_user(
            username="dinv-cond", email="dinvc@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.maestro_user, role=AppRole.MANAGER)
        self.maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Wanda", last_name="Baton",
            email="dinvc@test.pl", voice_type=VoiceType.CONDUCTOR,
        )

        self.draft = Project.objects.create(
            title="Szkic", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT, conductor=self.maestro,
        )
        Participation.objects.create(
            artist=self.singer, project=self.draft,
            status=Participation.Status.CONFIRMED,
        )
        Rehearsal.objects.create(
            project=self.draft, date_time=timezone.now() + timedelta(days=20),
        )

    def _titles(self, url: str, user) -> set[str]:
        self.client.force_authenticate(user=user)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        return {str(row).lower() for row in [resp.content.decode()]}

    def test_draft_is_absent_from_the_singers_schedule(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self.SCHEDULE_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_draft_is_absent_from_the_singers_materials(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self.MATERIALS_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_conductor_still_sees_the_draft_they_are_building(self) -> None:
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(self.SCHEDULE_URL)
        self.assertEqual(resp.status_code, 200)
        project_ids = {
            item["project"]["id"] for item in resp.data if item["type"] == "PROJECT"
        }
        self.assertIn(str(self.draft.id), project_ids)

    def test_the_draft_is_not_served_on_the_plain_endpoints_either(self) -> None:
        # The read-models are what a singer is shown; these are what a stale
        # client or a curious one can ask for. Publishing is the control inside
        # the test — the same request has to start answering.
        self.client.force_authenticate(user=self.singer_user)
        self.assertEqual(self.client.get("/api/projects/").data, [])
        self.assertEqual(self.client.get("/api/rehearsals/").data, [])

        self.draft.status = Project.Status.ACTIVE
        self.draft.save(update_fields=["status"])

        self.assertEqual(len(self.client.get("/api/projects/").data), 1)
        self.assertEqual(len(self.client.get("/api/rehearsals/").data), 1)

    def test_publishing_reveals_the_project_to_the_singer(self) -> None:
        self.draft.status = Project.Status.ACTIVE
        self.draft.save(update_fields=["status"])

        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self.SCHEDULE_URL)
        project_ids = {
            item["project"]["id"] for item in resp.data if item["type"] == "PROJECT"
        }
        self.assertIn(str(self.draft.id), project_ids)


class DeclinedSeatKeepsNothingTests(APITestCase):
    """Turning a project down gives back everything that came with the seat.

    The schedule understood this from the start — a seat you declined is not one
    you can be marked absent from. Nothing else did: the songbook went on offering
    the programme and the recordings, and the score gate never looked at the seat's
    status at all, so declining a concert left its music open indefinitely. The
    colleague who kept their seat is the control on every assertion: this is a rule
    about one seat, not about the project.
    """

    MATERIALS_URL = "/api/participations/materials-dashboard/"

    def setUp(self) -> None:
        from archive.models import Composer, Piece

        User = get_user_model()
        self.project = Project.objects.create(
            title="Pasja", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Jan", last_name="Bach")
        piece = Piece.objects.create(title="Erbarme dich", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=piece, order=1)
        Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=10)
        )

        def _member(handle: str, seat_status: str):
            user = User.objects.create_user(
                username=handle, email=f"{handle}@test.pl", password="pw123456"
            )
            UserProfile.objects.create(user=user, role=AppRole.ARTIST)
            artist = Artist.objects.create(
                user=user, first_name=handle.title(), last_name="Testowy",
                email=f"{handle}@test.pl", voice_type=VoiceType.BASS,
            )
            Participation.objects.create(
                artist=artist, project=self.project, status=seat_status
            )
            return user

        self.refuser = _member("dec-refuser", Participation.Status.DECLINED)
        self.singer = _member("dec-singer", Participation.Status.CONFIRMED)

    def _project_ids(self, user, url: str) -> set[str]:
        self.client.force_authenticate(user=user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        return {str(row.get("id", "")) for row in response.data}

    def test_the_songbook_closes_with_the_seat(self) -> None:
        self.client.force_authenticate(user=self.refuser)
        self.assertEqual(self.client.get(self.MATERIALS_URL).data, [])

        self.client.force_authenticate(user=self.singer)
        kept = self.client.get(self.MATERIALS_URL).data
        self.assertEqual(
            {str(row["project"]["id"]) for row in kept}, {str(self.project.id)}
        )

    def test_the_plain_endpoints_agree_with_it(self) -> None:
        self.assertEqual(self._project_ids(self.refuser, "/api/projects/"), set())
        self.assertEqual(
            self._project_ids(self.singer, "/api/projects/"), {str(self.project.id)}
        )

        self.client.force_authenticate(user=self.refuser)
        self.assertEqual(self.client.get("/api/rehearsals/").data, [])
        self.assertEqual(self.client.get("/api/program-items/").data, [])


class CancelledInvisibleToCastTests(APITestCase):
    """A called-off concert leaves the singer's world whole, not in pieces.

    Cancellation used to be enforced surface by surface, and the surfaces
    disagreed: the concert row dropped off the schedule while its rehearsals
    stayed on the timeline, and its programme sat in the songbook with the scores
    behind it already refused. It is now withdrawn at every door — the two
    read-models and the plain endpoints alike — which is the difference between a
    concert a singer is not shown and one they cannot reach.

    The live project alongside is the control: without it these assertions would
    also pass on a query that had simply stopped returning anything.
    """

    SCHEDULE_URL = "/api/participations/schedule-dashboard/"
    MATERIALS_URL = "/api/participations/materials-dashboard/"

    def setUp(self) -> None:
        from archive.models import Composer, Piece

        User = get_user_model()
        self.singer_user = User.objects.create_user(
            username="canc-singer", email="canc@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Cyprian", last_name="Cichy",
            email="canc@test.pl", voice_type=VoiceType.BASS,
        )

        composer = Composer.objects.create(first_name="Henryk", last_name="Górecki")
        piece = Piece.objects.create(title="Totus Tuus", composer=composer)

        def _concert(title: str, status: str) -> Project:
            project = Project.objects.create(
                title=title, date_time=timezone.now() + timedelta(days=30),
                status=status,
            )
            Participation.objects.create(
                artist=self.singer, project=project,
                status=Participation.Status.CONFIRMED,
            )
            ProgramItem.objects.create(project=project, piece=piece, order=1)
            Rehearsal.objects.create(
                project=project, date_time=timezone.now() + timedelta(days=10)
            )
            return project

        self.cancelled = _concert("Odwołane Nieszpory", Project.Status.CANCELLED)
        self.live = _concert("Kolędy", Project.Status.ACTIVE)
        self.piece = piece

        # A conductor who is not cast: their slice of the materials dashboard is
        # a different query with a different draft rule, so it needs its own case.
        self.maestro_user = User.objects.create_user(
            username="canc-cond", email="cancc@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.maestro_user, role=AppRole.MANAGER)
        self.maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Marta", last_name="Batuta",
            email="cancc@test.pl", voice_type=VoiceType.CONDUCTOR,
        )
        self.podium_draft = Project.objects.create(
            title="Szkic z pulpitu", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT, conductor=self.maestro,
        )
        self.podium_cancelled = Project.objects.create(
            title="Odwołane z pulpitu", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.CANCELLED, conductor=self.maestro,
        )

    def _get(self, url: str):
        self.client.force_authenticate(user=self.singer_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        return response.data

    def _ids(self, url: str) -> set[str]:
        return {str(row["id"]) for row in self._get(url)}

    def test_the_concert_is_off_the_schedule_with_its_rehearsals(self) -> None:
        data = self._get(self.SCHEDULE_URL)
        project_ids = {
            item["project"]["id"] for item in data if item["type"] == "PROJECT"
        }
        rehearsal_projects = {
            str(item["rehearsal"]["project"])
            for item in data
            if item["type"] == "REHEARSAL"
        }

        self.assertNotIn(str(self.cancelled.id), project_ids)
        self.assertNotIn(str(self.cancelled.id), rehearsal_projects)
        self.assertIn(str(self.live.id), project_ids)
        self.assertIn(str(self.live.id), rehearsal_projects)

    def test_the_music_goes_with_it(self) -> None:
        # The score gate (`CLOSED_PROJECT_STATUSES`) already refused the PDF; what
        # was left was the card around it, which is what a singer actually reads.
        project_ids = {row["project"]["id"] for row in self._get(self.MATERIALS_URL)}

        self.assertNotIn(str(self.cancelled.id), project_ids)
        self.assertIn(str(self.live.id), project_ids)

    def test_it_is_not_served_on_the_plain_endpoints_either(self) -> None:
        # Dropping it from the read-models is what the singer sees; dropping it
        # here is what a bookmark or a stale client gets.
        self.assertNotIn(str(self.cancelled.id), self._ids("/api/projects/"))
        self.assertIn(str(self.live.id), self._ids("/api/projects/"))

        rehearsal_projects = {
            str(row["project"]) for row in self._get("/api/rehearsals/")
        }
        self.assertNotIn(str(self.cancelled.id), rehearsal_projects)
        self.assertIn(str(self.live.id), rehearsal_projects)

        programme = self._get(f"/api/program-items/?project={self.cancelled.id}")
        self.assertEqual(list(programme), [])

    def test_the_conductor_keeps_their_draft_and_loses_the_cancellation(self) -> None:
        # The two halves of the exception, in one assertion: a draft is the desk
        # they are assembling on, a cancellation is a concert nobody is giving.
        self.client.force_authenticate(user=self.maestro_user)
        response = self.client.get(self.MATERIALS_URL)
        self.assertEqual(response.status_code, 200)
        project_ids = {str(row["project"]["id"]) for row in response.data}

        self.assertIn(str(self.podium_draft.id), project_ids)
        self.assertNotIn(str(self.podium_cancelled.id), project_ids)

    def test_the_piece_itself_survives_in_the_archive(self) -> None:
        # A cancellation withdraws one project, never the choir's repertoire.
        from archive.models import Piece

        self.assertTrue(
            Piece.objects.filter(id=self.piece.id, is_deleted=False).exists()
        )


class CastingBeforeConfirmationTests(TestCase):
    """Casting states an intention ('you sing B2'), not a fact about consent. The
    conductor must be able to build divisi on a draft, where by definition nobody has
    answered yet. Only a decline blocks: that seat is known to be empty."""

    def setUp(self) -> None:
        from archive.models import Composer, Piece

        self.user = get_user_model().objects.create_user(
            username="cast1", email="cast1@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.user, first_name="Ada", last_name="L", email="cast1@test.pl",
            voice_type=VoiceType.SOPRANO,
        )
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT,
        )
        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        self.piece = Piece.objects.create(title="Pie Jesu", composer=composer)

    def _cast(self, status: str):
        participation = Participation.objects.create(
            artist=self.artist, project=self.project, status=status,
        )
        return CastingAndCrewService.assign_piece_casting({
            "participation": participation,
            "piece": self.piece,
            "voice_line": "S1",
        })

    def test_an_invited_singer_can_be_cast(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            casting = self._cast(Participation.Status.INVITED)
        self.assertEqual(casting.voice_line, "S1")

    def test_a_confirmed_singer_can_be_cast(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            casting = self._cast(Participation.Status.CONFIRMED)
        self.assertEqual(casting.voice_line, "S1")

    def test_a_declined_singer_cannot_be_cast(self) -> None:
        with self.assertRaises(CastingValidationException):
            self._cast(Participation.Status.DECLINED)


class PieceCastingBoardTests(APITestCase):
    """One Save is one write. The board endpoint takes the divisi grid as the
    conductor sees it and reconciles it server-side, so an editing session costs one
    request and at most one message per affected singer — instead of one of each per
    drag, which is what made casting the loudest surface in the app."""

    URL = "/api/piece-castings/board/"
    # Patching the task's own `delay` catches whichever route the seam takes.
    SINGLE = "notifications.announcements.send_notification_task.delay"

    def setUp(self) -> None:
        from archive.models import Composer, Piece

        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="board-mgr", email="boardmgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        self.piece = Piece.objects.create(title="Pie Jesu", composer=composer)
        self.other_piece = Piece.objects.create(title="Libera me", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)

        self.ada, self.ada_user = self._singer("ada", VoiceType.SOPRANO)
        self.bo, self.bo_user = self._singer("bo", VoiceType.ALTO)
        self.cyd, self.cyd_user = self._singer("cyd", VoiceType.TENOR)

        self.client.force_authenticate(user=self.manager_user)

    def _singer(self, slug: str, voice_type: str):
        user = get_user_model().objects.create_user(
            username=f"board-{slug}", email=f"board-{slug}@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=slug.title(), last_name="Singer",
            email=f"board-{slug}@test.pl", voice_type=voice_type,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        return participation, user

    def _row(self, participation: Participation, voice_line: str, **extra) -> dict:
        return {"participation": str(participation.id), "voice_line": voice_line, **extra}

    def _save(self, rows: list[dict], piece=None):
        """One save, then the publication that would follow it — so the count of
        messages below is what the singers actually receive, not what the queue
        happens to hold."""
        from notifications.announcement_queue import AnnouncementQueue

        payload = {
            "project": str(self.project.id),
            "piece": str((piece or self.piece).id),
            "castings": rows,
        }
        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            response = self.client.put(self.URL, payload, format="json")
            AnnouncementQueue.publish(self.project)
        return response, single

    def _lines(self) -> dict[str, str]:
        return {
            str(casting.participation_id): casting.voice_line
            for casting in ProjectPieceCasting.objects.filter(piece=self.piece)
        }

    def test_one_save_creates_updates_and_deletes_in_a_single_request(self) -> None:
        ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S1"
        )
        ProjectPieceCasting.objects.create(
            participation=self.cyd, piece=self.piece, voice_line="T1"
        )

        # Ada moves, Bo joins, Cyd leaves the piece — one editing session, one save.
        response, single = self._save([
            self._row(self.ada, "S2"),
            self._row(self.bo, "A1"),
        ])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._lines(), {str(self.ada.id): "S2", str(self.bo.id): "A1"}
        )

        # Exactly one message per affected singer — never one per drag.
        by_recipient = {
            call.kwargs["recipient_id"]: call.kwargs for call in single.call_args_list
        }
        self.assertEqual(len(single.call_args_list), 3)
        self.assertEqual(len(by_recipient), 3)
        self.assertEqual(
            by_recipient[str(self.bo_user.id)]["notification_type"],
            NotificationType.PIECE_CASTING_ASSIGNED,
        )
        moved = by_recipient[str(self.ada_user.id)]
        self.assertEqual(moved["notification_type"], NotificationType.PIECE_CASTING_UPDATED)
        self.assertEqual(
            moved["metadata"]["changes"],
            [{"field": "voice_line", "old": "S1", "new": "S2"}],
        )
        dropped = by_recipient[str(self.cyd_user.id)]
        self.assertEqual(dropped["level"], NotificationLevel.WARNING)
        self.assertEqual(dropped["metadata"]["event"], "removed")

    def test_resaving_an_unchanged_board_says_nothing(self) -> None:
        casting = ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S1", notes="solo t. 24"
        )

        _, single = self._save([self._row(self.ada, "S1", notes="solo t. 24")])

        # Nothing moved, so nobody is written to — and the row is not rewritten.
        single.assert_not_called()
        self.assertEqual(
            ProjectPieceCasting.objects.get(pk=casting.pk).voice_line, "S1"
        )

    def test_the_board_is_the_truth_for_its_own_piece_only(self) -> None:
        ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S1"
        )
        elsewhere = ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.other_piece, voice_line="S3"
        )

        response, _ = self._save([])

        # Clearing a piece is a legitimate save; the rest of the programme stands.
        self.assertEqual(response.data, [])
        self.assertEqual(self._lines(), {})
        self.assertTrue(ProjectPieceCasting.objects.filter(pk=elsewhere.pk).exists())

    def test_the_response_is_the_persisted_board(self) -> None:
        response, _ = self._save([
            self._row(self.bo, "A1", gives_pitch=True, notes="ton"),
        ])

        self.assertEqual(len(response.data), 1)
        row = response.data[0]
        self.assertEqual(row["voice_line"], "A1")
        self.assertTrue(row["gives_pitch"])
        self.assertEqual(row["notes"], "ton")
        self.assertEqual(row["artist_name"], "Bo Singer")

    def test_a_draft_board_stays_silent(self) -> None:
        self.project.status = Project.Status.DRAFT
        self.project.save(update_fields=["status"])

        response, single = self._save([self._row(self.ada, "S1")])

        self.assertEqual(response.status_code, 200)
        single.assert_not_called()
        self.assertEqual(self._lines(), {str(self.ada.id): "S1"})

    def test_a_declined_singer_cannot_be_put_on_the_board(self) -> None:
        self.ada.status = Participation.Status.DECLINED
        self.ada.save(update_fields=["status"])
        ProjectPieceCasting.objects.create(
            participation=self.bo, piece=self.piece, voice_line="A1"
        )

        response, single = self._save([
            self._row(self.ada, "S1"),
            self._row(self.bo, "A2"),
        ])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "casting_validation")
        single.assert_not_called()
        # The refusal takes the whole save with it — no half-written board.
        self.assertEqual(self._lines(), {str(self.bo.id): "A1"})

    def test_a_singer_who_declined_after_being_cast_keeps_their_hole(self) -> None:
        ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S1"
        )
        self.ada.status = Participation.Status.DECLINED
        self.ada.save(update_fields=["status"])

        response, _ = self._save([
            self._row(self.ada, "S1"),
            self._row(self.bo, "A1"),
        ])

        # Untouched, the declined seat survives the save: the conductor has to keep
        # seeing the gap rather than have it quietly read as filled.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._lines(), {str(self.ada.id): "S1", str(self.bo.id): "A1"}
        )

    def test_an_artist_from_another_project_is_refused(self) -> None:
        other_project = Project.objects.create(
            title="Nieszpory", date_time=timezone.now() + timedelta(days=60),
            status=Project.Status.ACTIVE,
        )
        outsider = Participation.objects.create(
            artist=self.bo.artist, project=other_project,
            status=Participation.Status.CONFIRMED,
        )

        response, single = self._save([self._row(outsider, "A1")])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "casting_validation")
        single.assert_not_called()
        self.assertEqual(ProjectPieceCasting.objects.count(), 0)

    def test_one_singer_cannot_hold_two_voice_lines_on_one_piece(self) -> None:
        response, _ = self._save([
            self._row(self.ada, "S1"),
            self._row(self.ada, "S2"),
        ])

        # The board renders one card per singer; two lines would make the deficit
        # maths count one person as two filled seats.
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "validation_error")
        self.assertEqual(ProjectPieceCasting.objects.count(), 0)

    def test_duplicate_rows_collapse_without_telling_anyone(self) -> None:
        ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S1"
        )
        ProjectPieceCasting.objects.create(
            participation=self.ada, piece=self.piece, voice_line="S2"
        )

        _, single = self._save([self._row(self.ada, "S1")])

        # Ada keeps her seat, so nothing about it is news to her.
        self.assertEqual(
            ProjectPieceCasting.objects.filter(piece=self.piece).count(), 1
        )
        single.assert_not_called()

    def test_an_artist_without_an_account_is_cast_without_a_message(self) -> None:
        offline_artist = Artist.objects.create(
            first_name="Bez", last_name="Konta", email="boardoffline@test.pl",
            voice_type=VoiceType.BASS,
        )
        offline = Participation.objects.create(
            artist=offline_artist, project=self.project,
            status=Participation.Status.INVITED,
        )

        response, single = self._save([self._row(offline, "B1")])

        self.assertEqual(response.status_code, 200)
        single.assert_not_called()
        self.assertEqual(self._lines(), {str(offline.id): "B1"})

    def test_a_singer_cannot_save_the_board(self) -> None:
        self.client.force_authenticate(user=self.ada_user)
        response = self.client.put(
            self.URL,
            {
                "project": str(self.project.id),
                "piece": str(self.piece.id),
                "castings": [self._row(self.ada, "S1")],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(ProjectPieceCasting.objects.count(), 0)


class AnnouncementQueueTests(APITestCase):
    """On a live project the save and the announcement are separate acts. The write
    lands at once — a singer opening the app always sees current data — while what
    the cast would be *told* waits for the conductor to publish it. That is what
    turns an afternoon of edits into one piece of news, and what makes a typo
    corrected a minute later reach nobody at all."""

    # Patching the task's own `delay` catches both routes: the queue's publication
    # and the events that still go out the moment they happen.
    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    SINGLE = "notifications.announcements.send_notification_task.delay"
    # 17:00 UTC == 19:00 in Warsaw — a fixed instant keeps display assertions stable.
    WHEN = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)

    def setUp(self) -> None:
        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="aq-mgr", email="aqmgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.ada, self.ada_user = self._singer("ada", VoiceType.SOPRANO)
        self.bo, self.bo_user = self._singer("bo", VoiceType.ALTO)
        self.client.force_authenticate(user=self.manager_user)

    def _singer(self, slug: str, voice_type: str, status: str = Participation.Status.CONFIRMED):
        user = get_user_model().objects.create_user(
            username=f"aq-{slug}", email=f"aq-{slug}@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=slug.title(), last_name="Singer",
            email=f"aq-{slug}@test.pl", voice_type=voice_type,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project, status=status,
        )
        return participation, user

    def _rehearsal(self, **overrides) -> Rehearsal:
        return Rehearsal.objects.create(**{
            "project": self.project, "date_time": self.WHEN,
            "timezone": "Europe/Warsaw", "focus": "Intro", **overrides,
        })

    def _pending(self) -> list:
        from notifications.announcement_queue import AnnouncementQueue

        return AnnouncementQueue.pending_for(self.project)

    def _publish(self):
        """Publish the queue and hand back both dispatch mocks."""
        from notifications.announcement_queue import AnnouncementQueue

        with patch(self.BULK) as bulk, patch(self.SINGLE) as single, \
                self.captureOnCommitCallbacks(execute=True):
            AnnouncementQueue.publish(self.project)
        return bulk, single

    # --- the queue holds, publication releases ---------------------------------

    def test_an_edit_saves_immediately_and_says_nothing(self) -> None:
        from .dtos import ProjectUpdateDTO

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(title="Requiem — wersja druga"),
            )

        bulk.assert_not_called()
        # The database is the truth; the announcement is the courtesy.
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, "Requiem — wersja druga")
        self.assertEqual(len(self._pending()), 1)

    def test_publishing_sends_the_queue_and_consumes_it(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        bulk, _ = self._publish()

        bulk.assert_called_once()
        kwargs = bulk.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.PROJECT_UPDATED)
        self.assertEqual(
            kwargs["metadata"]["changes"],
            [{"field": "title", "old": "Requiem", "new": "Requiem II"}],
        )
        # Consumed exactly once — a second publication has nothing left to send.
        self.assertEqual(self._pending(), [])
        bulk_again, _ = self._publish()
        bulk_again.assert_not_called()

    def test_a_change_made_and_reverted_reaches_nobody(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Reqiuem"),
        )
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem"),
        )
        bulk, _ = self._publish()

        # The typo and its fix cancel out. Shipping them would spend the cast's
        # attention on the conductor correcting himself.
        bulk.assert_not_called()
        self.assertEqual(self._pending(), [])

    def test_a_reverted_reschedule_takes_its_alarm_with_it(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        moved = self.WHEN + timedelta(minutes=30)
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=moved, focus="Lacrimosa"),
        )
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=self.WHEN),
        )
        bulk, _ = self._publish()

        # The rehearsal never moved, so what is left is a focus change — and with
        # the time row gone, so is the urgency it carried.
        bulk.assert_called_once()
        kwargs = bulk.call_args.kwargs
        self.assertEqual(kwargs["level"], NotificationLevel.WARNING)
        self.assertEqual(
            [c["field"] for c in kwargs["metadata"]["changes"]], ["focus"],
        )

    def test_a_move_that_stands_keeps_the_alarm(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=self.WHEN + timedelta(minutes=30)),
        )
        bulk, _ = self._publish()

        bulk.assert_called_once()
        self.assertEqual(bulk.call_args.kwargs["level"], NotificationLevel.URGENT)

    def test_a_label_only_change_survives_collapsing(self) -> None:
        from .dtos import ProjectUpdateDTO

        # The run sheet carries no old/new by design, so it must not be mistaken
        # for a value that ended where it started.
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(run_sheet=[{"time": "18:00", "label": "Zbiórka"}]),
        )
        bulk, _ = self._publish()

        bulk.assert_called_once()
        self.assertEqual(
            [c["field"] for c in bulk.call_args.kwargs["metadata"]["changes"]],
            ["run_sheet"],
        )

    def test_a_rehearsal_scheduled_then_moved_is_announced_once_at_its_final_time(self) -> None:
        from .dtos import RehearsalCreateDTO, RehearsalUpdateDTO

        rehearsal = RehearsalOperationsService.schedule_rehearsal(
            RehearsalCreateDTO(
                project_id=self.project.id, date_time=self.WHEN,
                timezone="Europe/Warsaw", focus="Intro",
            )
        )
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=self.WHEN + timedelta(hours=1)),
        )
        bulk, _ = self._publish()

        # One new rehearsal, at the time it will actually happen — never an
        # invitation to 19:00 followed by a correction to 20:00.
        bulk.assert_called_once()
        kwargs = bulk.call_args.kwargs
        self.assertEqual(kwargs["notification_type"], NotificationType.REHEARSAL_SCHEDULED)
        self.assertEqual(kwargs["metadata"]["starts_at_display"], "19.06.2026, 20:00")
        self.assertNotIn("changes", kwargs["metadata"])
        # The calendar attachment travels in the same payload — a stale one would
        # put the wrong hour into people's calendars, which no later correction
        # reliably undoes.
        self.assertEqual(
            kwargs["metadata"]["ics"]["start"], "2026-06-19T18:00:00+00:00"
        )

    def test_a_rehearsal_cancelled_before_it_was_announced_is_silent(self) -> None:
        from .dtos import RehearsalCreateDTO

        rehearsal = RehearsalOperationsService.schedule_rehearsal(
            RehearsalCreateDTO(
                project_id=self.project.id, date_time=self.WHEN,
                timezone="Europe/Warsaw", focus="Intro",
            )
        )
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.delete_rehearsal(rehearsal)

        # Nobody was told it existed, so nobody is told it is off — and nothing is
        # left in the queue to announce about a rehearsal that never was.
        bulk.assert_not_called()
        self.assertEqual(self._pending(), [])

    def test_cancelling_an_announced_rehearsal_still_reaches_everyone_at_once(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(focus="Lacrimosa"),
        )
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            RehearsalOperationsService.delete_rehearsal(rehearsal)

        # The alarm never waits for review, and it supersedes the edits made to the
        # rehearsal it cancels.
        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.REHEARSAL_CANCELLED
        )
        self.assertEqual(self._pending(), [])

    def test_cancelling_the_project_flushes_everything_pending(self) -> None:
        from .dtos import ProjectUpdateDTO, RehearsalUpdateDTO

        RehearsalOperationsService.update_rehearsal(
            self._rehearsal(), RehearsalUpdateDTO(focus="Lacrimosa"),
        )
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        self.assertTrue(self._pending())

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.update_project(
                self.project, ProjectUpdateDTO(status=Project.Status.CANCELLED),
            )

        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.PROJECT_CANCELLED
        )
        # Nothing held back about a concert that is off is worth publishing after it.
        self.assertEqual(self._pending(), [])

    def test_leaving_the_cast_waits_for_the_conductor_and_drops_their_queue(self) -> None:
        from archive.models import Composer, Piece

        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        piece = Piece.objects.create(title="Pie Jesu", composer=composer)
        CastingAndCrewService.assign_piece_casting(
            {"participation": self.ada, "piece": piece, "voice_line": "S1"}
        )
        self.assertEqual(len(self._pending()), 1)

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.delete_participation(self.ada)

        # "You're off the roster" is the one announcement that cannot be taken
        # back, so it waits for the conductor like every other edit.
        single.assert_not_called()
        # Their pending part goes: it would arrive as news about a project they can
        # no longer open. The removal itself is what is left to say.
        pending = self._pending()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0].subject_type, "PARTICIPATION")

        _, published = self._publish()
        published.assert_called_once()
        kwargs = published.call_args.kwargs
        self.assertEqual(kwargs["recipient_id"], str(self.ada_user.id))
        self.assertEqual(kwargs["metadata"]["event"], "removed")

    def test_a_removal_undone_before_publication_is_never_told(self) -> None:
        ProjectManagementService.delete_participation(self.ada)
        self.assertEqual(len(self._pending()), 1)

        with patch(self.SINGLE) as invitation, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.create_or_restore_participation({
                "artist": self.ada.artist,
                "project": self.project,
                "status": Participation.Status.INVITED,
            })

        # The whole point of holding it: a mis-click put back a minute later leaves
        # no trace. They are re-invited — which is honest, since the restore did
        # reset them to INVITED — but never told they had left.
        self.assertEqual(self._pending(), [])
        self.assertEqual(
            invitation.call_args.kwargs["notification_type"],
            NotificationType.PROJECT_INVITATION,
        )

    def test_a_removal_is_never_a_bullet_in_a_briefing(self) -> None:
        from .dtos import ProjectUpdateDTO

        # Give the rest of the cast something to hear, so the queue holds both a
        # broadcast and one person's removal.
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II", dress_code_male="Frak"),
        )
        ProjectManagementService.delete_participation(self.ada)

        bulk, single = self._publish()

        # Being taken off a cast is a message about leaving, not a line under
        # "what's new in Requiem" — a project the reader can no longer open.
        removals = [
            call for call in single.call_args_list
            if call.kwargs["metadata"].get("event") == "removed"
        ]
        self.assertEqual(len(removals), 1)
        self.assertEqual(removals[0].kwargs["recipient_id"], str(self.ada_user.id))
        # And she is out of the audience for the rest of it.
        self.assertNotIn(str(self.ada_user.id), bulk.call_args.kwargs["recipient_ids"])

    # --- who hears it, decided at publication ----------------------------------

    def test_someone_who_confirms_after_the_edit_is_still_reached(self) -> None:
        from .dtos import ProjectUpdateDTO

        late, late_user = self._singer("cyd", VoiceType.TENOR, Participation.Status.INVITED)
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        late.status = Participation.Status.CONFIRMED
        late.save(update_fields=["status"])

        bulk, _ = self._publish()

        self.assertIn(str(late_user.id), bulk.call_args.kwargs["recipient_ids"])

    def test_a_singer_still_deciding_hears_what_changed_since_the_invitation(self) -> None:
        from .dtos import ProjectUpdateDTO

        _undecided, undecided_user = self._singer(
            "dee", VoiceType.BASS, Participation.Status.INVITED
        )
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        bulk, _ = self._publish()

        # They are weighing the invitation; a project that has moved since is
        # exactly what that decision rests on.
        self.assertIn(str(undecided_user.id), bulk.call_args.kwargs["recipient_ids"])

    def test_someone_who_declined_hears_nothing_more(self) -> None:
        from .dtos import ProjectUpdateDTO

        _gone, gone_user = self._singer("eve", VoiceType.TENOR, Participation.Status.DECLINED)
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        bulk, _ = self._publish()

        self.assertNotIn(str(gone_user.id), bulk.call_args.kwargs["recipient_ids"])

    def test_a_sectional_change_reaches_only_the_singers_called_to_it(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        rehearsal.invited_participations.set([self.ada])
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(focus="Soprany"),
        )
        bulk, _ = self._publish()

        self.assertEqual(
            bulk.call_args.kwargs["recipient_ids"], [str(self.ada_user.id)]
        )

    def test_each_singer_hears_only_about_their_own_part(self) -> None:
        from archive.models import Composer, Piece

        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        piece = Piece.objects.create(title="Pie Jesu", composer=composer)
        for participation, line in ((self.ada, "S1"), (self.bo, "A1")):
            CastingAndCrewService.assign_piece_casting(
                {"participation": participation, "piece": piece, "voice_line": line}
            )
        _, single = self._publish()

        by_recipient = {
            call.kwargs["recipient_id"]: call.kwargs for call in single.call_args_list
        }
        self.assertEqual(
            set(by_recipient), {str(self.ada_user.id), str(self.bo_user.id)}
        )
        self.assertEqual(by_recipient[str(self.ada_user.id)]["metadata"]["voice_line"], "S1")

    def test_a_seat_given_and_taken_back_before_publication_is_silent(self) -> None:
        from archive.models import Composer, Piece

        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        piece = Piece.objects.create(title="Pie Jesu", composer=composer)
        casting = CastingAndCrewService.assign_piece_casting(
            {"participation": self.ada, "piece": piece, "voice_line": "S1"}
        )
        CastingAndCrewService.delete_piece_casting(casting)

        _, single = self._publish()

        # She was never told she had the part, so she is not told she lost it.
        single.assert_not_called()

    # --- the conductor's door --------------------------------------------------

    def test_preview_reports_what_would_go_out_without_sending_it(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II", description="nowy opis"),
        )
        with patch(self.BULK) as bulk:
            response = self.client.get(f"/api/projects/{self.project.id}/announcements/")

        self.assertEqual(response.status_code, 200)
        bulk.assert_not_called()
        self.assertEqual(response.data["change_count"], 1)
        self.assertEqual(response.data["recipient_count"], 2)
        line = response.data["changes"][0]
        # The description is not surfaceable, so it never became a row at all.
        self.assertEqual(line["field"], "title")
        self.assertEqual([c["field"] for c in line["metadata"]["changes"]], ["title"])
        # The line carries the payload its emitter built, so the review sheet renders
        # it from the same facts the artist's own message will.
        self.assertEqual(line["metadata"]["project_name"], "Requiem II")
        self.assertEqual(line["recipient_count"], 2)

    def test_the_queue_can_be_published_from_its_endpoint(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/projects/{self.project.id}/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["announcements"], 1)
        bulk.assert_called_once()
        self.assertEqual(self._pending(), [])

    def test_the_queue_can_be_abandoned_without_telling_anyone(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/projects/{self.project.id}/announcements/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["discarded"], 1)
        bulk.assert_not_called()
        self.assertEqual(self._pending(), [])
        # The edit itself stands — only its announcement was dropped.
        self.project.refresh_from_db()
        self.assertEqual(self.project.title, "Requiem II")

    def test_a_singer_cannot_read_or_publish_the_queue(self) -> None:
        self.client.force_authenticate(user=self.ada_user)
        url = f"/api/projects/{self.project.id}/announcements/"

        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url).status_code, 403)

    # --- publication is one-way ------------------------------------------------

    def test_a_live_project_cannot_be_turned_back_into_a_draft(self) -> None:
        response = self.client.patch(
            f"/api/projects/{self.project.id}/",
            {"status": Project.Status.DRAFT},
            format="json",
        )

        # The cast has read the invitation; re-drafting would silence a concert
        # they are already preparing and strand whatever is queued about it.
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "project_cannot_unpublish")
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.ACTIVE)


class AnnouncementReviewTests(APITestCase):
    """The conductor's surface over the queue: what the review sheet is shown, and
    what happens to a line they untick.

    Holding is not discarding. An unticked line stays pending and turns up next
    time — which is what lets the sheet get away with a single per-line control,
    since publishing the rest leaves exactly the held rows behind for one explicit
    discard to drop."""

    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    SINGLE = "notifications.announcements.send_notification_task.delay"
    WHEN = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)

    def setUp(self) -> None:
        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="ar-mgr", email="armgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.ada, self.ada_user = self._singer("ada")
        self.bo, self.bo_user = self._singer("bo")
        self.client.force_authenticate(user=self.manager_user)
        self.url = f"/api/projects/{self.project.id}/announcements/"

    def _singer(self, slug: str):
        user = get_user_model().objects.create_user(
            username=f"ar-{slug}", email=f"ar-{slug}@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=slug.title(), last_name="Singer",
            email=f"ar-{slug}@test.pl", voice_type=VoiceType.SOPRANO,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        return participation, user

    def _pending(self) -> list:
        from notifications.announcement_queue import AnnouncementQueue

        return AnnouncementQueue.pending_for(self.project)

    def _preview(self, **params) -> dict:
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200)
        return response.data

    # --- the sheet's lines -----------------------------------------------------

    def test_a_project_diff_is_offered_one_field_at_a_time(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project,
            ProjectUpdateDTO(title="Requiem II", dress_code_male="Frak"),
        )
        data = self._preview()

        # A venue and a dress code have nothing to do with each other, so the sheet
        # can send one and hold the other.
        self.assertEqual(data["change_count"], 2)
        self.assertEqual(
            sorted(line["field"] for line in data["changes"]),
            ["dress_code", "title"],
        )
        # Each line carries only its own diff, so it renders as one fact.
        for line in data["changes"]:
            self.assertEqual(
                [c["field"] for c in line["metadata"]["changes"]], [line["field"]],
            )

    def test_a_rehearsals_whole_diff_stays_one_line(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=self.WHEN, timezone="Europe/Warsaw",
            focus="Intro",
        )
        from notifications.announcement_queue import AnnouncementQueue
        AnnouncementQueue.discard(self.project)

        RehearsalOperationsService.update_rehearsal(
            rehearsal,
            RehearsalUpdateDTO(
                date_time=self.WHEN + timedelta(hours=1), focus="Lacrimosa",
            ),
        )
        data = self._preview()

        # "It moved, and the focus moved with it" is one fact about one evening —
        # splitting it would offer the conductor half an announcement.
        self.assertEqual(data["change_count"], 1)
        line = data["changes"][0]
        self.assertEqual(line["field"], "")
        self.assertEqual(
            sorted(c["field"] for c in line["metadata"]["changes"]),
            ["date_time", "focus"],
        )
        # The move earns the alarm, and the line has to show it.
        self.assertEqual(line["level"], NotificationLevel.URGENT)

    def test_the_alarm_is_shown_per_line_not_per_announcement(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project,
            ProjectUpdateDTO(call_time=self.WHEN, title="Requiem II"),
        )
        levels = {
            line["field"]: line["level"] for line in self._preview()["changes"]
        }

        # Holding the call time visibly calms the rest of the diff, which it could
        # not do if every line wore the announcement's loudest level.
        self.assertEqual(levels["call_time"], NotificationLevel.URGENT)
        self.assertEqual(levels["title"], NotificationLevel.WARNING)

    def test_a_pending_cast_removal_is_named_and_flagged(self) -> None:
        ProjectManagementService.delete_participation(self.bo)
        data = self._preview()

        # Discard must be able to warn about this one by name: dropping the queue
        # would leave her removed and never told.
        self.assertTrue(data["has_cast_removal"])
        line = next(
            item for item in data["changes"] if item["subject_type"] == "PARTICIPATION"
        )
        self.assertEqual(line["recipient_name"], "Bo Singer")
        self.assertEqual(line["kind"], "REMOVED")

    def test_the_preview_says_who_receives_which_lines(self) -> None:
        from archive.models import Piece

        from .dtos import ProjectUpdateDTO

        piece = Piece.objects.create(title="Lacrimosa")
        CastingAndCrewService.assign_piece_casting(
            {"participation": self.ada, "piece": piece, "voice_line": "S1"}
        )
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        data = self._preview()

        by_recipient = {row["name"]: row for row in data["recipients"]}
        # Ada has her part and the title change, so the fold earns its keep for her;
        # Bo has only the title change and gets that change's own message.
        self.assertEqual(len(by_recipient["Ada Singer"]["change_ids"]), 2)
        self.assertTrue(by_recipient["Ada Singer"]["is_briefing"])
        self.assertEqual(len(by_recipient["Bo Singer"]["change_ids"]), 1)
        self.assertFalse(by_recipient["Bo Singer"]["is_briefing"])
        self.assertEqual(data["message_count"], 2)

    def test_the_preview_reflects_a_note_before_it_is_written(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )

        # A note does not add messages — two people are written to either way. What
        # it changes is what arrives: each of them now reads a briefing addressed to
        # them rather than a bare field diff. The sheet has to show that the moment
        # the conductor starts typing, which is why the flag travels without the text.
        plain, noted = self._preview(), self._preview(with_note=1)
        self.assertEqual((plain["message_count"], plain["briefing_count"]), (2, 0))
        self.assertEqual((noted["message_count"], noted["briefing_count"]), (2, 2))

    # --- holding a line back ---------------------------------------------------

    def test_an_unticked_line_is_left_pending_rather_than_sent(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project,
            ProjectUpdateDTO(title="Requiem II", dress_code_male="Frak"),
        )
        held = next(
            line for line in self._preview()["changes"] if line["field"] == "dress_code"
        )

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url, {"exclude": held["row_ids"]}, format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["held"], 1)
        # Only the title change went out.
        self.assertEqual(
            [c["field"] for c in bulk.call_args.kwargs["metadata"]["changes"]],
            ["title"],
        )
        # The dress code is still waiting, not discarded — the conductor said "not
        # yet", and the next review has to show it again.
        remaining = self._pending()
        self.assertEqual([row.change_field for row in remaining], ["dress_code"])
        self.assertEqual(self._preview()["change_count"], 1)

    def test_the_preview_counts_the_selection_but_still_shows_what_is_held(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project,
            ProjectUpdateDTO(title="Requiem II", dress_code_male="Frak"),
        )
        rows = self._preview()["changes"]
        held = next(line for line in rows if line["field"] == "dress_code")

        data = self._preview(exclude=",".join(held["row_ids"]))

        # Both lines are listed — the conductor has to see what they are holding —
        # while the counts describe only what would actually leave.
        self.assertEqual(data["change_count"], 2)
        self.assertEqual(
            {line["field"]: line["is_held"] for line in data["changes"]},
            {"title": False, "dress_code": True},
        )
        # One surviving change, written to both singers.
        self.assertEqual(data["message_count"], 2)

    def test_holding_a_creation_holds_everything_about_it(self) -> None:
        from .dtos import RehearsalCreateDTO, RehearsalUpdateDTO

        rehearsal = RehearsalOperationsService.schedule_rehearsal(
            RehearsalCreateDTO(
                project_id=self.project.id, date_time=self.WHEN,
                timezone="Europe/Warsaw", focus="Intro",
            )
        )
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=self.WHEN + timedelta(hours=1)),
        )
        creation = next(
            row for row in self._pending() if row.kind == "CREATED"
        )

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url, {"exclude": [str(creation.id)]}, format="json",
            )

        # Sending the move on its own would announce a change to a rehearsal the
        # cast has never been told exists. The sheet cannot express this selection,
        # but the endpoint accepts row ids from a client and must refuse the hole.
        bulk.assert_not_called()
        self.assertEqual(response.data["messages"], 0)
        self.assertEqual(len(self._pending()), 2)

    def test_publishing_the_rest_leaves_the_held_rows_for_one_discard(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project,
            ProjectUpdateDTO(title="Requiem II", dress_code_male="Frak"),
        )
        held = next(
            line for line in self._preview()["changes"] if line["field"] == "dress_code"
        )
        with patch(self.BULK), self.captureOnCommitCallbacks(execute=True):
            self.client.post(self.url, {"exclude": held["row_ids"]}, format="json")

        with patch(self.BULK) as bulk, self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)

        # This is why one per-line control is enough: what is left after publishing
        # is exactly what the conductor never wanted to announce.
        self.assertEqual(response.data["discarded"], 1)
        bulk.assert_not_called()
        self.assertEqual(self._pending(), [])
        self.project.refresh_from_db()
        self.assertEqual(self.project.dress_code_male, "Frak")

    # --- the dashboard badge ---------------------------------------------------

    def test_a_waiting_queue_is_visible_from_the_project_list(self) -> None:
        from .dtos import ProjectUpdateDTO

        response = self.client.get(f"/api/projects/{self.project.id}/")
        self.assertFalse(response.data["has_unannounced_changes"])

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        response = self.client.get(f"/api/projects/{self.project.id}/")
        self.assertTrue(response.data["has_unannounced_changes"])

        # It is the conductor's business, not the cast's: the app already shows the
        # singer the new venue, and a "not official yet" badge would only teach them
        # to distrust it.
        self.client.force_authenticate(user=self.ada_user)
        response = self.client.get(f"/api/projects/{self.project.id}/")
        self.assertFalse(response.data["has_unannounced_changes"])


class ProjectBriefingTests(APITestCase):
    """Collapsing answers "what changed"; the briefing answers "how many envelopes
    leave". Five rehearsals across twelve singers is sixty e-mails if each change
    travels on its own, and twelve if each *person* does — that second number is
    the whole point of the queue, and this is where it is bought.

    A singer with a single piece of news is deliberately left out of the fold:
    "Rehearsal moved — Friday at 19:00" names what happened far better than a
    briefing wrapping one line."""

    BULK = "notifications.announcements.send_bulk_notifications_task.delay"
    SINGLE = "notifications.announcements.send_notification_task.delay"
    WHEN = datetime(2026, 6, 19, 17, 0, tzinfo=UTC)

    def setUp(self) -> None:
        from archive.models import Composer, Piece

        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="br-mgr", email="brmgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.ada, self.ada_user = self._singer("ada", VoiceType.SOPRANO)
        self.bo, self.bo_user = self._singer("bo", VoiceType.ALTO)
        self.piece = Piece.objects.create(
            title="Pie Jesu",
            composer=Composer.objects.create(first_name="Gabriel", last_name="Fauré"),
        )
        self.client.force_authenticate(user=self.manager_user)

    def _singer(self, slug: str, voice_type: str):
        user = get_user_model().objects.create_user(
            username=f"br-{slug}", email=f"br-{slug}@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=slug.title(), last_name="Singer",
            email=f"br-{slug}@test.pl", voice_type=voice_type,
        )
        participation = Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        return participation, user

    def _rehearsal(self, **overrides) -> Rehearsal:
        from .dtos import RehearsalCreateDTO

        return RehearsalOperationsService.schedule_rehearsal(RehearsalCreateDTO(**{
            "project_id": self.project.id, "date_time": self.WHEN,
            "timezone": "Europe/Warsaw", "focus": "Intro", **overrides,
        }))

    def _publish(self, **kwargs):
        from notifications.announcement_queue import AnnouncementQueue

        with patch(self.BULK) as bulk, patch(self.SINGLE) as single, \
                self.captureOnCommitCallbacks(execute=True):
            result = AnnouncementQueue.publish(self.project, **kwargs)
        return bulk, single, result

    @staticmethod
    def _briefings(single) -> dict:
        return {
            call.kwargs["recipient_id"]: call.kwargs
            for call in single.call_args_list
            if call.kwargs["notification_type"] == NotificationType.PROJECT_BRIEFING
        }

    # --- the headline arithmetic ------------------------------------------------

    def test_a_schedule_full_of_rehearsals_is_one_message_per_singer(self) -> None:
        for hour in range(5):
            self._rehearsal(date_time=self.WHEN + timedelta(days=hour))

        bulk, single, result = self._publish()

        # Five pieces of news, two singers: two messages, not ten. Nothing goes out
        # per change any more, so the bulk path is not used at all.
        bulk.assert_not_called()
        briefings = self._briefings(single)
        self.assertEqual(
            set(briefings), {str(self.ada_user.id), str(self.bo_user.id)}
        )
        self.assertEqual(result["messages"], 2)
        self.assertEqual(result["announcements"], 5)
        self.assertEqual(len(briefings[str(self.ada_user.id)]["metadata"]["items"]), 5)

    def test_a_lone_change_still_arrives_as_itself(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        self._publish()
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(focus="Lacrimosa"),
        )

        bulk, single, result = self._publish()

        # One thing happened, so it is announced as that thing — "Rehearsal moved"
        # says more than a briefing wrapping a single line ever could.
        self._briefings(single)
        self.assertEqual(self._briefings(single), {})
        bulk.assert_called_once()
        self.assertEqual(
            bulk.call_args.kwargs["notification_type"], NotificationType.REHEARSAL_UPDATED
        )
        # One announcement, one dispatch — and two messages, because two people are
        # written to. Envelopes are what the conductor is promising when they press
        # send, so that is what this number counts.
        self.assertEqual(result["messages"], 2)

    # --- what each person's copy contains ---------------------------------------

    def test_a_briefing_carries_the_readers_own_part_and_nobody_elses(self) -> None:
        from .dtos import ProjectUpdateDTO

        for participation, line in ((self.ada, "S1"), (self.bo, "A1")):
            CastingAndCrewService.assign_piece_casting(
                {"participation": participation, "piece": self.piece, "voice_line": line}
            )
        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )

        _bulk, single, _result = self._publish()
        briefings = self._briefings(single)

        for user, line in ((self.ada_user, "S1"), (self.bo_user, "A1")):
            items = briefings[str(user.id)]["metadata"]["items"]
            castings = [i for i in items if i["subject_type"] == "CASTING"]
            self.assertEqual(len(castings), 1)
            self.assertEqual(castings[0]["metadata"]["voice_line"], line)
            # The shared change is in both copies; the personal one is in neither
            # of the other's.
            self.assertTrue(any(i["subject_type"] == "PROJECT" for i in items))

    def test_a_briefing_is_as_loud_as_the_loudest_thing_in_it(self) -> None:
        from .dtos import RehearsalUpdateDTO

        rehearsal = self._rehearsal()
        self._publish()
        CastingAndCrewService.assign_piece_casting(
            {"participation": self.ada, "piece": self.piece, "voice_line": "S1"}
        )
        RehearsalOperationsService.update_rehearsal(
            rehearsal, RehearsalUpdateDTO(date_time=self.WHEN + timedelta(hours=1)),
        )

        _bulk, single, _result = self._publish()
        briefing = self._briefings(single)[str(self.ada_user.id)]

        # A briefing containing a reschedule is an alarm, however calm the rest of
        # it reads — otherwise batching would be a way of muting one.
        self.assertEqual(briefing["level"], NotificationLevel.URGENT)

    def test_every_rehearsal_in_a_briefing_travels_in_one_calendar(self) -> None:
        for day in range(3):
            self._rehearsal(date_time=self.WHEN + timedelta(days=day))

        _bulk, single, _result = self._publish()
        metadata = self._briefings(single)[str(self.ada_user.id)]["metadata"]

        # Three attachments would read as three pieces of news, which is precisely
        # what the fold exists to prevent.
        self.assertEqual(len(metadata["ics"]), 3)
        self.assertTrue(all("ics" not in item["metadata"] for item in metadata["items"]))

    # --- the conductor's own words ----------------------------------------------

    def test_a_note_folds_even_a_single_change(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )

        bulk, single, result = self._publish(note="Prosimy o punktualność.")

        # A note is addressed to the reader rather than describing a field, so it
        # needs the surface a briefing gives it.
        bulk.assert_not_called()
        briefings = self._briefings(single)
        self.assertEqual(result["briefings"], 2)
        self.assertEqual(
            briefings[str(self.ada_user.id)]["metadata"]["note"],
            "Prosimy o punktualność.",
        )

    def test_the_preview_counts_messages_not_just_changes(self) -> None:
        for day in range(4):
            self._rehearsal(date_time=self.WHEN + timedelta(days=day))

        response = self.client.get(f"/api/projects/{self.project.id}/announcements/")

        # Four things changed; two people hear about them. The second number is the
        # one that belongs on a confirm button.
        self.assertEqual(response.data["change_count"], 4)
        self.assertEqual(response.data["message_count"], 2)
        self.assertEqual(response.data["briefing_count"], 2)

    def test_the_endpoint_carries_the_note_through(self) -> None:
        from .dtos import ProjectUpdateDTO

        ProjectManagementService.update_project(
            self.project, ProjectUpdateDTO(title="Requiem II"),
        )
        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/projects/{self.project.id}/announcements/",
                {"note": "Zmiana sali na stałe."}, format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["briefings"], 2)
        self.assertEqual(
            self._briefings(single)[str(self.bo_user.id)]["metadata"]["note"],
            "Zmiana sali na stałe.",
        )


class ProjectPublicationTests(APITestCase):
    """Publication is the one message a singer gets before deciding, so it has to
    carry the whole cost of saying yes — the rehearsals they are called to and the
    part they would be singing, not just a concert date. It runs through its own
    endpoint because it has a side effect the conductor must see first."""

    SINGLE = "notifications.announcements.send_notification_task.delay"

    def setUp(self) -> None:
        from archive.models import Composer, Piece
        from logistics.models import Location

        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="pub-mgr", email="pubmgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.singer_user = User.objects.create_user(
            username="pub-singer", email="pubsinger@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Ada", last_name="Lorenz",
            email="pubsinger@test.pl", voice_type=VoiceType.SOPRANO,
        )
        # No linked account: reachable in the roster, unreachable by notification.
        self.offline = Artist.objects.create(
            first_name="Bez", last_name="Konta", email="offline@test.pl",
            voice_type=VoiceType.ALTO,
        )

        self.venue = Location.objects.create(name="Bazylika św. Krzyża")
        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            call_time=timezone.now() + timedelta(days=30, hours=-2),
            status=Project.Status.DRAFT, location=self.venue,
            dress_code_male="Frak",
        )

        composer = Composer.objects.create(first_name="Gabriel", last_name="Fauré")
        self.piece = Piece.objects.create(title="Pie Jesu", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)

        self.participation = Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.INVITED,
        )
        ProjectPieceCasting.objects.create(
            participation=self.participation, piece=self.piece, voice_line="S2",
        )
        self.shared_rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=10),
            location=self.venue, focus="Lacrimosa",
        )

    def _publish(self):
        self.client.force_authenticate(user=self.manager_user)
        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/projects/{self.project.id}/publish/")
        return response, single

    def test_preview_reports_recipients_without_sending_anything(self) -> None:
        self.client.force_authenticate(user=self.manager_user)
        with patch(self.SINGLE) as single:
            response = self.client.get(f"/api/projects/{self.project.id}/publish/")

        single.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_publishable"])
        self.assertEqual(response.data["recipient_count"], 1)
        self.assertEqual(len(response.data["recipients"]), 1)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.DRAFT)

    def test_preview_names_the_gaps_without_blocking(self) -> None:
        bare = Project.objects.create(
            title="Nagi szkic", date_time=timezone.now() + timedelta(days=5),
            status=Project.Status.DRAFT,
        )
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(f"/api/projects/{bare.id}/publish/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_publishable"])
        self.assertEqual(
            set(response.data["warnings"]),
            {"no_cast", "no_rehearsals", "no_program", "no_location"},
        )

    def test_preview_flags_artists_no_message_can_reach(self) -> None:
        Participation.objects.create(
            artist=self.offline, project=self.project,
            status=Participation.Status.INVITED,
        )
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.get(f"/api/projects/{self.project.id}/publish/")

        self.assertIn("unreachable_artists", response.data["warnings"])
        # Two people on the list, one of whom will never receive it.
        self.assertEqual(len(response.data["recipients"]), 2)
        self.assertEqual(response.data["recipient_count"], 1)

    def test_publishing_takes_the_project_live_and_invites_the_cast(self) -> None:
        response, single = self._publish()

        self.assertEqual(response.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.ACTIVE)
        single.assert_called_once()
        self.assertEqual(
            single.call_args.kwargs["notification_type"],
            NotificationType.PROJECT_INVITATION,
        )

    def test_the_invitation_states_the_cost_of_saying_yes(self) -> None:
        _, single = self._publish()
        metadata = single.call_args.kwargs["metadata"]

        # The rehearsal they are called to, the part they would sing, the
        # programme — the facts the decision actually turns on.
        self.assertEqual(len(metadata["rehearsals"]), 1)
        self.assertEqual(
            metadata["rehearsals"][0]["rehearsal_id"], str(self.shared_rehearsal.id)
        )
        self.assertEqual(metadata["voice_lines"], ["S2"])
        self.assertEqual(metadata["program"], ["Pie Jesu"])
        self.assertEqual(metadata["location"], "Bazylika św. Krzyża")
        self.assertEqual(metadata["dress_code"], "Frak")
        self.assertTrue(metadata["call_time_at"])

    def test_a_sectional_reaches_only_the_singers_called_to_it(self) -> None:
        other_user = get_user_model().objects.create_user(
            username="pub-other", email="pubother@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=other_user, role=AppRole.ARTIST)
        other_artist = Artist.objects.create(
            user=other_user, first_name="Bo", last_name="Tenor",
            email="pubother@test.pl", voice_type=VoiceType.TENOR,
        )
        other = Participation.objects.create(
            artist=other_artist, project=self.project,
            status=Participation.Status.INVITED,
        )
        sectional = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=12),
        )
        sectional.invited_participations.set([self.participation])

        _, single = self._publish()

        by_recipient = {
            call.kwargs["recipient_id"]: call.kwargs["metadata"]
            for call in single.call_args_list
        }
        called = {
            entry["rehearsal_id"]
            for entry in by_recipient[str(self.singer_user.id)]["rehearsals"]
        }
        not_called = {
            entry["rehearsal_id"]
            for entry in by_recipient[str(other_user.id)]["rehearsals"]
        }
        self.assertEqual(called, {str(self.shared_rehearsal.id), str(sectional.id)})
        self.assertEqual(not_called, {str(self.shared_rehearsal.id)})
        self.assertEqual(other.status, Participation.Status.INVITED)

    def test_publishing_twice_is_refused(self) -> None:
        self._publish()
        self.client.force_authenticate(user=self.manager_user)
        with patch(self.SINGLE) as single:
            response = self.client.post(f"/api/projects/{self.project.id}/publish/")

        # Publication happens once; a second run would re-invite people who
        # already answered.
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "project_already_published")
        single.assert_not_called()

    def test_a_singer_cannot_publish(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        response = self.client.post(f"/api/projects/{self.project.id}/publish/")

        self.assertEqual(response.status_code, 403)
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, Project.Status.DRAFT)

    def test_joining_a_live_project_brings_the_whole_picture(self) -> None:
        self._publish()
        latecomer = Artist.objects.create(
            user=get_user_model().objects.create_user(
                username="pub-late", email="publate@test.pl", password="pw123456"
            ),
            first_name="Late", last_name="Comer", email="publate@test.pl",
            voice_type=VoiceType.BASS,
        )
        self.project.refresh_from_db()

        with patch(self.SINGLE) as single, self.captureOnCommitCallbacks(execute=True):
            ProjectManagementService.create_or_restore_participation({
                "artist": latecomer, "project": self.project,
                "status": Participation.Status.INVITED,
            })

        # For them the whole project is news, so they get the same full invitation
        # the cast received at publication — not a bare concert date.
        single.assert_called_once()
        metadata = single.call_args.kwargs["metadata"]
        self.assertEqual(len(metadata["rehearsals"]), 1)
        self.assertEqual(metadata["program"], ["Pie Jesu"])


class ConductorScheduleAndMaterialsTests(APITestCase):
    """
    A conductor (Project.conductor → Artist → user) who is not cast in a project
    still sees it — and *every* rehearsal within — in the personal schedule and
    materials dashboards, carrying no participation (no self-RSVP / self-report)
    but the full cast on each piece.
    """

    SCHEDULE_URL = "/api/participations/schedule-dashboard/"
    MATERIALS_URL = "/api/participations/materials-dashboard/"

    def setUp(self) -> None:
        from archive.models import Composer, Piece, ScoreEdition, Track
        from core.constants import VoiceLine

        from .models import ProgramItem, ProjectPieceCasting

        User = get_user_model()
        now = timezone.now()

        # The conductor: a User linked to a CONDUCTOR-voiced Artist.
        self.maestro_user = User.objects.create_user(
            username="cond-maestro", email="cond@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.maestro_user, role=AppRole.MANAGER)
        self.maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Wanda", last_name="Baton",
            email="cond@test.pl", voice_type=VoiceType.CONDUCTOR,
        )

        # A singer cast in the project, so a rehearsal can invite them only.
        self.singer_user = User.objects.create_user(
            username="cond-singer", email="cs@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Sam", last_name="Singer",
            email="cs@test.pl", voice_type=VoiceType.TENOR,
        )

        composer = Composer.objects.create(first_name="Gustav", last_name="Holst")
        self.piece = Piece.objects.create(title="The Planets", composer=composer)

        # Project the maestro conducts but is NOT cast in.
        self.project = Project.objects.create(
            title="Podium Night", date_time=now, status=Project.Status.ACTIVE,
            conductor=self.maestro,
        )
        self.singer_part = Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)
        ProjectPieceCasting.objects.create(
            participation=self.singer_part, piece=self.piece,
            voice_line=VoiceLine.TENOR_1,
        )
        ScoreEdition.objects.create(
            piece=self.piece, pdf_file=_pdf_upload(), original_filename="planets.pdf",
            sha256="", page_count=1,
        )
        Track.objects.create(
            piece=self.piece, voice_part=VoiceLine.TENOR_1, audio_file=_audio_upload()
        )

        # Two rehearsals: one open to everyone, one that invites the singer only
        # (never the maestro — a conductor is never on an invite list).
        self.reh_open = Rehearsal.objects.create(
            project=self.project, date_time=now + timedelta(days=1),
        )
        self.reh_singer_only = Rehearsal.objects.create(
            project=self.project, date_time=now + timedelta(days=2),
        )
        self.reh_singer_only.invited_participations.add(self.singer_part)

        # A foreign project the maestro has nothing to do with.
        self.foreign = Project.objects.create(
            title="Someone Else's Concert", date_time=now, status=Project.Status.ACTIVE,
        )
        self.reh_foreign = Rehearsal.objects.create(
            project=self.foreign, date_time=now + timedelta(days=1),
        )

    # --- schedule ------------------------------------------------------- #

    def test_conductor_sees_conducted_project_without_participation(self) -> None:
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(self.SCHEDULE_URL)
        self.assertEqual(resp.status_code, 200)
        projects = [i for i in resp.data if i["type"] == "PROJECT"]
        project_ids = {p["project"]["id"] for p in projects}
        self.assertIn(str(self.project.id), project_ids)
        self.assertNotIn(str(self.foreign.id), project_ids)
        podium = next(p for p in projects if p["project"]["id"] == str(self.project.id))
        self.assertIsNone(podium["participation_id"])  # nothing to RSVP against

    def test_conductor_sees_every_rehearsal_of_conducted_project(self) -> None:
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(self.SCHEDULE_URL)
        by_id = {
            i["rehearsal"]["id"]: i for i in resp.data if i["type"] == "REHEARSAL"
        }
        # The open rehearsal AND the one that invites only the singer — the
        # invite list never filters rehearsals for the conductor who runs them.
        self.assertIn(str(self.reh_open.id), by_id)
        self.assertIn(str(self.reh_singer_only.id), by_id)
        self.assertNotIn(str(self.reh_foreign.id), by_id)  # foreign project stays out
        self.assertIsNone(by_id[str(self.reh_open.id)]["participation_id"])
        self.assertIsNone(by_id[str(self.reh_open.id)]["my_attendance"])

    # --- materials ------------------------------------------------------ #

    def test_conductor_materials_row_is_marked_and_shows_full_cast(self) -> None:
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(self.MATERIALS_URL)
        self.assertEqual(resp.status_code, 200)
        by_project = {e["project"]["id"]: e for e in resp.data}
        self.assertIn(str(self.project.id), by_project)
        entry = by_project[str(self.project.id)]
        self.assertTrue(entry["is_conducting"])
        self.assertIsNone(entry["participation_id"])

        piece = entry["program"][0]["piece"]
        self.assertIsNone(piece["my_casting"])  # the conductor has no part
        cast_ids = {c["artist_id"] for c in piece["castings"]}
        self.assertIn(str(self.singer.id), cast_ids)  # the full cast is surfaced
        # Live project → scores + tracks delivered through the gated endpoints.
        self.assertEqual(len(piece["editions"]), 1)
        self.assertEqual(len(piece["tracks"]), 1)

    def test_singer_materials_row_is_not_conducting(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(self.MATERIALS_URL)
        entry = next(
            e for e in resp.data if e["project"]["id"] == str(self.project.id)
        )
        self.assertFalse(entry["is_conducting"])
        self.assertEqual(entry["participation_id"], str(self.singer_part.id))

    def test_conductor_who_also_sings_gets_a_single_singer_row(self) -> None:
        # Cast the maestro as well: the project must appear once (the singer row,
        # with their personalised data), never duplicated by the conductor read
        # model.
        maestro_part = Participation.objects.create(
            artist=self.maestro, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(self.MATERIALS_URL)
        rows = [e for e in resp.data if e["project"]["id"] == str(self.project.id)]
        self.assertEqual(len(rows), 1)
        self.assertFalse(rows[0]["is_conducting"])
        self.assertEqual(rows[0]["participation_id"], str(maestro_part.id))


class ConcertDaySheetTests(APITestCase):
    """
    The concert-day sheet is audience-shaped. This covers the access model
    (the production export is manager-only; the personalized day sheet is scoped
    to the cast singer or the conductor), the per-singer personalization, the
    chronological run sheet, and — critically — that a singer's sheet never
    carries the crew's private phone/email.
    """

    def setUp(self) -> None:
        from archive.models import Composer, Piece
        from core.constants import AppRole, VoiceLine
        from core.models import UserProfile

        from .models import (
            Artist,
            Collaborator,
            CrewAssignment,
            ProgramItem,
            ProjectPieceCasting,
        )

        User = get_user_model()
        now = timezone.now()

        # Manager without an artist profile — production export only.
        self.manager = User.objects.create_user(
            username="ds-mgr", email="ds-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        # Conductor: a User linked to a CONDUCTOR-voiced Artist; conducts, not cast.
        self.maestro_user = User.objects.create_user(
            username="ds-cond", email="ds-cond@test.pl", password="pw123456"
        )
        UserProfile.objects.create(
            user=self.maestro_user, role=AppRole.ARTIST, first_name_vocative="Wando"
        )
        self.maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Wanda", last_name="Baton",
            email="ds-cond@test.pl", voice_type=VoiceType.CONDUCTOR,
            phone_number="600100100",
        )

        # Cast singer — the recipient of a personalized sheet.
        self.singer_user = User.objects.create_user(
            username="ds-singer", email="ds-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(
            user=self.singer_user, role=AppRole.ARTIST, first_name_vocative="Ado"
        )
        self.singer = Artist.objects.create(
            user=self.singer_user, first_name="Ada", last_name="Lovelace",
            email="ds-singer@test.pl", voice_type=VoiceType.ALTO,
        )

        # A section-mate (same voice) so "Twoja sekcja" is non-empty.
        self.mate = Artist.objects.create(
            first_name="Bea", last_name="Second", email="ds-mate@test.pl",
            voice_type=VoiceType.ALTO,
        )

        # Outsider — neither cast nor conducting.
        self.outsider_user = User.objects.create_user(
            username="ds-out", email="ds-out@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.outsider_user, role=AppRole.ARTIST)

        self.project = Project.objects.create(
            title="Vespers of Light", date_time=now, timezone="Europe/Warsaw",
            # Published, like every concert whose day sheet somebody fetches. The
            # fixture used to take the model's DRAFT default and so asserted the
            # access model against a project the cast is not shown at all.
            status=Project.Status.ACTIVE,
            call_time=now - timedelta(hours=1), conductor=self.maestro,
            run_sheet=[
                {"time": "20:00", "title": "Downbeat"},
                {"time": "18:30", "title": "Call & warm-up"},
                {"time": "19:15", "title": "Sound check"},
            ],
        )

        self.singer_part = Participation.objects.create(
            artist=self.singer, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        Participation.objects.create(
            artist=self.mate, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

        composer = Composer.objects.create(first_name="Claudio", last_name="Monteverdi")
        self.piece1 = Piece.objects.create(title="Dixit Dominus", composer=composer)
        self.piece2 = Piece.objects.create(title="Magnificat", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece1, order=1)
        ProgramItem.objects.create(project=self.project, piece=self.piece2, order=2)

        # Singer sings both; gives the pitch on piece 1 only.
        ProjectPieceCasting.objects.create(
            participation=self.singer_part, piece=self.piece1,
            voice_line=VoiceLine.ALTO_1, gives_pitch=True, notes="Wejście po organach",
        )
        ProjectPieceCasting.objects.create(
            participation=self.singer_part, piece=self.piece2, voice_line=VoiceLine.ALTO_1,
        )

        # Crew with real PII that must NEVER reach a singer's sheet.
        collaborator = Collaborator.objects.create(
            first_name="Sound", last_name="Engineer",
            specialty=Collaborator.Specialty.SOUND,
            phone_number="555999555", email="crew-secret@test.pl",
        )
        CrewAssignment.objects.create(
            project=self.project, collaborator=collaborator,
            status=CrewAssignment.Status.CONFIRMED,
        )

        # Two rehearsals: one whole-ensemble, one that invites the singer only.
        self.reh_open = Rehearsal.objects.create(
            project=self.project, date_time=now + timedelta(days=1)
        )
        self.reh_singer_only = Rehearsal.objects.create(
            project=self.project, date_time=now + timedelta(days=2)
        )
        self.reh_singer_only.invited_participations.add(self.singer_part)

    def _build_context(
        self,
        audience: Audience,
        recipient: Participation | None,
        kind: DocumentKind | None = None,
    ) -> dict:
        """Context for one sheet. ``kind`` defaults to what the endpoints ship:
        management asks for the report, performers for the day card."""
        from .views import ProjectViewSet

        if kind is None:
            kind = (
                DocumentKind.PRODUCTION_REPORT
                if audience == Audience.PRODUCTION
                else DocumentKind.DAY_CARD
            )
        parts, crew, program, reh, cast = ProjectViewSet._call_sheet_querysets(self.project)
        return DocumentGenerator._build_call_sheet_context(
            project=self.project, participations=parts, crew=crew, program=program,
            rehearsals=reh, castings=cast, audience=audience, recipient=recipient,
            base_url="http://testserver/", kind=kind,
        )

    # --- access model -------------------------------------------------- #

    def test_production_export_forbidden_for_singer(self) -> None:
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_call_sheet/")
        self.assertEqual(resp.status_code, 403)

    @patch("roster.views.DocumentGenerator.generate_call_sheet_pdf")
    def test_production_export_ok_for_manager(self, render_mock) -> None:
        render_mock.return_value = b"%PDF-1.4 prod"
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_call_sheet/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        _, kwargs = render_mock.call_args
        self.assertEqual(kwargs["audience"], Audience.PRODUCTION)
        self.assertIsNone(kwargs["recipient"])

    @patch("roster.views.DocumentGenerator.generate_call_sheet_pdf")
    def test_day_sheet_personalizes_for_singer(self, render_mock) -> None:
        render_mock.return_value = b"%PDF-1.4 singer"
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_day_sheet/")
        self.assertEqual(resp.status_code, 200)
        _, kwargs = render_mock.call_args
        self.assertEqual(kwargs["audience"], Audience.CHORISTER)
        self.assertEqual(kwargs["recipient"].id, self.singer_part.id)

    @patch("roster.views.DocumentGenerator.generate_call_sheet_pdf")
    def test_day_sheet_conductor_audience_for_maestro(self, render_mock) -> None:
        render_mock.return_value = b"%PDF-1.4 cond"
        self.client.force_authenticate(user=self.maestro_user)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_day_sheet/")
        self.assertEqual(resp.status_code, 200)
        _, kwargs = render_mock.call_args
        self.assertEqual(kwargs["audience"], Audience.CONDUCTOR)
        self.assertIsNone(kwargs["recipient"])

    def test_day_sheet_forbidden_for_outsider(self) -> None:
        self.client.force_authenticate(user=self.outsider_user)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_day_sheet/")
        self.assertEqual(resp.status_code, 403)

    def test_day_sheet_refuses_a_project_the_cast_cannot_see(self) -> None:
        """Being cast in a draft is a plan the conductor is still making.

        Every other chorister-facing door reads `live_seats`; this one hand-rolled
        two of its three conditions and left out the one about the project.
        """
        self.project.status = Project.Status.DRAFT
        self.project.save(update_fields=["status"])
        self.client.force_authenticate(user=self.singer_user)

        resp = self.client.get(f"/api/projects/{self.project.id}/export_day_sheet/")

        self.assertEqual(resp.status_code, 403)

    @patch("roster.views.DocumentGenerator.generate_call_sheet_pdf")
    def test_day_sheet_returns_503_when_renderer_missing(self, render_mock) -> None:
        render_mock.side_effect = DocumentRenderDependencyError("no native libs")
        self.client.force_authenticate(user=self.singer_user)
        resp = self.client.get(f"/api/projects/{self.project.id}/export_day_sheet/")
        self.assertEqual(resp.status_code, 503)

    # --- data shape / personalization / privacy ------------------------ #

    def test_run_sheet_is_chronological(self) -> None:
        ctx = self._build_context(Audience.PRODUCTION, None)
        times = [row["time"] for row in ctx["day_timeline"] if not row["is_anchor"]]
        self.assertEqual(times, ["18:30", "19:15", "20:00"])

    def test_score_links_are_gated_never_raw_media(self) -> None:
        """The score/edition hyperlinks in the sheet must target the access-gated
        endpoints, never a bare /media/ file URL. nginx serves the score media
        prefixes `internal;`, so a raw link 404s and would also bypass watermarking
        + access logging. Mirrors the serializer convention asserted in
        MaterialsAccessControlTests."""
        from archive.models import ScoreEdition

        self.project.score_pdf = _pdf_upload()
        self.project.save(update_fields=["score_pdf"])
        ScoreEdition.objects.create(
            piece=self.piece1, pdf_file=_pdf_upload("dixit.pdf"),
            original_filename="dixit.pdf", sha256="", page_count=1, is_default=True,
        )

        ctx = self._build_context(Audience.PRODUCTION, None)

        self.assertIn(f"/api/projects/{self.project.pk}/score_pdf/", ctx["project_score_url"])
        self.assertNotIn("/media/", ctx["project_score_url"])

        card = next(c for c in ctx["program_cards"] if c["piece_id"] == self.piece1.id)
        self.assertIn("/api/materials/scores/", card["sheet_music_url"])
        self.assertNotIn("/media/", card["sheet_music_url"])

    def test_generation_stamp_present_in_rendered_sheet(self) -> None:
        """The 'as of' stamp must reach the page body (not just file metadata),
        so a reprinted sheet can be told apart from a stale copy."""
        from django.template.loader import render_to_string

        ctx = self._build_context(Audience.PRODUCTION, None)
        self.assertTrue(ctx["generation_label"])
        html = render_to_string("projects/call_sheet_pdf.html", ctx)
        self.assertIn(ctx["generation_label"], html)
        self.assertIn("Stan na", html)

    def test_singer_sheet_personalizes_and_marks_pitch(self) -> None:
        ctx = self._build_context(Audience.CHORISTER, self.singer_part)
        personal = ctx["personal"]
        self.assertIsNotNone(personal)
        self.assertEqual(personal["full_name"], "Ada Lovelace")
        self.assertTrue(personal["gives_pitch_anywhere"])
        self.assertEqual(
            [a["title"] for a in personal["assignments"]],
            ["Dixit Dominus", "Magnificat"],
        )
        self.assertIn("Bea Second", personal["section_mates"])
        card1 = next(c for c in ctx["program_cards"] if c["order"] == 1)
        self.assertIsNotNone(card1["you"])
        self.assertTrue(card1["you"]["gives_pitch"])

    def test_singer_sheet_never_leaks_crew_pii(self) -> None:
        ctx = self._build_context(Audience.CHORISTER, self.singer_part)
        blob = repr(ctx["contact_directory"])
        self.assertNotIn("555999555", blob)
        self.assertNotIn("crew-secret@test.pl", blob)
        # Only the conductor's name is surfaced — and with no private number.
        self.assertEqual(len(ctx["contact_directory"]), 1)
        self.assertEqual(ctx["contact_directory"][0]["phone"], "")

    def test_production_sheet_includes_crew_contacts(self) -> None:
        ctx = self._build_context(Audience.PRODUCTION, None)
        self.assertIn("555999555", repr(ctx["contact_directory"]))

    def test_singer_only_sees_relevant_rehearsals(self) -> None:
        ctx = self._build_context(Audience.CHORISTER, self.singer_part)
        # The whole-ensemble call and the singer-targeted one — both relevant.
        self.assertEqual(len(ctx["rehearsal_items"]), 2)

    def test_sections_reorder_per_audience(self) -> None:
        self.assertEqual(
            self._build_context(Audience.CHORISTER, self.singer_part)["sections"][0],
            "personal",
        )
        # A day card leads with the day: the masthead states the anchors, and
        # the maestro's card used to answer them four pages later, behind the
        # casting matrix.
        self.assertEqual(
            self._build_context(Audience.CONDUCTOR, None)["sections"][0], "runsheet"
        )
        # The coverage band has no heading, so it is not a section: it used to
        # sit first here and silently consume section number 1.
        production_sections = self._build_context(Audience.PRODUCTION, None)["sections"]
        self.assertEqual(production_sections[0], "event")
        self.assertNotIn("metrics", production_sections)

    def test_template_renders_for_every_audience(self) -> None:
        # Exercises the real Django template (WeasyPrint is mocked elsewhere, so
        # a template syntax error would otherwise only surface at runtime).
        from django.template.loader import render_to_string

        cases = [
            (Audience.CHORISTER, self.singer_part, "Twoja rola dzisiaj"),
            (Audience.CONDUCTOR, None, "Karta dyrygenta"),
            (Audience.PRODUCTION, None, "Raport produkcji"),
        ]
        for audience, recipient, marker in cases:
            ctx = self._build_context(audience, recipient)
            html = render_to_string("projects/call_sheet_pdf.html", ctx)
            self.assertIn(marker, html)
            self.assertIn(self.project.title, html)

        # The privacy guarantee holds in the *rendered* singer document, too.
        singer_html = render_to_string(
            "projects/call_sheet_pdf.html",
            self._build_context(Audience.CHORISTER, self.singer_part),
        )
        self.assertNotIn("555999555", singer_html)
        self.assertNotIn("crew-secret@test.pl", singer_html)
        self.assertIn("podajesz", singer_html)

    # --- the sheet may not state things that are not true ---------------- #

    def _render(
        self,
        audience: Audience,
        recipient: Participation | None,
        kind: DocumentKind | None = None,
    ) -> str:
        from django.template.loader import render_to_string

        return render_to_string(
            "projects/call_sheet_pdf.html",
            self._build_context(audience, recipient, kind),
        )

    def _move_call_off_the_concert_day(self) -> None:
        self.project.call_time = self.project.date_time - timedelta(days=20)
        self.project.save(update_fields=["call_time"])

    def test_section_numbering_starts_at_one_for_every_audience(self) -> None:
        """The printed numbers come from the loop counter, so a listed-but-unrendered
        section leaves a gap. The production sheet used to open at '2'."""
        import re

        for audience, recipient in [
            (Audience.PRODUCTION, None),
            (Audience.CONDUCTOR, None),
            (Audience.CHORISTER, self.singer_part),
        ]:
            numbers = re.findall(
                r'<span class="num">(\d+)</span>', self._render(audience, recipient)
            )
            self.assertEqual(
                numbers,
                [str(n) for n in range(1, len(numbers) + 1)],
                f"{audience} numbering is not 1..n",
            )

    def test_call_time_on_another_day_carries_its_date(self) -> None:
        """A bare hour reads as concert-day; acting on it means arriving on the
        wrong date."""
        import zoneinfo

        self._move_call_off_the_concert_day()
        ctx = self._build_context(Audience.PRODUCTION, None)

        call_time = self.project.call_time
        assert call_time is not None
        call_cell = next(
            fact for fact in ctx["masthead_facts"] if fact["label"] == "Zbiórka"
        )
        self.assertEqual(call_cell["note"], "inny dzień")
        self.assertIn(
            call_time.astimezone(zoneinfo.ZoneInfo("Europe/Warsaw")).strftime("%d.%m"),
            call_cell["value"],
        )

    def test_implausible_call_window_is_reported_not_stated(self) -> None:
        """A call entered on the wrong date used to print as '481 h 00 min
        między zbiórką a startem' — arithmetic presented as a plan."""
        self._move_call_off_the_concert_day()

        production = self._build_context(Audience.PRODUCTION, None)
        self.assertEqual(production["call_buffer_label"], "")
        self.assertIn("dobę", production["call_window_warning"])
        self.assertNotIn("480 h", self._render(Audience.PRODUCTION, None))

        # The singer can do nothing about a data-entry fault and is not alarmed
        # by one; they simply never see a derived figure that would be wrong.
        singer = self._build_context(Audience.CHORISTER, self.singer_part)
        self.assertEqual(singer["call_buffer_label"], "")
        self.assertEqual(singer["call_window_warning"], "")

    def test_plausible_call_window_is_still_stated(self) -> None:
        ctx = self._build_context(Audience.PRODUCTION, None)
        self.assertEqual(ctx["call_buffer_label"], "1 h 00 min")
        self.assertEqual(ctx["call_window_warning"], "")

    def test_conductor_is_never_counted_as_cast(self) -> None:
        """The podium is `Project.conductor`; a maestro who also holds a
        Participation used to appear on his own sheet under 'oczekujące
        potwierdzenia' and to inflate the cast census."""
        Participation.objects.create(
            artist=self.maestro,
            project=self.project,
            status=Participation.Status.INVITED,
        )
        ctx = self._build_context(Audience.CONDUCTOR, None)

        self.assertEqual(ctx["metrics"]["cast_pending"], 0)
        self.assertEqual(ctx["metrics"]["cast_confirmed"], 2)
        labels = [
            section["label"]
            for section in ctx["ensemble_sections"] + ctx["pending_sections"]
        ]
        self.assertNotIn("Dyrygent", labels)

    def test_reference_links_name_the_performer_and_are_capped(self) -> None:
        """Five recordings from one platform used to print as five identical
        'Spotify' buttons."""
        from archive.models import Recording, RecordingSource

        for index in range(5):
            Recording.objects.create(
                piece=self.piece1,
                source=RecordingSource.SPOTIFY,
                external_id=f"ext-{index}",
                url=f"https://open.spotify.com/track/{index}",
                performer=f"Ensemble {index}",
                year=2000 + index,
            )

        card = next(
            c
            for c in self._build_context(Audience.PRODUCTION, None)["program_cards"]
            if c["piece_id"] == self.piece1.id
        )
        labels = [link["label"] for link in card["reference_links"]]

        self.assertLessEqual(len(labels), 2)
        self.assertEqual(len(labels), len(set(labels)))
        self.assertNotIn("Spotify", labels)
        # The badge row no longer repeats what the links below it already say.
        self.assertNotIn("Nagranie referencyjne", card["material_badges"])
        self.assertNotIn("Nuty PDF", card["material_badges"])

    def _requirements_summary(self) -> str:
        card = next(
            c
            for c in self._build_context(Audience.PRODUCTION, None)["program_cards"]
            if c["piece_id"] == self.piece1.id
        )
        return card["voice_requirements_summary"]

    def test_voice_requirements_read_in_satb_order(self) -> None:
        """Voice lines are stored as codes, so ordering them in the database
        sorts Alt before Bas before Sopran.

        Undivided families also drop their index: a plain SATB setting has no
        "Sopran 2" anywhere, so calling its top line "Sopran 1" promises a
        division the score never wrote."""
        from archive.models import PieceVoiceRequirement
        from core.constants import VoiceLine

        for line in (
            VoiceLine.BASS_1,
            VoiceLine.SOPRANO_1,
            VoiceLine.TENOR_1,
            VoiceLine.ALTO_1,
        ):
            PieceVoiceRequirement.objects.create(
                piece=self.piece1, voice_line=line, quantity=2
            )

        self.assertEqual(
            self._requirements_summary(),
            "2x Sopran, 2x Alt, 2x Tenor, 2x Bas",
        )

    def test_a_divided_family_keeps_its_index(self) -> None:
        """The moment a family really is divided, every one of its lines is
        numbered again — including the siblings that stay undivided."""
        from archive.models import PieceVoiceRequirement
        from core.constants import VoiceLine

        for line in (
            VoiceLine.SOPRANO_1,
            VoiceLine.SOPRANO_2,
            VoiceLine.TENOR_1,
        ):
            PieceVoiceRequirement.objects.create(
                piece=self.piece1, voice_line=line, quantity=2
            )

        self.assertEqual(
            self._requirements_summary(),
            "2x Sopran 1, 2x Sopran 2, 2x Tenor",
        )

    def test_program_metaline_never_opens_on_a_separator(self) -> None:
        self.piece1.language = "la-pl"
        self.piece1.save(update_fields=["language"])

        card = next(
            c
            for c in self._build_context(Audience.PRODUCTION, None)["program_cards"]
            if c["piece_id"] == self.piece1.id
        )
        self.assertFalse(card["meta_line"].startswith("·"))
        self.assertEqual(card["meta_line"], "łacina / polski")

    def test_run_sheet_sorts_on_the_clock_and_reads_legacy_rows(self) -> None:
        """`run_sheet` is an unvalidated JSON field: lexically '9:00' follows
        '12:00', and rows written with the original `label` key printed as the
        fallback placeholder. The stored hour is canonicalised on the way out so
        the printed time gutter lines up with the anchors beside it."""
        self.project.run_sheet = [
            {"time": "12:00", "title": "Próba akustyczna"},
            {"time": "9:00", "label": "Otwarcie kościoła"},
        ]
        self.project.save(update_fields=["run_sheet"])

        rows = [
            row
            for row in self._build_context(Audience.PRODUCTION, None)["day_timeline"]
            if not row["is_anchor"]
        ]
        self.assertEqual([row["time"] for row in rows], ["09:00", "12:00"])
        self.assertEqual(rows[0]["title"], "Otwarcie kościoła")

    # --- the day as one axis (Etap 3) ---------------------------------- #

    def _pin_concert_day(self, call_hour: int = 18, call_minute: int = 30) -> None:
        """A fixed 13.07.2026 concert at 20:00 Warsaw, so the run sheet's own
        hours (18:30 / 19:15 / 20:00) sit in a known relation to the anchors."""
        import zoneinfo

        warsaw = zoneinfo.ZoneInfo("Europe/Warsaw")
        self.project.date_time = datetime(2026, 7, 13, 20, 0, tzinfo=warsaw)
        self.project.call_time = datetime(
            2026, 7, 13, call_hour, call_minute, tzinfo=warsaw
        )
        self.project.save(update_fields=["date_time", "call_time"])

    def test_printed_day_merges_the_anchors_into_the_run_sheet(self) -> None:
        """The sheet used to print the raw run sheet under a masthead built from
        the project's datetimes, so the two could disagree — and did. One axis
        cannot: the call and the downbeat are placed among the points."""
        self._pin_concert_day()
        rows = self._build_context(Audience.PRODUCTION, None)["day_timeline"]

        self.assertEqual(
            [(row["time"], row["title"]) for row in rows],
            [
                ("18:30", "Zbiórka"),
                ("18:30", "Call & warm-up"),
                ("19:15", "Sound check"),
                ("20:00", "Downbeat"),
                ("20:00", "Początek koncertu"),
            ],
        )
        # A point sharing an anchor's minute belongs inside the day the anchors
        # bracket — after the call, before the downbeat.
        self.assertEqual([row["is_anchor"] for row in rows], [True, False, False, False, True])
        self.assertIn("Początek koncertu", self._render(Audience.PRODUCTION, None))

    def test_day_card_masthead_closes_the_day_from_the_timeline(self) -> None:
        """The fourth cell is the last planned moment, taken from the merged
        axis; the report keeps the venue there, because its reader is at a desk
        with the address in front of them."""
        self._pin_concert_day()
        self.project.run_sheet = [
            *self.project.run_sheet,
            {"time": "22:15", "title": "Wyjście z kościoła"},
        ]
        self.project.save(update_fields=["run_sheet"])

        day = self._build_context(Audience.CHORISTER, self.singer_part)
        labels = [fact["label"] for fact in day["masthead_facts"]]
        self.assertEqual(labels, ["Data", "Zbiórka", "Początek koncertu", "Koniec planu"])
        self.assertEqual(day["masthead_facts"][-1]["value"], "22:15")
        # The venue leaves the band and becomes the line under it, in full.
        self.assertTrue(day["venue_line"])

        report = self._build_context(Audience.PRODUCTION, None)
        self.assertEqual(report["masthead_facts"][-1]["label"], "Miejsce")
        self.assertEqual(report["venue_line"], "")

    def test_day_card_states_no_end_it_cannot_derive(self) -> None:
        """Nothing is planned after the downbeat, and the end of a concert is
        stored nowhere — a cell derived from summed piece durations would be a
        fabricated hour printed as a fact."""
        self._pin_concert_day()
        day = self._build_context(Audience.CHORISTER, self.singer_part)
        self.assertEqual(
            [fact["label"] for fact in day["masthead_facts"]],
            ["Data", "Zbiórka", "Początek koncertu"],
        )

    def test_call_on_another_day_is_marked_inside_the_printed_day(self) -> None:
        """The anchor moves to where it actually falls and says how far — an
        hour on its own reads as concert-day wherever it appears."""
        self._pin_concert_day()
        self._move_call_off_the_concert_day()
        rows = self._build_context(Audience.PRODUCTION, None)["day_timeline"]

        self.assertEqual(rows[0]["title"], "Zbiórka")
        self.assertEqual(rows[0]["day_note"], "20 dni wcześniej")

    def test_report_asks_to_confirm_a_call_on_another_calendar_day(self) -> None:
        """Inside the plausible window a different day is legitimate (the tour
        case the ceiling exists to permit) and is also what an off-by-one date
        looks like from below the threshold. The report asks; the day card just
        prints the date."""
        import zoneinfo

        warsaw = zoneinfo.ZoneInfo("Europe/Warsaw")
        self.project.date_time = datetime(2026, 7, 13, 11, 0, tzinfo=warsaw)
        self.project.call_time = datetime(2026, 7, 12, 19, 0, tzinfo=warsaw)
        self.project.save(update_fields=["date_time", "call_time"])

        report = self._build_context(Audience.PRODUCTION, None)
        self.assertEqual(report["call_window_warning"], "")
        self.assertIn(
            "Zbiórka wypada w innym dniu niż koncert",
            [blocker["text"] for blocker in report["blockers"]],
        )

    def test_singer_sheet_carries_someone_to_call(self) -> None:
        """The chorister branch of the contact directory was built and never
        rendered — the sheet had nobody to call on it."""
        ctx = self._build_context(Audience.CHORISTER, self.singer_part)
        self.assertIn("contacts", ctx["sections"])

        html = self._render(Audience.CHORISTER, self.singer_part)
        self.assertIn("Wanda Baton", html)
        # ...without reopening the privacy hole the directory exists to avoid.
        self.assertNotIn("555999555", html)
        self.assertNotIn("crew-secret@test.pl", html)
        self.assertNotIn("600100100", html)

    def test_typed_day_moments_join_the_one_axis(self) -> None:
        """Warm-up and sound check are moments of the same day, so they are
        placed among the run-sheet points rather than opening a second list of
        hours — and they carry no wording of their own, which is why they can
        print in the reader's language where a typed title cannot."""
        self._pin_concert_day()
        self.project.warmup_start = time(18, 40)
        self.project.warmup_end = time(19, 0)
        self.project.soundcheck_start = time(19, 20)
        self.project.save(
            update_fields=["warmup_start", "warmup_end", "soundcheck_start"]
        )

        rows = self._build_context(Audience.CHORISTER, self.singer_part)["day_timeline"]
        self.assertEqual(
            [(row["time"], row["title"]) for row in rows],
            [
                ("18:30", "Zbiórka"),
                ("18:30", "Call & warm-up"),
                ("18:40", "Rozśpiewanie"),
                ("19:15", "Sound check"),
                ("19:20", "Próba akustyczna"),
                ("20:00", "Downbeat"),
                ("20:00", "Początek koncertu"),
            ],
        )
        # An open window is normal — the sound check ends when it ends — so the
        # closing hour qualifies the moment instead of becoming a second row.
        self.assertEqual(rows[2]["description"], "do 19:00")
        self.assertEqual(rows[4]["description"], "")
        # The free-text "Sound check" someone typed is NOT deduplicated against
        # the typed moment: when they agree the repetition costs nothing, and
        # when they disagree the repetition is the finding.
        self.assertEqual(sum(1 for row in rows if "check" in row["title"].lower()), 1)

    def test_typed_moments_alone_are_a_planned_day(self) -> None:
        """A producer who set only the two windows has planned a day; the
        section must not fall back to "nothing here, go by the masthead"."""
        self._pin_concert_day()
        self.project.run_sheet = []
        self.project.soundcheck_start = time(19, 20)
        self.project.save(update_fields=["run_sheet", "soundcheck_start"])

        self.assertTrue(
            self._build_context(Audience.CHORISTER, self.singer_part)["has_run_sheet"]
        )
        self.assertNotIn(
            "Szczegółowy przebieg dnia",
            self._render(Audience.PRODUCTION, None),
        )

    def test_on_site_card_lists_only_what_was_recorded(self) -> None:
        """Where exactly, once the reader has found the address. A card whose
        whole content is the absence of three facts asks its reader to fix data
        they cannot reach — the report names the gap in its blockers instead."""
        self.assertEqual(
            self._build_context(Audience.CHORISTER, self.singer_part)["onsite_facts"],
            [],
        )

        self.project.entrance_note = "Wejście boczne od Rakowieckiej, brama nr 2"
        self.project.dressing_room_note = "Sala pod wieżą"
        self.project.save(update_fields=["entrance_note", "dressing_room_note"])

        facts = self._build_context(Audience.CHORISTER, self.singer_part)["onsite_facts"]
        self.assertEqual([fact["label"] for fact in facts], ["Wejście", "Garderoba"])
        self.assertIn("brama nr 2", self._render(Audience.CHORISTER, self.singer_part))

    def test_on_site_number_reaches_the_singer_and_the_crew_number_still_does_not(
        self,
    ) -> None:
        """The one contact a forty-voice choir may be handed: typed for this
        concert by the producer, not read off somebody's profile."""
        self.project.onsite_contact_name = "Anna Nowak"
        self.project.onsite_contact_phone = "+48 600 000 000"
        self.project.save(
            update_fields=["onsite_contact_name", "onsite_contact_phone"]
        )

        directory = self._build_context(Audience.CHORISTER, self.singer_part)[
            "contact_directory"
        ]
        self.assertEqual(directory[0]["name"], "Anna Nowak")
        self.assertEqual(directory[0]["phone"], "+48 600 000 000")

        html = self._render(Audience.CHORISTER, self.singer_part)
        self.assertIn("+48 600 000 000", html)
        self.assertNotIn("555999555", html)
        self.assertNotIn("600100100", html)

    def test_report_names_a_missing_on_site_number(self) -> None:
        """The worst thing a call sheet can do is abandon its reader."""
        blockers = [
            blocker["text"]
            for blocker in self._build_context(Audience.PRODUCTION, None)["blockers"]
        ]
        self.assertIn("Brak telefonu na miejscu", blockers)

        self.project.onsite_contact_phone = "+48 600 000 000"
        self.project.save(update_fields=["onsite_contact_phone"])
        blockers = [
            blocker["text"]
            for blocker in self._build_context(Audience.PRODUCTION, None)["blockers"]
        ]
        self.assertNotIn("Brak telefonu na miejscu", blockers)

    def test_performer_sheets_list_no_absent_resources(self) -> None:
        """"Playlista referencyjna — Brak" tells the one reader who can do
        nothing about it that something is missing."""
        self.assertEqual(
            self._build_context(Audience.CHORISTER, self.singer_part)["preparation_assets"],
            [],
        )
        # Management still gets the full coverage picture.
        self.assertTrue(
            self._build_context(Audience.PRODUCTION, None)["preparation_assets"]
        )

    def test_performer_sheets_drop_rehearsals_that_already_happened(self) -> None:
        self.reh_open.date_time = timezone.now() - timedelta(days=3)
        self.reh_open.save(update_fields=["date_time"])

        singer = self._build_context(Audience.CHORISTER, self.singer_part)
        self.assertEqual(len(singer["rehearsal_items"]), 1)
        self.assertEqual(singer["rehearsals_done"], 1)

        # The management sheet is a record and keeps them.
        self.assertEqual(
            len(self._build_context(Audience.PRODUCTION, None)["rehearsal_items"]), 2
        )

    def test_zero_crew_is_not_reported_as_confirmed_support(self) -> None:
        from .models import CrewAssignment

        CrewAssignment.objects.filter(project=self.project).delete()
        html = self._render(Audience.PRODUCTION, None)
        self.assertIn("Brak obsady technicznej", html)
        self.assertNotIn("Wsparcie potwierdzone", html)

    def test_overnight_tour_call_is_not_flagged_as_a_data_error(self) -> None:
        """An evening call for a late-morning concert is ordinary on tour, and
        `crosses_day` exists to print it correctly. A ceiling tight enough to
        flag it would contradict that; the ceiling is a full day."""
        self.project.date_time = self.project.date_time.replace(hour=9, minute=0)
        self.project.call_time = self.project.date_time - timedelta(hours=15)
        self.project.save(update_fields=["date_time", "call_time"])

        ctx = self._build_context(Audience.PRODUCTION, None)
        call_cell = next(
            fact for fact in ctx["masthead_facts"] if fact["label"] == "Zbiórka"
        )
        self.assertEqual(call_cell["note"], "inny dzień")
        self.assertEqual(ctx["call_window_warning"], "")
        self.assertEqual(ctx["call_buffer_label"], "15 h 00 min")

    # --- the split: one day, one report ---------------------------------- #

    def test_day_card_carries_no_report_content(self) -> None:
        """Coverage counters, the invitation queue and past rehearsals are the
        report's job. A day card that carries them makes its reader wade through
        a status report to find an arrival time."""
        Participation.objects.create(
            artist=Artist.objects.create(
                first_name="Cee", last_name="Pending", email="ds-pend@test.pl",
                voice_type=VoiceType.SOPRANO,
            ),
            project=self.project,
            status=Participation.Status.INVITED,
        )
        self.reh_open.date_time = timezone.now() - timedelta(days=3)
        self.reh_open.save(update_fields=["date_time"])

        for audience, recipient in (
            (Audience.CHORISTER, self.singer_part),
            (Audience.CONDUCTOR, None),
            (Audience.PRODUCTION, None),
        ):
            ctx = self._build_context(audience, recipient, DocumentKind.DAY_CARD)
            html = self._render(audience, recipient, DocumentKind.DAY_CARD)
            self.assertEqual(ctx["pending_sections"], [], audience)
            self.assertEqual(ctx["blockers"], [], audience)
            self.assertNotIn("Oczekujące potwierdzenia", html, audience)
            self.assertNotIn("Gotowość materiałów", html, audience)
            self.assertNotIn("Do zamknięcia", html, audience)
            # Only what is still ahead.
            self.assertTrue(all(not item["is_past"] for item in ctx["rehearsal_items"]))

    def test_report_opens_on_what_is_not_closed(self) -> None:
        """A status report exists to produce a blocker list; the audited sheet
        opened on four counters and never said what was missing."""
        Participation.objects.create(
            artist=Artist.objects.create(
                first_name="Cee", last_name="Pending", email="ds-pend@test.pl",
                voice_type=VoiceType.SOPRANO,
            ),
            project=self.project,
            status=Participation.Status.INVITED,
        )
        ctx = self._build_context(Audience.PRODUCTION, None)
        html = self._render(Audience.PRODUCTION, None)

        self.assertIn("Do zamknięcia", html)
        texts = " · ".join(b["text"] for b in ctx["blockers"])
        details = " · ".join(b["detail"] for b in ctx["blockers"])
        # The gap, and then whose it is — a count alone is not actionable.
        self.assertIn("1 zaproszenie bez odpowiedzi", texts)
        self.assertIn("Cee Pending", details)
        self.assertIn("utwory bez nut", texts)
        # The blocker list precedes the coverage band it replaces as an opener.
        self.assertLess(html.index("Do zamknięcia"), html.index("Pokrycie materiałów"))

    def test_coverage_is_one_grid_over_one_denominator(self) -> None:
        """Four counters over four denominators, standing in a row of equal
        boxes, were a matrix pretending to be tiles: the reader had to subtract
        them to find what was missing. Every column is now the same question
        over the programme, and an absent material is an empty cell."""
        coverage = self._build_context(Audience.PRODUCTION, None)["coverage"]
        assert coverage is not None

        self.assertEqual(coverage["labels"], ["Nuty", "Tracki", "Nagranie", "Casting"])
        self.assertEqual(coverage["total"], len(coverage["rows"]))
        self.assertTrue(
            all(len(row["cells"]) == len(coverage["labels"]) for row in coverage["rows"])
        )
        # A total is the column counted over the same rows the grid printed —
        # not a second census with its own idea of the denominator.
        self.assertEqual(
            coverage["totals"],
            [
                sum(1 for row in coverage["rows"] if row["cells"][index])
                for index in range(len(coverage["labels"]))
            ],
        )
        # It is the report's instrument; a day card never carries coverage.
        self.assertIsNone(
            self._build_context(Audience.CHORISTER, self.singer_part)["coverage"]
        )

    def test_printed_resources_are_named_never_drawn_as_buttons(self) -> None:
        """A rounded link-button is invisible on paper and an 8pt tap target on
        a phone. The resource is named, and a QR appears only where the target
        opens without a session — never on the login-gated score."""
        self.project.spotify_playlist_url = "https://open.spotify.com/playlist/test"
        self.project.save(update_fields=["spotify_playlist_url"])

        assets = {
            asset["label"]: asset
            for asset in self._build_context(Audience.PRODUCTION, None)["preparation_assets"]
        }
        self.assertTrue(assets["Playlista referencyjna"]["qr"].startswith("data:image/svg+xml"))
        self.assertEqual(assets["Pełny score projektu"]["qr"], "")

        html = self._render(Audience.PRODUCTION, None)
        self.assertNotIn('class="btn', html)

    def test_report_blocker_list_reports_a_broken_call_window(self) -> None:
        self._move_call_off_the_concert_day()
        texts = " · ".join(
            b["text"] for b in self._build_context(Audience.PRODUCTION, None)["blockers"]
        )
        self.assertIn("20 dni przed koncertem", texts)

    def test_a_singer_never_receives_a_report(self) -> None:
        """The report carries the invitation queue and the crew's private
        numbers. Asking for one on a singer's behalf must degrade to the day
        card — not just trim its section list."""
        ctx = self._build_context(
            Audience.CHORISTER, self.singer_part, DocumentKind.PRODUCTION_REPORT
        )
        self.assertEqual(ctx["kind"], DocumentKind.DAY_CARD.value)
        self.assertFalse(ctx["is_report"])
        self.assertEqual(ctx["blockers"], [])

        html = self._render(
            Audience.CHORISTER, self.singer_part, DocumentKind.PRODUCTION_REPORT
        )
        self.assertNotIn("555999555", html)
        self.assertNotIn("crew-secret@test.pl", html)

    def test_the_report_has_exactly_one_audience(self) -> None:
        """A conductor's report was configured for a stage that never gave it an
        endpoint, and unexercised configuration outlives the reason it was
        written. Asking for one degrades to the card he can actually request."""
        ctx = self._build_context(
            Audience.CONDUCTOR, None, DocumentKind.PRODUCTION_REPORT
        )
        self.assertEqual(ctx["kind"], DocumentKind.DAY_CARD.value)
        self.assertFalse(ctx["is_report"])
        self.assertEqual(ctx["blockers"], [])

    def test_duplicate_roster_name_is_flagged_only_where_it_can_be_merged(self) -> None:
        """Two roster rows under one name are two Artist records for one human.
        The report says so; the day card prints the name plainly, because its
        reader cannot merge a kartoteka and — if they really are two people —
        the repetition is the truth."""
        twin = Artist.objects.create(
            first_name="Ada", last_name="Lovelace", email="ds-twin@test.pl",
            voice_type=VoiceType.ALTO,
        )
        Participation.objects.create(
            artist=twin, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

        report = self._build_context(Audience.PRODUCTION, None)
        alto = next(s for s in report["ensemble_sections"] if s["label"] == "Alt")
        self.assertIn("Ada Lovelace (2 wpisy)", alto["members"])
        self.assertIn(
            "nazwisko występuje", " · ".join(b["text"] for b in report["blockers"])
        )

        day = self._build_context(Audience.CHORISTER, self.singer_part)
        day_alto = next(s for s in day["ensemble_sections"] if s["label"] == "Alt")
        self.assertEqual(day_alto["members"].count("Ada Lovelace"), 2)
        self.assertNotIn("Ada Lovelace (2 wpisy)", day_alto["members"])

    def test_day_sheet_endpoint_serves_the_production_day_card_to_managers(self) -> None:
        """The stage manager runs the day from the day card, not the report."""
        self.client.force_authenticate(user=self.manager)
        with patch(
            "roster.views.DocumentGenerator.generate_call_sheet_pdf", return_value=b"%PDF-"
        ) as render_mock:
            resp = self.client.get(
                f"/api/projects/{self.project.id}/export_day_sheet/?audience=production"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(render_mock.call_args.kwargs["kind"], DocumentKind.DAY_CARD)
        self.assertEqual(render_mock.call_args.kwargs["audience"], Audience.PRODUCTION)

    def test_day_sheet_production_shape_is_refused_to_a_singer(self) -> None:
        """The query parameter is a manager's shortcut, not a way around the
        audience resolver: a singer asking for it still gets their own sheet."""
        self.client.force_authenticate(user=self.singer_user)
        with patch(
            "roster.views.DocumentGenerator.generate_call_sheet_pdf", return_value=b"%PDF-"
        ) as render_mock:
            resp = self.client.get(
                f"/api/projects/{self.project.id}/export_day_sheet/?audience=production"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(render_mock.call_args.kwargs["audience"], Audience.CHORISTER)

    def test_resolve_audience_maps_users(self) -> None:
        from .views import ProjectViewSet

        aud, rec = ProjectViewSet._resolve_day_sheet_audience(self.project, self.singer_user)
        self.assertEqual(aud, Audience.CHORISTER)
        assert rec is not None
        self.assertEqual(rec.id, self.singer_part.id)

        aud, rec = ProjectViewSet._resolve_day_sheet_audience(self.project, self.maestro_user)
        self.assertEqual(aud, Audience.CONDUCTOR)
        self.assertIsNone(rec)

        aud, rec = ProjectViewSet._resolve_day_sheet_audience(self.project, self.outsider_user)
        self.assertIsNone(aud)
        self.assertIsNone(rec)

    # --- i18n (Etap 5) --------------------------------------------------- #

    def _render_through_generator(
        self,
        audience: Audience,
        recipient: Participation | None,
        kind: DocumentKind,
        requester_language: str | None = None,
    ) -> str:
        """The HTML the generator actually hands WeasyPrint.

        Rendering through ``_build_call_sheet_context`` (as every test above
        does) skips the language override, which is the thing under test here —
        so this goes through the public entry point and intercepts the bytes.
        """
        from .views import ProjectViewSet

        parts, crew, program, reh, cast = ProjectViewSet._call_sheet_querysets(self.project)
        captured: dict[str, str] = {}

        def capture(html_string: str, base_url: str | None = None) -> bytes:
            captured["html"] = html_string
            return b"%PDF-"

        with patch(
            "roster.infrastructure.document_generator._render_pdf", side_effect=capture
        ):
            DocumentGenerator.generate_call_sheet_pdf(
                self.project, parts, crew, program, reh, cast,
                audience=audience, recipient=recipient,
                base_url="http://testserver/", kind=kind,
                requester_language=requester_language,
            )
        return captured["html"]

    def test_document_language_is_the_readers_not_the_servers(self) -> None:
        """The ensemble's own conductor is francophone. Before Etap 5 the sheet
        read `SCORE_BOOK_LANG`, so his card could only be French by making every
        singer's card French too."""
        from .infrastructure.document_generator import resolve_document_language

        self.maestro_user.profile.language = "fr"
        self.maestro_user.profile.save(update_fields=["language"])
        self.singer_user.profile.language = "en"
        self.singer_user.profile.save(update_fields=["language"])

        self.assertEqual(
            resolve_document_language(self.project, Audience.CONDUCTOR, None), "fr"
        )
        self.assertEqual(
            resolve_document_language(self.project, Audience.CHORISTER, self.singer_part),
            "en",
        )
        # No named reader: the sheet follows whoever asked for the export.
        self.assertEqual(
            resolve_document_language(
                self.project, Audience.PRODUCTION, None, requester_language="fr"
            ),
            "fr",
        )
        # And falls back to the site language rather than to nothing.
        self.assertEqual(
            resolve_document_language(self.project, Audience.PRODUCTION, None),
            settings.LANGUAGE_CODE,
        )
        # A regional tag is still its base language, not a reason to give up.
        self.assertEqual(
            resolve_document_language(
                self.project, Audience.PRODUCTION, None, requester_language="fr-CA"
            ),
            "fr",
        )

    def test_the_maestros_card_is_rendered_in_his_language(self) -> None:
        """End to end through the generator: the override has to wrap the
        context build too, since most of the wording is composed in Python."""
        self.maestro_user.profile.language = "fr"
        self.maestro_user.profile.save(update_fields=["language"])

        html = self._render_through_generator(
            Audience.CONDUCTOR, None, DocumentKind.DAY_CARD
        )
        self.assertIn('lang="fr"', html)
        self.assertIn("Feuille du chef", html)
        self.assertIn("Convocation", html)
        self.assertIn("Déroulé de la journée", html)
        # Composed in Python, so it only lands in French if the override wraps
        # the context build and not merely the template render.
        self.assertIn("Début du concert", html)
        self.assertNotIn("Przebieg dnia", html)
        self.assertNotIn("Zbiórka", html)

    def test_the_singers_card_is_rendered_in_her_language(self) -> None:
        self.singer_user.profile.language = "fr"
        self.singer_user.profile.save(update_fields=["language"])

        html = self._render_through_generator(
            Audience.CHORISTER, self.singer_part, DocumentKind.DAY_CARD
        )
        self.assertIn('lang="fr"', html)
        self.assertIn("Feuille du choriste", html)
        self.assertIn("Votre rôle", html)
        self.assertNotIn("Twoja rola dzisiaj", html)
        # The vocative is a Polish case, not a name: a French sentence takes the
        # nominative, and the one rule that knows lives in `core.greetings`.
        self.assertIn("Préparé pour vous", html)

    def test_a_polish_reader_still_gets_the_polish_sheet(self) -> None:
        """The catalogs carry the wording the sheet printed before Etap 5, so
        the default render is unchanged rather than newly English."""
        html = self._render_through_generator(
            Audience.PRODUCTION, None, DocumentKind.PRODUCTION_REPORT
        )
        self.assertIn('lang="pl"', html)
        for polish in (
            "Raport produkcji",
            "Do zamknięcia",
            "Pokrycie materiałów",
            "Przebieg dnia",
            "Obsada i podawanie dźwięku",
            "Kontakty",
        ):
            self.assertIn(polish, html)
        # A missing catalog entry surfaces as the English msgid on the page.
        for english in ("Production report", "To close", "Material coverage"):
            self.assertNotIn(english, html)

    def test_polish_numerals_take_all_three_forms(self) -> None:
        """Polish inflects a noun after a numeral three ways, and gettext only
        knows that from the pl catalog: an ngettext whose pl entry is missing
        falls back to the msgid's own two-form English rule and silently prints
        "5 utwory". This walks every plural the generator actually calls, so a
        new one cannot be added without its three forms."""
        import ast
        import inspect

        from django.utils.translation import ngettext

        from .infrastructure import document_generator

        source = inspect.getsource(document_generator)
        pairs: list[tuple[str, str]] = []
        for node in ast.walk(ast.parse(source)):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name != "ngettext" or len(node.args) < 2:
                continue
            singular_arg, plural_arg = node.args[0], node.args[1]
            if not (
                isinstance(singular_arg, ast.Constant)
                and isinstance(plural_arg, ast.Constant)
            ):
                continue
            singular, plural = singular_arg.value, plural_arg.value
            if isinstance(singular, str) and isinstance(plural, str):
                pairs.append((singular, plural))

        self.assertGreater(len(pairs), 10, "the ngettext scan found almost nothing")
        with translation.override("pl"):
            for one, many in pairs:
                forms = {n: ngettext(one, many, n) for n in (1, 2, 5, 12, 22)}
                self.assertNotEqual(
                    forms[1], one,
                    f"{one!r} falls back to the English msgid at n=1 — no pl entry",
                )
                self.assertNotEqual(
                    forms[5], many,
                    f"{one!r} falls back to the English msgid at n=5 — no pl entry",
                )
                # And the three buckets are the Polish ones, not the English
                # two: 22 ends in 2 and takes the "few" form, while 12 looks
                # like it should and does not.
                self.assertEqual(forms[22], forms[2], f"{one!r}: n=22 is not 'few'")
                self.assertEqual(forms[12], forms[5], f"{one!r}: n=12 is not 'many'")

    def test_msgids_built_from_a_dict_are_in_the_catalog(self) -> None:
        """`_LANGUAGE_NAMES` and `_COVERAGE_COLUMNS` reach gettext through a
        variable, so no source scanner (`makemessages` included) can see them.
        Nothing but this test stands between them and an English word printed
        mid-sentence on a Polish sheet."""
        from django.utils.translation import pgettext

        from .infrastructure.document_generator import (
            _COVERAGE_COLUMNS,
            _LANGUAGE_NAMES,
        )

        # Spelled out rather than derived: "Casting" is a loanword and its
        # Polish is itself, so "translated differs from the msgid" cannot be the
        # test. A new column added without its catalog entry fails on the
        # lookup below, which is the same failure with a clearer message.
        expected_columns = {
            "Score": "Nuty",
            "Tracks": "Tracki",
            "Recording": "Nagranie",
            "Casting": "Casting",
        }
        with translation.override("pl"):
            for msgid in _LANGUAGE_NAMES.values():
                self.assertNotEqual(
                    pgettext("sung language", msgid), msgid,
                    f"sung language {msgid!r} has no pl entry",
                )
            for _key, msgid in _COVERAGE_COLUMNS:
                self.assertEqual(
                    pgettext("coverage column", msgid), expected_columns[msgid],
                    f"coverage column {msgid!r} has no pl entry",
                )

    def test_the_sung_language_context_keeps_the_metaline_lower_case(self) -> None:
        """The panel already translates "Polish" — as a capitalised label. In a
        piece's metaline that reads as a heading, which is why these msgids
        carry their own context rather than reusing that entry."""
        from .infrastructure.document_generator import DocumentGenerator

        with translation.override("pl"):
            self.assertEqual(
                DocumentGenerator._format_language("la-pl"), "łacina / polski"
            )
        with translation.override("fr"):
            self.assertEqual(
                DocumentGenerator._format_language("la-pl"), "latin / polonais"
            )


class DayTimelineContractTests(SimpleTestCase):
    """The printed day and the edited day must be the same day.

    The concert day is merged twice — here for the PDF, and in
    ``frontend/src/features/projects/lib/dayTimeline.ts`` for the live editor,
    which cannot call this one because it orders a list the user is still typing
    into. Both suites replay ``day_timeline_cases.json``, so the two can only
    drift apart through a red test on one side or the other.

    The fixture is narrower than either implementation on purpose: its points
    are ALREADY sorted and its times are zero-padded, because that is all the
    merge itself promises. Ordering stored rows belongs to
    :func:`normalize_run_sheet` (asserted separately, in the document suite);
    the editor sorts on commit instead, so that a half-typed time cannot yank
    the row under the cursor to the top of the day.
    """

    @staticmethod
    def _load_cases() -> list[dict]:
        import json
        from pathlib import Path

        fixture = (
            Path(__file__).resolve().parent / "domain" / "day_timeline_cases.json"
        )
        return json.loads(fixture.read_text(encoding="utf-8"))["cases"]

    @staticmethod
    def _to_datetime(value: str | None):
        import zoneinfo

        if not value:
            return None
        return datetime.fromisoformat(value).replace(
            tzinfo=zoneinfo.ZoneInfo("Europe/Warsaw")
        )

    def test_merge_matches_the_shared_fixture(self) -> None:
        from .domain.day_timeline import (
            RunSheetPoint,
            TimelineEntryKind,
            build_day_timeline,
            resolve_call_window,
        )

        cases = self._load_cases()
        self.assertGreater(len(cases), 0)

        for case in cases:
            with self.subTest(case=case["name"]):
                window = resolve_call_window(
                    self._to_datetime(case["callTime"]),
                    self._to_datetime(case["concertTime"]),
                    "Europe/Warsaw",
                )
                points = [
                    RunSheetPoint(
                        time=point.get("time", ""),
                        title=point["title"],
                        description="",
                        location="",
                    )
                    for point in case["points"]
                ]
                entries = build_day_timeline(points, window)
                self.assertEqual(
                    [
                        entry.point.title
                        if entry.kind is TimelineEntryKind.POINT and entry.point
                        else entry.kind.value
                        for entry in entries
                    ],
                    case["expected"],
                )


class ArtistDuplicateMergeTests(APITestCase):
    """
    Two `Artist` rows for one human: possible because uniqueness is on the
    e-mail column alone, and first observed on a printed call sheet, which
    listed one singer twice in a voice section and counted her as two. Detection
    reports candidates; the merge is what the roster was missing entirely.
    """

    def setUp(self) -> None:
        from archive.models import Composer, Piece
        from core.constants import VoiceLine

        self.voice_line = VoiceLine.ALTO_1

        User = get_user_model()
        self.manager = User.objects.create_user(
            username="mgr-merge", email="mgr-merge@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.primary = Artist.objects.create(
            first_name="Pia", last_name="Vućemilović",
            email="pia@example.com", voice_type=VoiceType.MEZZO,
            phone_number="+48 600 100 200",
        )
        self.twin = Artist.objects.create(
            first_name="Pia", last_name="Vucemilovic",
            email="pia.v@example.com", voice_type=VoiceType.MEZZO,
            phone_number="600 100 200",
        )

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=7),
            timezone="Europe/Warsaw",
        )
        composer = Composer.objects.create(first_name="Wolfgang", last_name="Mozart")
        self.piece = Piece.objects.create(title="Lacrimosa", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)

        self.primary_part = Participation.objects.create(
            artist=self.primary, project=self.project,
            status=Participation.Status.INVITED,
        )
        self.twin_part = Participation.objects.create(
            artist=self.twin, project=self.project,
            status=Participation.Status.CONFIRMED, fee=Decimal("300.00"),
        )
        ProjectPieceCasting.objects.create(
            participation=self.twin_part, piece=self.piece,
            voice_line=self.voice_line, gives_pitch=True,
        )

        self.client.force_authenticate(user=self.manager)

    # --- detection ------------------------------------------------------ #

    def test_a_shared_number_is_found_across_a_stroked_letter(self) -> None:
        """`ł`/`ć` and a trunk prefix are the two ways one person becomes two
        rows that no comparison in the system can see through."""
        groups = find_duplicate_groups()
        self.assertEqual([group.signal for group in groups], [DuplicateSignal.PHONE])
        self.assertEqual(
            set(groups[0].artist_ids),
            {str(self.primary.pk), str(self.twin.pk)},
        )

    def test_one_pair_is_reported_once_under_its_strongest_signal(self) -> None:
        """The pair already collides on the phone; folding the names together
        must not report the same two rows a second time."""
        self.twin.last_name = "Vućemilović"
        self.twin.save(update_fields=["last_name"])

        groups = find_duplicate_groups()
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0].signal, DuplicateSignal.PHONE)

    def test_an_archived_row_is_not_reported_again(self) -> None:
        """Archiving is how a resolved duplicate leaves the roster; re-reporting
        it forever would make the list impossible to bring to zero."""
        ArtistHRService.archive_artist(self.twin)
        self.assertEqual(find_duplicate_groups(), [])

    # --- merge ---------------------------------------------------------- #

    def test_merge_folds_a_project_both_rows_sing(self) -> None:
        """The normal case for a duplicate anyone notices: both rows invited to
        one concert, so the person is on the riser twice."""
        report = ArtistHRService.merge_artists(self.primary, self.twin)

        self.assertEqual(report.participations_folded, 1)
        self.assertEqual(report.participations_moved, 0)
        self.assertEqual(report.castings_moved, 1)

        self.assertEqual(
            Participation.objects.filter(project=self.project).count(), 1
        )
        surviving = Participation.objects.get(project=self.project)
        self.assertEqual(surviving.artist_id, self.primary.pk)
        # The answer given on either row is the person's answer.
        self.assertEqual(surviving.status, Participation.Status.CONFIRMED)
        self.assertEqual(report.statuses_upgraded, 1)
        # A fee the survivor never had is inherited rather than lost.
        self.assertEqual(surviving.fee, Decimal("300.00"))
        self.assertEqual(surviving.castings.count(), 1)

    def test_merge_reports_a_fee_it_refused_to_choose_between(self) -> None:
        """Money is not something a cleanup averages: the survivor keeps its own
        and the report says where to go and look."""
        self.primary_part.fee = Decimal("250.00")
        self.primary_part.save(update_fields=["fee"])

        report = ArtistHRService.merge_artists(self.primary, self.twin)

        self.assertEqual(report.fee_conflicts, ("Requiem",))
        self.primary_part.refresh_from_db()
        self.assertEqual(self.primary_part.fee, Decimal("250.00"))

    def test_merge_moves_a_project_the_survivor_was_not_in(self) -> None:
        other = Project.objects.create(
            title="Vespers", date_time=timezone.now() + timedelta(days=20),
            timezone="Europe/Warsaw", conductor=self.twin,
        )
        Participation.objects.create(
            artist=self.twin, project=other, status=Participation.Status.CONFIRMED
        )

        report = ArtistHRService.merge_artists(self.primary, self.twin)

        self.assertEqual(report.participations_moved, 1)
        self.assertEqual(report.projects_conducted, 1)
        other.refresh_from_db()
        self.assertEqual(other.conductor_id, self.primary.pk)
        self.assertTrue(
            Participation.objects.filter(project=other, artist=self.primary).exists()
        )

    def test_merge_retires_the_absorbed_row_through_the_archive(self) -> None:
        """Nothing is deleted: the emptied row leaves by the same door as any
        departure, so its record survives and its account stops signing in."""
        user = get_user_model().objects.create_user(
            username="twin-acct", email="pia.v@example.com"
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        self.twin.user = user
        self.twin.save(update_fields=["user"])

        ArtistHRService.merge_artists(self.primary, self.twin)

        twin = Artist.all_objects.get(pk=self.twin.pk)
        self.assertTrue(twin.is_deleted)
        self.assertFalse(twin.is_active)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_merge_refuses_a_duplicate_somebody_has_signed_into(self) -> None:
        """A usable password means a human uses that login. Choosing which of
        two live accounts dies is an account decision, not a roster cleanup."""
        user = get_user_model().objects.create_user(
            username="twin-live", email="pia.v@example.com", password="real-pw-123"
        )
        self.twin.user = user
        self.twin.save(update_fields=["user"])

        with self.assertRaises(ActivatedArtistMergeException):
            ArtistHRService.merge_artists(self.primary, self.twin)

        self.assertFalse(Artist.all_objects.get(pk=self.twin.pk).is_deleted)

    def test_merge_refuses_to_absorb_into_an_archived_row(self) -> None:
        ArtistHRService.archive_artist(self.primary)
        with self.assertRaises(ArtistMergeException):
            ArtistHRService.merge_artists(
                Artist.all_objects.get(pk=self.primary.pk), self.twin
            )

    def test_the_sheet_stops_printing_one_singer_twice(self) -> None:
        """Where this thread started: the roster annotation and the blocker line
        exist because the document must not let a duplicate pass unnoticed —
        merging is what makes them go quiet."""
        from .views import ProjectViewSet

        for participation in (self.primary_part, self.twin_part):
            participation.status = Participation.Status.CONFIRMED
            participation.save(update_fields=["status"])
        self.twin.last_name = "Vućemilović"
        self.twin.save(update_fields=["last_name"])

        def report_context() -> dict:
            parts, crew, program, reh, cast = ProjectViewSet._call_sheet_querysets(
                self.project
            )
            return DocumentGenerator._build_call_sheet_context(
                project=self.project, participations=parts, crew=crew, program=program,
                rehearsals=reh, castings=cast, audience=Audience.PRODUCTION,
                recipient=None, base_url="http://testserver/",
                kind=DocumentKind.PRODUCTION_REPORT,
            )

        before = report_context()
        self.assertEqual(before["metrics"]["cast_confirmed"], 2)
        self.assertIn(
            "2 wpisy", before["ensemble_sections"][0]["members"][0]
        )

        ArtistHRService.merge_artists(self.primary, self.twin)

        after = report_context()
        self.assertEqual(after["metrics"]["cast_confirmed"], 1)
        self.assertEqual(after["ensemble_sections"][0]["members"], ["Pia Vućemilović"])
        self.assertNotIn(
            "Pia Vućemilović",
            " ".join(blocker["detail"] for blocker in after["blockers"]),
        )

    # --- API ------------------------------------------------------------ #

    def test_merge_endpoint_is_manager_only(self) -> None:
        singer_user = get_user_model().objects.create_user(
            username="singer-merge", email="singer-merge@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=singer_user, role=AppRole.ARTIST)
        self.client.force_authenticate(user=singer_user)

        resp = self.client.post(
            f"/api/artists/{self.primary.id}/merge/",
            {"duplicate_id": str(self.twin.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_duplicates_endpoint_returns_the_rows_it_is_asking_about(self) -> None:
        resp = self.client.get("/api/artists/duplicates/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["signal"], "phone")
        self.assertEqual(
            {entry["id"] for entry in resp.data[0]["artists"]},
            {str(self.primary.id), str(self.twin.id)},
        )

    def test_merge_endpoint_reports_what_it_moved(self) -> None:
        resp = self.client.post(
            f"/api/artists/{self.primary.id}/merge/",
            {"duplicate_id": str(self.twin.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["merged"]["participations_folded"], 1)
        self.assertEqual(resp.data["merged"]["castings_moved"], 1)
        self.assertEqual(resp.data["artist"]["id"], str(self.primary.id))

    def test_merge_endpoint_rejects_a_missing_duplicate(self) -> None:
        resp = self.client.post(
            f"/api/artists/{self.primary.id}/merge/", {}, format="json"
        )
        self.assertEqual(resp.status_code, 400)


class ArtistLifecycleStateTests(APITestCase):
    """
    Cover for the roster's active/archived state being a single fact rather than
    three flags that can disagree. `Artist.is_active` is what every roster surface
    renders, `is_deleted` is what the default manager filters on, and the account's
    `is_active` is the login gate — an artist shown as archived while still able to
    sign in is the outcome these guarantee against.
    """

    @patch(EMAIL_TASK)
    def setUp(self, _enqueue_mock) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user(
            username="mgr-lifecycle", email="mgr-lifecycle@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        dto = ArtistCreateDTO(
            first_name="Grace", last_name="Hopper",
            email="grace-lifecycle@example.com", voice_type="ALT",
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.artist = ArtistHRService.provision_artist(dto)

        # An activated singer: the login gate starts open, so revoking it is observable.
        assert self.artist.user is not None
        self.artist.user.set_password("activated-pw")
        self.artist.user.is_active = True
        self.artist.user.save(update_fields=["password", "is_active"])

        self.client.force_authenticate(user=self.manager)

    def _reload(self) -> Artist:
        artist = Artist.all_objects.get(pk=self.artist.pk)
        if artist.user is not None:
            artist.user.refresh_from_db()
        return artist

    def test_archive_moves_all_three_markers_together(self):
        ArtistHRService.archive_artist(self.artist)

        artist = self._reload()
        self.assertFalse(artist.is_active)
        self.assertTrue(artist.is_deleted)
        assert artist.user is not None
        self.assertFalse(artist.user.is_active)

    def test_restore_inverts_all_three_markers(self):
        ArtistHRService.archive_artist(self.artist)
        ArtistHRService.restore_artist(Artist.all_objects.get(pk=self.artist.pk))

        artist = self._reload()
        self.assertTrue(artist.is_active)
        self.assertFalse(artist.is_deleted)
        assert artist.user is not None
        self.assertTrue(artist.user.is_active)

    def test_patch_cannot_revoke_access_behind_the_services_back(self):
        """`is_active` is lifecycle state, not a profile field: a plain PATCH must
        not be able to present somebody as archived while their login stays open."""
        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/", {"is_active": False}, format="json"
        )
        self.assertEqual(resp.status_code, 200)

        artist = self._reload()
        self.assertTrue(artist.is_active)
        assert artist.user is not None
        self.assertTrue(artist.user.is_active)

    def test_patch_cannot_soft_delete_bypassing_the_archive_service(self):
        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/", {"is_deleted": True}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(self._reload().is_deleted)

    def test_patch_cannot_relink_the_identity(self):
        original_user_id = self.artist.user_id
        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/", {"user": self.manager.id}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._reload().user_id, original_user_id)

    def test_patch_cannot_forge_the_invite_dispatch_trail(self):
        stamp = "2020-01-01T00:00:00Z"
        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/",
            {"activation_email_sent_at": stamp}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotEqual(
            self._reload().activation_email_sent_at,
            datetime(2020, 1, 1, tzinfo=UTC),
        )

    def test_patch_still_writes_ordinary_profile_fields(self):
        """The lock-down must not cost the manager their actual editing job."""
        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/",
            {"first_name": "Grazyna", "sight_reading_skill": 4}, format="json",
        )
        self.assertEqual(resp.status_code, 200)

        artist = self._reload()
        self.assertEqual(artist.first_name, "Grazyna")
        self.assertEqual(artist.sight_reading_skill, 4)

    def test_archived_artist_stays_editable(self):
        """Detail routes must reach archived records: correcting or inspecting
        somebody after they were archived is why the row is kept at all."""
        ArtistHRService.archive_artist(self.artist)

        resp = self.client.patch(
            f"/api/artists/{self.artist.id}/", {"first_name": "Grazyna"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._reload().first_name, "Grazyna")

    def test_archived_artists_are_absent_from_the_default_list(self):
        """The default list feeds the pickers, where an archived singer must never
        be offered."""
        ArtistHRService.archive_artist(self.artist)

        resp = self.client.get("/api/artists/")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn(str(self.artist.id), [row["id"] for row in resp.data])

    def test_roster_can_opt_into_archived_artists(self):
        """Without this the restore action can never be aimed: an archived singer
        would be invisible on every surface."""
        ArtistHRService.archive_artist(self.artist)

        resp = self.client.get("/api/artists/?include_archived=true")
        self.assertEqual(resp.status_code, 200)
        rows = {row["id"]: row for row in resp.data}
        self.assertIn(str(self.artist.id), rows)
        self.assertFalse(rows[str(self.artist.id)]["is_active"])

    def test_non_manager_cannot_opt_into_archived_artists(self):
        ArtistHRService.archive_artist(self.artist)

        User = get_user_model()
        outsider = User.objects.create_user(
            username="outsider-lifecycle", email="outsider-lifecycle@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=outsider, role=AppRole.ARTIST)
        self.client.force_authenticate(user=outsider)

        resp = self.client.get("/api/artists/?include_archived=true")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(list(resp.data), [])


class ArtistPiiSyncTests(TestCase):
    """
    Cover for the member's own settings being authoritative over the Artist row.
    The roster surfaces read the Artist copy, so a value the member removed must
    not survive there and resurface as if it were still theirs.
    """

    @patch(EMAIL_TASK)
    def setUp(self, _enqueue_mock) -> None:
        dto = ArtistCreateDTO(
            first_name="Ada", last_name="Lovelace",
            email="ada-pii@example.com", voice_type="SOP",
            phone_number="+48 600 100 100",
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.artist = ArtistHRService.provision_artist(dto)
        assert self.artist.user is not None
        self.user = self.artist.user

    def _save_preferences(self, **overrides: object) -> None:
        from core.dtos import UserPreferencesUpdateDTO
        from core.services import UserPreferencesService

        payload: dict[str, object] = {
            "first_name": "Ada", "last_name": "Lovelace",
            "language": "pl", "timezone": "Europe/Warsaw", "salutation": "F",
        }
        payload.update(overrides)
        UserPreferencesService.update_user_preferences(
            self.user, UserPreferencesUpdateDTO(**payload)
        )

    def test_clearing_the_phone_number_propagates_to_the_artist(self):
        self._save_preferences(phone_number="+48 600 200 200")
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.phone_number, "+48 600 200 200")

        self._save_preferences(phone_number="")
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.phone_number, "")

    def test_phone_number_accepts_the_full_width_the_profile_allows(self):
        """Both columns must be the same width: this write bypasses serializer
        validation, so a narrower Artist column would fail it outright."""
        long_number = "+48 600 100 100 ext 1234"  # 24 chars — over the old 15 cap
        self._save_preferences(phone_number=long_number)

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.phone_number, long_number)

    def test_names_accept_the_full_width_the_account_allows(self):
        """Same trap as the phone number, one column over: the account permits 150
        characters and this sync writes them straight through, so anything the
        account accepts has to fit here. Fails only on PostgreSQL — SQLite does
        not enforce varchar lengths — which is exactly why it is asserted."""
        long_first = "Maria" + "-Anna" * 20  # 105 chars — over the old 50 cap
        self._save_preferences(first_name=long_first)

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.first_name, long_first)


class ArtistNameOwnershipTests(APITestCase):
    """
    Cover for the account owning a member's name and the roster row projecting it.

    The roster copy has to exist — GDPR erasure detaches the account and concert
    history still has to name whoever sang — but it is not a second place to edit.
    A rename applied there alone leaves the singer's own settings screen, their
    greetings and every e-mail addressing them by a name nobody uses any more.
    """

    ME_URL = "/api/users/me/"

    @patch(EMAIL_TASK)
    def setUp(self, _enqueue_mock) -> None:
        dto = ArtistCreateDTO(
            first_name="Ada", last_name="Lovelace",
            email="ada-names@example.com", voice_type="SOP",
            first_name_vocative="Ado", language="pl",
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.artist = ArtistHRService.provision_artist(dto)
        assert self.artist.user is not None
        self.user = self.artist.user

        User = get_user_model()
        self.manager = User.objects.create_user(
            username="mgr-names", email="mgr-names@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

    def test_provisioning_stores_the_vocative_on_the_account_profile(self):
        self.assertEqual(self.user.profile.first_name_vocative, "Ado")
        # And reads back through the roster row, which is what the form edits.
        self.assertEqual(self.artist.first_name_vocative, "Ado")

    def test_roster_rename_reaches_the_account(self):
        ArtistHRService.update_artist(
            self.artist, {"first_name": "Augusta", "last_name": "King"}
        )

        self.user.refresh_from_db()
        self.artist.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name), ("Augusta", "King"))
        self.assertEqual((self.artist.first_name, self.artist.last_name), ("Augusta", "King"))

    def test_me_reports_the_renamed_account_without_backfill(self):
        """End-to-end proof that the two sides cannot disagree. Before the account
        became the owner this returned the stale name, and the serializer's
        Artist-backfill hid that for exactly as long as the account row was blank."""
        ArtistHRService.update_artist(self.artist, {"first_name": "Augusta"})

        self.user.refresh_from_db()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.ME_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["first_name"], "Augusta")

    def test_roster_vocative_edit_lands_on_the_account_profile(self):
        ArtistHRService.update_artist(self.artist, {"first_name_vocative": "Augusto"})

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.first_name_vocative, "Augusto")

    def test_roster_patch_carries_a_name_and_vocative_end_to_end(self):
        """Through the endpoint, not just the service: the vocative is no longer a
        column here, so the serializer field and the read-through property have to
        agree with each other and with where the write actually lands."""
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            f"/api/artists/{self.artist.id}/",
            {"first_name": "Augusta", "first_name_vocative": "Augusto"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["first_name"], "Augusta")
        self.assertEqual(response.data["first_name_vocative"], "Augusto")

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Augusta")
        self.assertEqual(self.user.profile.first_name_vocative, "Augusto")

    def test_detached_row_owns_its_own_archival_name(self):
        """The one case where this row is not a projection: erasure SET_NULLs the
        account, and the label left behind is all that keeps the history readable."""
        self.artist.user = None
        self.artist.save(update_fields=["user"])

        ArtistHRService.update_artist(self.artist, {"last_name": "Byron"})

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.last_name, "Byron")
        self.assertEqual(self.artist.first_name_vocative, "")


class ArtistEmailChangeTests(APITestCase):
    """
    Cover for a roster e-mail edit reaching the sign-in identity. Writing the
    Artist row alone would leave the member signing in — and receiving every
    notification, which key off `user.email` — at the old address, while the
    roster displays the new one and nobody notices until somebody asks why the
    mail stopped arriving.
    """

    @patch(EMAIL_TASK)
    def setUp(self, _enqueue_mock) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user(
            username="mgr-email", email="mgr-email@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        dto = ArtistCreateDTO(
            first_name="Grace", last_name="Hopper",
            email="typo@example.com", voice_type="ALT",
        )
        with self.captureOnCommitCallbacks(execute=True):
            self.artist = ArtistHRService.provision_artist(dto)
        self.client.force_authenticate(user=self.manager)

    def _url(self) -> str:
        return f"/api/artists/{self.artist.id}/"

    def _activate(self) -> None:
        assert self.artist.user is not None
        self.artist.user.set_password("activated-pw")
        self.artist.user.is_active = True
        self.artist.user.save(update_fields=["password", "is_active"])

    @patch(EMAIL_TASK)
    def test_pending_invite_typo_is_corrected_on_both_sides(self, enqueue_mock):
        resp = self.client.patch(
            self._url(), {"email": "correct@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)

        self.artist.refresh_from_db()
        assert self.artist.user is not None
        self.artist.user.refresh_from_db()
        self.assertEqual(self.artist.email, "correct@example.com")
        self.assertEqual(self.artist.user.email, "correct@example.com")

        # The old link is dead (the signed token hashes the address), so the
        # invite has to be re-issued or the member never receives one.
        enqueue_mock.assert_called_once()
        self.assertEqual(
            enqueue_mock.call_args.kwargs["recipient_email"], "correct@example.com"
        )
        self.assertIsNotNone(self.artist.activation_email_sent_at)

    @patch(EMAIL_TASK)
    def test_correction_clears_a_bounce_suppression(self, _enqueue_mock):
        """A correction is usually prompted by the old address bouncing; leaving
        the suppression set would silently drop every later notification."""
        assert self.artist.user is not None
        UserProfile.objects.filter(user=self.artist.user).update(email_undeliverable=True)

        self.client.patch(self._url(), {"email": "correct@example.com"}, format="json")

        self.artist.user.refresh_from_db()
        self.assertFalse(self.artist.user.profile.email_undeliverable)

    @patch(EMAIL_TASK)
    def test_activated_member_email_is_locked_to_its_owner(self, enqueue_mock):
        self._activate()

        resp = self.client.patch(
            self._url(), {"email": "hijack@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error_code"], "artist_email_locked")

        self.artist.refresh_from_db()
        assert self.artist.user is not None
        self.artist.user.refresh_from_db()
        self.assertEqual(self.artist.email, "typo@example.com")
        self.assertEqual(self.artist.user.email, "typo@example.com")
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_activated_member_can_still_have_other_fields_edited(self, _enqueue_mock):
        """The lock is on the credential, not on the record."""
        self._activate()

        resp = self.client.patch(self._url(), {"voice_type": "SOP"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.voice_type, "SOP")

    @patch(EMAIL_TASK)
    def test_resubmitting_the_unchanged_email_is_not_a_change(self, enqueue_mock):
        """The editor posts the whole form, so an untouched e-mail arrives on
        every save — it must not re-issue an invite each time, nor trip the lock
        for an activated member."""
        self._activate()

        resp = self.client.patch(
            self._url(), {"email": "TYPO@example.com", "first_name": "Grazyna"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.artist.refresh_from_db()
        self.assertEqual(self.artist.first_name, "Grazyna")
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_collision_with_another_artist_is_rejected(self, _enqueue_mock):
        """Caught one layer earlier, by the serializer's own uniqueness check —
        which reports it as a field error on `email`, the same inline shape the
        client renders for the service-level rejection below."""
        other = ArtistCreateDTO(
            first_name="Ada", last_name="Lovelace",
            email="taken@example.com", voice_type="SOP",
        )
        with self.captureOnCommitCallbacks(execute=True):
            ArtistHRService.provision_artist(other)

        resp = self.client.patch(
            self._url(), {"email": "taken@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("email", resp.data["errors"])

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.email, "typo@example.com")

    @patch(EMAIL_TASK)
    def test_collision_with_a_non_artist_account_is_rejected(self, _enqueue_mock):
        """A manager or crew account holds no Artist row, so the roster check
        alone would wave this through and produce two logins on one address."""
        resp = self.client.patch(
            self._url(), {"email": "mgr-email@test.pl"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["error_code"], "email_taken")

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.email, "typo@example.com")

    @patch(EMAIL_TASK)
    def test_detached_artist_email_is_only_an_archival_label(self, enqueue_mock):
        """After GDPR erasure there is no sign-in identity behind the row, so the
        address is history and there is nothing to keep in step with it."""
        self.artist.user = None
        self.artist.save(update_fields=["user"])

        resp = self.client.patch(
            self._url(), {"email": "relabelled@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)

        self.artist.refresh_from_db()
        self.assertEqual(self.artist.email, "relabelled@example.com")
        enqueue_mock.assert_not_called()


class AnnouncementNudgeTests(TestCase):
    """The safety net under the queue.

    Every other part of this feature is about sending *less*; this is the only one
    that guards against sending nothing. A queue nobody publishes is silence that
    looks like calm, and a choir that believes it knows the schedule is worse off
    than a spammed one — so a queue left sitting eventually says so, to the people
    who can actually publish it.
    """

    MANAGERS = "roster.services.send_bulk_notifications_task.delay"

    def setUp(self) -> None:
        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="an-mgr", email="anmgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.ACTIVE,
        )
        self.singer_user = User.objects.create_user(
            username="an-ada", email="anada@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=self.singer_user, first_name="Ada", last_name="Singer",
            email="anada@test.pl", voice_type=VoiceType.SOPRANO,
        )
        Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )

    # -- helpers ----------------------------------------------------------------

    def _queue(self, *, field: str = "location", old: str = "Sala A", new: str = "Sala B"):
        """Put one project field diff in the queue, exactly as an edit would."""
        from notifications.announcement_queue import AnnouncementQueue
        from notifications.models import AnnouncementKind, AnnouncementSubject

        return AnnouncementQueue.enqueue(
            project=self.project,
            subject_type=AnnouncementSubject.PROJECT,
            subject_id=str(self.project.id),
            kind=AnnouncementKind.CHANGED,
            notification_type=NotificationType.PROJECT_UPDATED,
            level=NotificationLevel.WARNING,
            metadata={
                "project_id": str(self.project.id),
                "project_name": self.project.title,
                "changes": [{"field": field, "old": old, "new": new}],
            },
        )

    def _age(self, hours: float) -> None:
        """Age the whole queue, preserving the order the edits were made in.
        `created_at` is auto_now_add, so shifting it afterwards is the only way to
        have an old queue in a test — and collapsing reads that order."""
        from notifications.models import PendingAnnouncement

        shift = timedelta(hours=hours)
        for row in PendingAnnouncement.objects.filter(project=self.project):
            PendingAnnouncement.objects.filter(pk=row.pk).update(
                created_at=row.created_at - shift
            )

    def _sweep(self):
        from .tasks import dispatch_announcement_nudges

        with patch(self.MANAGERS) as managers:
            result = dispatch_announcement_nudges()
        return result, managers

    # -- the fuse ---------------------------------------------------------------

    def test_a_fresh_queue_is_left_alone(self) -> None:
        """The queue is an editorial buffer, not a countdown. A conductor still
        working must not be nudged about the edit they made a minute ago."""
        self._queue()
        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 0)
        managers.assert_not_called()

    def test_a_queue_past_its_fuse_names_what_is_waiting(self) -> None:
        self._queue()
        self._age(25)

        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 1)
        managers.assert_called_once()
        kwargs = managers.call_args.kwargs
        self.assertEqual(
            kwargs["notification_type"], NotificationType.ANNOUNCEMENT_PENDING
        )
        # Addressed to whoever may publish — never to the cast, who already see the
        # saved data and would only be taught to distrust it.
        self.assertEqual(kwargs["recipient_ids"], [str(self.manager_user.id)])

        metadata = kwargs["metadata"]
        self.assertEqual(metadata["project_name"], "Requiem")
        # The same numbers the hub's pill and the review sheet show.
        self.assertEqual(metadata["change_count"], 1)
        self.assertEqual(metadata["recipient_count"], 1)
        self.assertGreaterEqual(metadata["waiting_hours"], 24)

    def test_the_same_queue_is_not_raised_twice_in_one_window(self) -> None:
        """A safety net that repeats hourly is the flood it was built to replace."""
        self._queue()
        self._age(25)

        first, _ = self._sweep()
        second, managers = self._sweep()

        self.assertEqual(first["nudged"], 1)
        self.assertEqual(second["nudged"], 0)
        managers.assert_not_called()

    @override_settings(ANNOUNCEMENT_NUDGE_HOURS=24, ANNOUNCEMENT_NUDGE_URGENT_HOURS=4)
    def test_a_reschedule_gets_the_short_fuse(self) -> None:
        """A change to when people have to be somewhere stops being useful the
        moment they have left for the old time, so it cannot wait out a full day."""
        self._queue(field="date_time", old="19:00", new="19:30")
        self._age(6)

        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 1)
        self.assertEqual(managers.call_args.kwargs["level"], NotificationLevel.URGENT)

    @override_settings(ANNOUNCEMENT_NUDGE_HOURS=24, ANNOUNCEMENT_NUDGE_URGENT_HOURS=4)
    def test_a_calm_queue_of_the_same_age_stays_quiet(self) -> None:
        """The counterpart to the test above: six hours is past the urgent fuse but
        well inside the ordinary one, so urgency is the only thing separating them."""
        self._queue()
        self._age(6)

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)

    @override_settings(ANNOUNCEMENT_NUDGE_HOURS=24, ANNOUNCEMENT_NUDGE_URGENT_HOURS=4)
    def test_an_escalation_breaks_through_a_calm_cooldown(self) -> None:
        """The cooldown is the surviving level's own fuse, not a flat day —
        otherwise a calm nudge sent this morning would mute a reschedule queued at
        noon until tomorrow, which is exactly when the alarm matters most."""
        self._queue()
        self._age(25)
        first, _ = self._sweep()
        self.assertEqual(first["nudged"], 1)

        # A reschedule arrives afterwards, and five more hours pass with nobody
        # publishing. The morning's stamp is older than the urgent fuse, so it no
        # longer speaks for this queue.
        self._queue(field="date_time", old="19:00", new="19:30")
        self._age(5)
        Project.objects.filter(pk=self.project.pk).update(
            announcement_nudged_at=timezone.now() - timedelta(hours=5)
        )

        second, managers = self._sweep()
        self.assertEqual(second["nudged"], 1)
        self.assertEqual(managers.call_args.kwargs["level"], NotificationLevel.URGENT)

    # -- honesty ----------------------------------------------------------------

    def test_a_dead_row_does_not_age_the_news_beside_it(self) -> None:
        """The fuse dates the news, not the rows. A venue moved and moved back
        yesterday says nothing, so it must not start the clock on a dress code
        changed an hour ago — the queue would nudge about something nobody has
        been sitting on, and the hours it quoted would be about a different edit."""
        self._queue(field="location", old="Sala A", new="Sala B")
        self._queue(field="location", old="Sala B", new="Sala A")
        self._age(25)
        # Fresh, and the only thing that survives collapsing.
        self._queue(field="dress_code_male", old="Frak", new="Smoking")

        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 0)
        managers.assert_not_called()

    def test_the_surviving_line_carries_its_own_age(self) -> None:
        """The counterpart: once the live change is itself past the fuse, the nudge
        fires and reports that line's age rather than the dead rows' — a number the
        conductor could otherwise not reconcile with anything they can see."""
        self._queue(field="location", old="Sala A", new="Sala B")
        self._queue(field="location", old="Sala B", new="Sala A")
        self._age(100)
        self._queue(field="dress_code_male", old="Frak", new="Smoking")
        from notifications.models import PendingAnnouncement
        PendingAnnouncement.objects.filter(
            project=self.project, change_field="dress_code_male"
        ).update(created_at=timezone.now() - timedelta(hours=26))

        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 1)
        waiting = managers.call_args.kwargs["metadata"]["waiting_hours"]
        self.assertGreaterEqual(waiting, 25)
        self.assertLess(waiting, 30)

    def test_a_project_claimed_meanwhile_is_not_nudged_twice(self) -> None:
        """The claim re-states the cooldown as the condition of its own write, so
        two beats reading the queue at the same moment cannot both send. Simulated
        by stamping the project after the read that found it stale."""
        self._queue()
        self._age(25)

        from notifications.announcement_queue import AnnouncementQueue

        real_stale = AnnouncementQueue.stale

        def stale_then_claimed(now):
            found = real_stale(now)
            # Stands for the other beat, which got there first.
            Project.objects.filter(pk=self.project.pk).update(
                announcement_nudged_at=timezone.now()
            )
            return found

        with patch.object(AnnouncementQueue, "stale", side_effect=stale_then_claimed):
            result, managers = self._sweep()

        self.assertEqual(result["nudged"], 0)
        managers.assert_not_called()

    def test_a_queue_that_collapses_to_silence_is_never_raised(self) -> None:
        """Rows are not news. A value moved and moved back leaves the queue holding
        two rows and nothing to say — nudging about it would make the feature wrong
        about its own numbers, which is the one thing it cannot afford to be."""
        self._queue(old="Sala A", new="Sala B")
        self._queue(old="Sala B", new="Sala A")
        self._age(25)

        result, managers = self._sweep()

        self.assertEqual(result["nudged"], 0)
        managers.assert_not_called()

    def test_a_queue_nobody_would_receive_is_not_raised(self) -> None:
        """Everyone declined, so publication would send nothing. The rows are still
        there; there is simply no one left in the conversation to tell."""
        Participation.objects.filter(project=self.project).update(
            status=Participation.Status.DECLINED
        )
        self._queue()
        self._age(25)

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)

    def test_publishing_the_queue_ends_the_nudging(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        self._queue()
        self._age(25)

        with patch("notifications.announcement_queue.send_bulk_notifications_task.delay"):
            AnnouncementQueue.publish(self.project)

        result, managers = self._sweep()
        self.assertEqual(result["nudged"], 0)
        managers.assert_not_called()

    def test_discarding_the_queue_ends_the_nudging(self) -> None:
        from notifications.announcement_queue import AnnouncementQueue

        self._queue()
        self._age(25)
        AnnouncementQueue.discard(self.project)

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)

    # -- what the sweep deliberately ignores ------------------------------------

    def test_a_concert_that_has_already_happened_is_not_raised(self) -> None:
        """After the concert a held rehearsal move is archaeology, and a project
        left ACTIVE would otherwise nag for as long as it existed."""
        self._queue()
        self._age(25)
        Project.objects.filter(pk=self.project.pk).update(
            date_time=timezone.now() - timedelta(days=1)
        )

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)

    def test_a_cancelled_project_is_not_raised(self) -> None:
        self._queue()
        self._age(25)
        Project.objects.filter(pk=self.project.pk).update(
            status=Project.Status.CANCELLED
        )

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)

    def test_a_completed_project_is_not_raised(self) -> None:
        self._queue()
        self._age(25)
        Project.objects.filter(pk=self.project.pk).update(
            status=Project.Status.COMPLETED
        )

        result, _ = self._sweep()
        self.assertEqual(result["nudged"], 0)
