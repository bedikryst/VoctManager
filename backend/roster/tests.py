import tempfile
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectCreateDTO
from .infrastructure.document_generator import DocumentRenderDependencyError
from .services import ArtistHRService

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

        self.project = Project.objects.create(
            title="Spring Gala", date_time=timezone.now(), timezone="UTC"
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
        resp = self.client.get(f"/api/crew-assignments/{self.crew.id}/")
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
        resp = self.client.get("/api/collaborators/")
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
        self.client.force_authenticate(user=self.singer_user)
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
