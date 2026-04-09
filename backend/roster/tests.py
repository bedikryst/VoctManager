from unittest.mock import patch

from django.test import TestCase

from .dtos import ArtistCreateDTO
from .services import ArtistHRService


class ArtistProvisioningTests(TestCase):
    @patch("roster.services.UserIdentityService.generate_activation_token_payload")
    @patch("roster.services.send_transactional_email_task.delay")
    @patch("core.signals.send_transactional_email_task.delay")
    def test_provision_artist_only_queues_activation_email_for_inactive_user(
        self,
        signal_enqueue_mock,
        provisioning_enqueue_mock,
        token_payload_mock,
    ):
        token_payload_mock.return_value = {
            "uidb64": "uid-token",
            "token": "activation-token",
        }
        dto = ArtistCreateDTO(
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            voice_type="ALT",
        )

        with self.captureOnCommitCallbacks(execute=True):
            artist = ArtistHRService.provision_artist(dto)

        self.assertEqual(artist.email, "ada@example.com")
        self.assertFalse(artist.user.is_active)
        signal_enqueue_mock.assert_not_called()
        provisioning_enqueue_mock.assert_called_once()
        self.assertEqual(
            provisioning_enqueue_mock.call_args.kwargs["template_name"],
            "account_activation",
        )
        self.assertTrue(provisioning_enqueue_mock.call_args.kwargs["fallback_to_sync"])
