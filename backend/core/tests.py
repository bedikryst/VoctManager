from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase
from rest_framework.test import APITestCase

from .constants import AppRole
from .exceptions import EmailAlreadyInUseException
from .models import UserProfile
from .permissions import IsManager, IsManagerOrReadOnly
from .services import UserIdentityService

User = get_user_model()

# The email task is dispatched through the service module, so it must be patched where
# it is *looked up* (core.services) — not where it is defined (notifications.email_tasks).
EMAIL_TASK = "core.services.send_transactional_email_task.delay"


class UserProvisioningServiceTests(TestCase):
    """The onboarding flow is service-driven; there is no post_save signal involved."""

    @patch(EMAIL_TASK)
    def test_provision_creates_inactive_user_with_profile(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="invitee@example.com",
                first_name="Ada",
                last_name="Lovelace",
            )

        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(UserProfile.objects.filter(user=user).exists())

    @patch(EMAIL_TASK)
    def test_provision_queues_single_activation_email(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            UserIdentityService.provision_user_account(
                email="invitee@example.com",
                first_name="Ada",
                last_name="Lovelace",
            )

        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "account_activation")

    @patch(EMAIL_TASK)
    def test_provision_rejects_duplicate_email_case_insensitively(self, enqueue_mock):
        UserIdentityService.provision_user_account(
            email="dupe@example.com", first_name="Ada", last_name="Lovelace",
        )
        with self.assertRaises(EmailAlreadyInUseException):
            UserIdentityService.provision_user_account(
                email="DUPE@example.com", first_name="Grace", last_name="Hopper",
            )


class AccountActivationViewTests(APITestCase):
    ACTIVATE_URL = "/api/users/activate/"

    @patch(EMAIL_TASK)
    def test_activation_sets_password_activates_and_queues_welcome(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="activate@example.com", first_name="Grace", last_name="Hopper",
            )
        enqueue_mock.reset_mock()  # discard the activation email queued during provisioning
        payload = UserIdentityService.generate_activation_token_payload(user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.ACTIVATE_URL,
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
        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "welcome_email")

    @patch(EMAIL_TASK)
    def test_activation_rejects_invalid_token(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="invalid@example.com", first_name="Ada", last_name="Lovelace",
            )
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.post(
            self.ACTIVATE_URL,
            {
                "uidb64": payload["uidb64"],
                "token": "invalid-token",
                "new_password": "SecurePass123!",
            },
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 403)
        self.assertFalse(user.is_active)


class RbacPermissionTests(TestCase):
    """Role-based access control on the shared permission classes."""

    def setUp(self):
        self.factory = RequestFactory()

    def _request(self, method, user):
        request = getattr(self.factory, method)("/")
        request.user = user
        return request

    def _user_with_role(self, role, *, is_staff=False):
        user = User.objects.create(
            username=str(uuid4()),
            email=f"{uuid4()}@example.com",
            is_staff=is_staff,
        )
        UserProfile.objects.create(user=user, role=role)
        return user

    def test_is_manager_grants_manager_role(self):
        request = self._request("get", self._user_with_role(AppRole.MANAGER))
        self.assertTrue(IsManager().has_permission(request, view=None))

    def test_is_manager_denies_artist_role(self):
        request = self._request("get", self._user_with_role(AppRole.ARTIST))
        self.assertFalse(IsManager().has_permission(request, view=None))

    def test_is_manager_grants_staff_override(self):
        request = self._request("get", self._user_with_role(AppRole.ARTIST, is_staff=True))
        self.assertTrue(IsManager().has_permission(request, view=None))

    def test_read_only_allows_any_authenticated_user_to_read(self):
        request = self._request("get", self._user_with_role(AppRole.ARTIST))
        self.assertTrue(IsManagerOrReadOnly().has_permission(request, view=None))

    def test_read_only_blocks_writes_for_non_managers(self):
        request = self._request("post", self._user_with_role(AppRole.ARTIST))
        self.assertFalse(IsManagerOrReadOnly().has_permission(request, view=None))

    def test_read_only_blocks_anonymous_reads(self):
        request = self._request("get", AnonymousUser())
        self.assertFalse(IsManagerOrReadOnly().has_permission(request, view=None))
