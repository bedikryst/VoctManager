from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from .services import UserIdentityService


User = get_user_model()


class UserCreationSignalTests(TestCase):
    @patch("core.signals.send_transactional_email_task.delay")
    def test_active_user_creation_queues_single_welcome_email(self, enqueue_mock):
        user = User.objects.create_user(
            username="active.user",
            email="active@example.com",
            password="SecurePassword123!",
        )

        self.assertTrue(hasattr(user, "profile"))
        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "welcome_email")
        self.assertTrue(enqueue_mock.call_args.kwargs["fallback_to_sync"])

    @patch("core.signals.send_transactional_email_task.delay")
    def test_inactive_user_creation_skips_welcome_email(self, enqueue_mock):
        user = User.objects.create(
            username="inactive.user",
            email="inactive@example.com",
            is_active=False,
        )

        self.assertTrue(hasattr(user, "profile"))
        enqueue_mock.assert_not_called()


class AccountActivationViewTests(APITestCase):
    @patch("core.signals.send_transactional_email_task.delay")
    def test_account_activation_activates_invited_user(self, enqueue_mock):
        user = User.objects.create(
            username="activation.user",
            email="activate@example.com",
            is_active=False,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])

        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.post(
            "/api/users/activate/",
            {
                "uidb64": payload["uidb64"],
                "token": payload["token"],
                "new_password": "SecurePass123!",
            },
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("SecurePass123!"))

    @patch("core.signals.send_transactional_email_task.delay")
    def test_account_activation_rejects_invalid_token(self, enqueue_mock):
        user = User.objects.create(
            username="invalid.token.user",
            email="invalid@example.com",
            is_active=False,
        )

        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.post(
            "/api/users/activate/",
            {
                "uidb64": payload["uidb64"],
                "token": "invalid-token",
                "new_password": "SecurePass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
