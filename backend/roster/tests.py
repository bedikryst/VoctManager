from unittest.mock import patch

from django.test import TestCase

from .dtos import ArtistCreateDTO
from .services import ArtistHRService

# Provisioning delegates the email to core.services, so the task is patched there.
EMAIL_TASK = "core.services.send_transactional_email_task.delay"


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
