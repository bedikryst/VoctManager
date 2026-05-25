from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from .dtos import ArtistCreateDTO, AttendanceRecordDTO, ProjectCreateDTO
from .services import ArtistHRService

# Provisioning delegates the email to core.services, so the task is patched there.
EMAIL_TASK = "core.services.send_transactional_email_task.delay"


class RosterDtoTests(SimpleTestCase):
    def test_attendance_dto_accepts_api_aliases_and_internal_field_names(self):
        participation_id = "00000000-0000-0000-0000-000000000001"
        rehearsal_id = "00000000-0000-0000-0000-000000000002"

        api_dto = AttendanceRecordDTO(
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
