import io
import tempfile
from typing import TYPE_CHECKING, cast
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.mail import EmailMultiAlternatives
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from PIL import Image
from pydantic import ValidationError
from rest_framework.test import APITestCase

from .avatar_service import AVATAR_SIZE, THUMB_SIZE, AvatarService
from .constants import AppRole
from .dtos import UserPasswordChangeDTO, UserPreferencesUpdateDTO
from .exceptions import EmailAlreadyInUseException, InvalidImageException, format_pydantic_validation_errors
from .models import UserProfile
from .permissions import IsManager, IsManagerOrReadOnly
from .services import UserIdentityService

# `get_user_model()` returns a runtime value mypy cannot use as a type. Bind the
# concrete model under TYPE_CHECKING so "User" annotations resolve, while keeping
# the dynamic swappable-model lookup at runtime.
if TYPE_CHECKING:
    from django.contrib.auth.models import User
else:
    User = get_user_model()

# The email task is dispatched through the service module, so it must be patched where
# it is *looked up* (core.services) — not where it is defined (notifications.email_tasks).
EMAIL_TASK = "core.services.send_transactional_email_task.delay"


class PydanticDtoHardeningTests(SimpleTestCase):
    def test_preferences_dto_normalizes_text_boundaries(self):
        dto = UserPreferencesUpdateDTO(
            first_name="  Ada  ",
            last_name="  Lovelace  ",
            phone_number="   ",
            dietary_notes="  no peanuts  ",
            clothing_size=" M ",
            shoe_size=" 42 ",
        )

        self.assertEqual(dto.first_name, "Ada")
        self.assertEqual(dto.last_name, "Lovelace")
        self.assertIsNone(dto.phone_number)
        self.assertEqual(dto.dietary_notes, "no peanuts")
        self.assertEqual(dto.clothing_size, "m")
        self.assertEqual(dto.shoe_size, "42")

    def test_validation_error_formatter_does_not_echo_submitted_values(self):
        with self.assertRaises(ValidationError) as error_context:
            UserPasswordChangeDTO(old_password="", new_password="short")

        errors = format_pydantic_validation_errors(error_context.exception)

        self.assertTrue(errors)
        self.assertNotIn("input", errors[0])
        self.assertEqual(set(errors[0]), {"field", "message", "type"})


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
    def test_provision_passes_chosen_language_to_email_and_activation_link(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            UserIdentityService.provision_user_account(
                email="amelie@example.com", first_name="Amelie", last_name="Poulain",
                language="fr",
            )
        kwargs = enqueue_mock.call_args.kwargs
        # The onboarding email renders in the invitee's chosen language…
        self.assertEqual(kwargs["fallback_language"], "fr")
        # …and the link carries it so the activation SCREEN matches (no English flash).
        self.assertIn("&lang=fr", kwargs["context"]["activation_link"])

    @patch(EMAIL_TASK)
    def test_provision_clamps_unsupported_language_to_pl(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="weird@example.com", first_name="X", last_name="Y", language="zz",
            )
        self.assertEqual(user.profile.language, "pl")
        self.assertIn("&lang=pl", enqueue_mock.call_args.kwargs["context"]["activation_link"])

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


class ActivationPreviewViewTests(APITestCase):
    PREVIEW_URL = "/api/users/activate/preview/"

    @patch(EMAIL_TASK)
    def test_preview_returns_invitee_name_for_valid_link(self, _enqueue):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="preview@example.com", first_name="Ada", last_name="Lovelace",
            )
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.get(
            self.PREVIEW_URL, {"uid": payload["uidb64"], "token": payload["token"]}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["first_name"], "Ada")
        self.assertIn("first_name_vocative", response.data)

    @patch(EMAIL_TASK)
    def test_preview_returns_invitee_language(self, _enqueue):
        """Authoritative confirmation of the link's ?lang= so the activation
        screen can adopt the invitee's language even if the link is tampered."""
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="lang@example.com", first_name="Ada", last_name="Lovelace",
                language="fr",
            )
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.get(
            self.PREVIEW_URL, {"uid": payload["uidb64"], "token": payload["token"]}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["language"], "fr")

    @patch(EMAIL_TASK)
    def test_preview_rejects_invalid_token(self, _enqueue):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="preview-bad@example.com", first_name="Ada", last_name="Lovelace",
            )
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.get(
            self.PREVIEW_URL, {"uid": payload["uidb64"], "token": "invalid-token"}
        )

        self.assertEqual(response.status_code, 403)

    def test_preview_requires_parameters(self):
        response = self.client.get(self.PREVIEW_URL)
        self.assertEqual(response.status_code, 400)


class ActivationEmailLanguageTests(TestCase):
    """The onboarding email BODY itself must render in the invitee's language,
    not just be flagged with it — proven end-to-end through the dispatcher."""

    def test_activation_email_renders_in_chosen_language(self):
        from django.core import mail

        from notifications.email_service import EmailDispatcherService, EmailType

        EmailDispatcherService.dispatch(
            recipient_email="fr@example.com",
            subject="s",
            template_name="account_activation",
            context={
                "first_name": "Amelie",
                "first_name_vocative": "Amelie",
                "activation_link": "https://example.test/activate?lang=fr",
            },
            fallback_language="fr",
            email_type=EmailType.OPERATIONAL,
        )

        self.assertEqual(len(mail.outbox), 1)
        html = str(cast(EmailMultiAlternatives, mail.outbox[0]).alternatives[0][0])
        self.assertIn("Bienvenue dans VoctManager", html)  # FR headline, not the EN msgid

    def test_greeting_is_gendered_by_salutation(self):
        """Optional `salutation` genders only the greeting; NEUTRAL stays genderless."""
        from django.core import mail

        from notifications.email_service import EmailDispatcherService, EmailType

        cases = {
            "F": ("pl", "Droga Maria,"),
            "M": ("pl", "Drogi Maria,"),
            "N": ("pl", "Witaj Maria,"),
        }
        for salutation, (lang, expected) in cases.items():
            mail.outbox.clear()
            EmailDispatcherService.dispatch(
                recipient_email="g@example.com",
                subject="s",
                template_name="account_activation",
                context={
                    "first_name": "Maria",
                    "first_name_vocative": "Maria",
                    "salutation": salutation,
                    "activation_link": "https://example.test/activate",
                },
                fallback_language=lang,
                email_type=EmailType.OPERATIONAL,
            )
            html = str(cast(EmailMultiAlternatives, mail.outbox[0]).alternatives[0][0])
            self.assertIn(expected, html, f"salutation={salutation}")
            # The inelegant "Drogi/a" slash must never appear.
            self.assertNotIn("Drogi/a", html)


class PasswordResetRequestViewTests(APITestCase):
    """The public request endpoint must be enumeration-safe and side-effect-free
    for anyone who is not an active member."""

    REQUEST_URL = "/api/users/password-reset/"

    def setUp(self):
        # Clear the throttle history so the scoped rate limit does not leak
        # across test methods sharing the in-memory cache.
        cache.clear()

    def _active_user(self, email: str) -> "User":
        user = User.objects.create(
            username=str(uuid4()), email=email, first_name="Ada", last_name="Lovelace", is_active=True,
        )
        user.set_password("OldPass123!")
        user.save()
        UserProfile.objects.create(user=user, language="en")
        return user

    @patch(EMAIL_TASK)
    def test_request_queues_reset_email_for_active_user(self, enqueue_mock):
        self._active_user("member@example.com")

        response = self.client.post(self.REQUEST_URL, {"email": "member@example.com"}, format="json")

        self.assertEqual(response.status_code, 200)
        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "password_reset")

    @patch(EMAIL_TASK)
    def test_request_matches_email_case_insensitively(self, enqueue_mock):
        self._active_user("member@example.com")

        response = self.client.post(self.REQUEST_URL, {"email": "MEMBER@EXAMPLE.COM"}, format="json")

        self.assertEqual(response.status_code, 200)
        enqueue_mock.assert_called_once()

    @patch(EMAIL_TASK)
    def test_request_is_silent_for_unknown_email(self, enqueue_mock):
        response = self.client.post(self.REQUEST_URL, {"email": "ghost@example.com"}, format="json")

        # Enumeration-safe: identical 200, but no e-mail is dispatched.
        self.assertEqual(response.status_code, 200)
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_request_is_silent_for_inactive_invited_account(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            UserIdentityService.provision_user_account(
                email="pending@example.com", first_name="Grace", last_name="Hopper",
            )
        enqueue_mock.reset_mock()  # discard the activation email from provisioning

        response = self.client.post(self.REQUEST_URL, {"email": "pending@example.com"}, format="json")

        self.assertEqual(response.status_code, 200)
        enqueue_mock.assert_not_called()


class PasswordResetConfirmViewTests(APITestCase):
    CONFIRM_URL = "/api/users/password-reset/confirm/"

    def setUp(self):
        cache.clear()

    def _active_user(self, email: str) -> "User":
        user = User.objects.create(
            username=str(uuid4()), email=email, first_name="Ada", last_name="Lovelace", is_active=True,
        )
        user.set_password("OldPass123!")
        user.save()
        UserProfile.objects.create(user=user, language="en")
        return user

    @patch(EMAIL_TASK)
    def test_confirm_sets_new_password_and_queues_alert(self, enqueue_mock):
        user = self._active_user("reset@example.com")
        payload = UserIdentityService.generate_activation_token_payload(user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.CONFIRM_URL,
                {"uidb64": payload["uidb64"], "token": payload["token"], "new_password": "BrandNew456!"},
                format="json",
            )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(user.check_password("BrandNew456!"))
        self.assertFalse(user.check_password("OldPass123!"))
        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "password_changed")

    @patch(EMAIL_TASK)
    def test_confirm_rejects_invalid_token(self, enqueue_mock):
        user = self._active_user("badtoken@example.com")
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.post(
            self.CONFIRM_URL,
            {"uidb64": payload["uidb64"], "token": "not-a-real-token", "new_password": "BrandNew456!"},
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 403)
        self.assertTrue(user.check_password("OldPass123!"))
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_confirm_rejects_inactive_account(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="inactive@example.com", first_name="Grace", last_name="Hopper",
            )
        enqueue_mock.reset_mock()
        payload = UserIdentityService.generate_activation_token_payload(user)

        response = self.client.post(
            self.CONFIRM_URL,
            {"uidb64": payload["uidb64"], "token": payload["token"], "new_password": "BrandNew456!"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        enqueue_mock.assert_not_called()

    @patch(EMAIL_TASK)
    def test_confirm_token_is_single_use(self, enqueue_mock):
        user = self._active_user("reuse@example.com")
        payload = UserIdentityService.generate_activation_token_payload(user)

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                self.CONFIRM_URL,
                {"uidb64": payload["uidb64"], "token": payload["token"], "new_password": "BrandNew456!"},
                format="json",
            )
        # The token hashes the old password hash, so rotating it invalidates reuse.
        second = self.client.post(
            self.CONFIRM_URL,
            {"uidb64": payload["uidb64"], "token": payload["token"], "new_password": "Another789!"},
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 403)
        self.assertTrue(user.check_password("BrandNew456!"))


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


def _png_upload(name="photo.png", size=(800, 400), color=(120, 80, 200)):
    """Build an in-memory, non-square PNG upload for avatar tests."""
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/png")


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class AvatarServiceTests(TestCase):
    """The avatar pipeline must always re-encode to two square WebP renders."""

    def setUp(self):
        user = User.objects.create(username=str(uuid4()), email=f"{uuid4()}@example.com")
        self.profile = UserProfile.objects.create(user=user, role=AppRole.ARTIST)

    def test_set_avatar_produces_square_webp_renders(self):
        AvatarService.set_avatar(self.profile, _png_upload())
        self.profile.refresh_from_db()

        self.assertTrue(self.profile.avatar)
        self.assertTrue(self.profile.avatar_thumb)

        with Image.open(self.profile.avatar) as full:
            self.assertEqual(full.format, "WEBP")
            self.assertEqual(full.size, (AVATAR_SIZE, AVATAR_SIZE))
        with Image.open(self.profile.avatar_thumb) as thumb:
            self.assertEqual(thumb.size, (THUMB_SIZE, THUMB_SIZE))

    def test_replacing_avatar_purges_previous_files(self):
        AvatarService.set_avatar(self.profile, _png_upload())
        first_name = self.profile.avatar.name
        first_storage = self.profile.avatar.storage
        assert first_name is not None  # set_avatar always populates the field

        AvatarService.set_avatar(self.profile, _png_upload(color=(10, 10, 10)))
        self.profile.refresh_from_db()

        self.assertNotEqual(self.profile.avatar.name, first_name)
        self.assertFalse(first_storage.exists(first_name))

    def test_clear_avatar_removes_files_and_nulls_fields(self):
        AvatarService.set_avatar(self.profile, _png_upload())
        name, storage = self.profile.avatar.name, self.profile.avatar.storage
        assert name is not None  # set_avatar always populates the field

        AvatarService.clear_avatar(self.profile)
        self.profile.refresh_from_db()

        self.assertFalse(self.profile.avatar)
        self.assertFalse(self.profile.avatar_thumb)
        self.assertFalse(storage.exists(name))

    def test_non_image_payload_is_rejected(self):
        bogus = SimpleUploadedFile("evil.png", b"not-an-image", content_type="image/png")
        with self.assertRaises(InvalidImageException):
            AvatarService.set_avatar(self.profile, bogus)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class AvatarViewTests(APITestCase):
    AVATAR_URL = "/api/users/me/avatar/"

    def setUp(self):
        self.user = User.objects.create(username=str(uuid4()), email=f"{uuid4()}@example.com")
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.client.force_authenticate(self.user)

    def test_upload_returns_absolute_avatar_urls(self):
        response = self.client.post(
            self.AVATAR_URL, {"avatar": _png_upload()}, format="multipart"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["avatar_url"])
        self.assertTrue(response.data["avatar_thumb_url"])

    def test_upload_without_file_is_rejected(self):
        response = self.client.post(self.AVATAR_URL, {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "avatar_missing")

    def test_delete_clears_avatar(self):
        self.client.post(self.AVATAR_URL, {"avatar": _png_upload()}, format="multipart")
        response = self.client.delete(self.AVATAR_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["avatar_url"])


class MarkWelcomeSeenViewTests(APITestCase):
    SEEN_URL = "/api/users/me/seen-welcome/"
    ME_URL = "/api/users/me/"

    def setUp(self):
        self.user = User.objects.create(username=str(uuid4()), email=f"{uuid4()}@example.com")
        self.profile = UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.client.force_authenticate(self.user)

    def test_first_call_stamps_welcome_seen(self):
        self.assertIsNone(self.profile.welcome_seen_at)
        response = self.client.post(self.SEEN_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["welcome_seen_at"])
        self.profile.refresh_from_db()
        self.assertIsNotNone(self.profile.welcome_seen_at)

    def test_idempotent_keeps_original_timestamp(self):
        first = self.client.post(self.SEEN_URL).data["welcome_seen_at"]
        second = self.client.post(self.SEEN_URL).data["welcome_seen_at"]
        # Set once: a repeat call must not overwrite the original moment.
        self.assertEqual(first, second)

    def test_welcome_seen_at_is_read_only_via_profile_patch(self):
        # The flag is server-authoritative; a client cannot back-date or clear it
        # through the ordinary profile PATCH. It is read-only in the serializer AND
        # the preferences DTO rejects the unknown field outright (400) — either way
        # the value never takes effect.
        response = self.client.patch(
            self.ME_URL,
            {"profile": {"welcome_seen_at": "2000-01-01T00:00:00Z"}},
            format="json",
        )
        self.assertIn(response.status_code, (200, 400))
        self.profile.refresh_from_db()
        self.assertIsNone(self.profile.welcome_seen_at)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.SEEN_URL)
        self.assertIn(response.status_code, (401, 403))


class EnterpriseExceptionHandlerTests(SimpleTestCase):
    """The API error envelope is the contract the frontend parses. Every branch
    must carry a stable, machine-readable `error_code` (so the client maps it to
    curated, localized copy) and a non-empty `detail`."""

    def setUp(self):
        from .exceptions import enterprise_exception_handler

        self.handle = enterprise_exception_handler
        self.context = {"request": RequestFactory().get("/api/test/")}

    def _envelope(self, exc):
        response = self.handle(exc, self.context)
        self.assertIsNotNone(response)
        return response

    def test_domain_exception_uses_explicit_code_and_default_message(self):
        from .exceptions import EmailAlreadyInUseException

        response = self._envelope(EmailAlreadyInUseException())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "email_taken")
        # Raised without a message → the class default backs `detail`.
        self.assertEqual(response.data["detail"], "This email is already in use.")

    def test_domain_exception_preserves_caller_message_and_derives_code(self):
        from roster.exceptions import ParticipationException

        response = self._envelope(
            ParticipationException("Cannot assign an unconfirmed participation.")
        )
        self.assertEqual(response.data["error_code"], "participation")
        self.assertEqual(
            response.data["detail"], "Cannot assign an unconfirmed participation."
        )

    def test_archive_domain_exception_derives_code_from_class_name(self):
        from archive.exceptions import PieceValidationException

        response = self._envelope(PieceValidationException())
        self.assertEqual(response.data["error_code"], "piece_validation")
        self.assertEqual(
            response.data["detail"], "This archive operation is not allowed."
        )

    def test_pydantic_validation_envelope(self):
        from pydantic import BaseModel, ValidationError

        class _Model(BaseModel):
            age: int

        try:
            _Model(age="not-a-number")
        except ValidationError as exc:
            response = self._envelope(exc)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.data["error_code"], "validation_error")
        self.assertEqual(response.data["validation_errors"][0]["field"], "age")

    def test_http_errors_map_to_stable_codes(self):
        from rest_framework.exceptions import (
            NotAuthenticated,
            NotFound,
            PermissionDenied,
            Throttled,
        )

        self.assertEqual(self._envelope(NotFound()).data["error_code"], "not_found")
        self.assertEqual(
            self._envelope(PermissionDenied()).data["error_code"], "forbidden"
        )
        self.assertEqual(
            self._envelope(NotAuthenticated()).data["error_code"], "unauthorized"
        )
        self.assertEqual(self._envelope(Throttled()).data["error_code"], "rate_limited")
        # The original DRF payload is preserved under `errors` for field detail.
        self.assertIn("errors", self._envelope(NotFound()).data)

    def test_unhandled_exception_is_not_swallowed(self):
        # A non-API exception yields None so Django renders its own 500 — the
        # handler must never mask a real server fault as a tidy 400.
        self.assertIsNone(self.handle(Exception("boom"), self.context))


class MakeErrorResponseEnvelopeTests(SimpleTestCase):
    """Hand-written view error responses (auth flows) must speak the same
    envelope as the global handler, and preserve the per-raise stable code the
    client branches on (e.g. `expired_reset_link`)."""

    def setUp(self):
        from .exceptions import make_error_response

        self.make = make_error_response
        self.request = RequestFactory().post("/api/users/password-reset/confirm/")

    def test_envelope_shape_and_message_alias(self):
        from .exceptions import InvalidCredentialsException

        exc = InvalidCredentialsException("expired_reset_link")
        response = self.make(
            self.request,
            status_code=403,
            error_code=str(exc) or exc.code,
            detail="Reset link is invalid or expired.",
        )
        self.assertEqual(response.status_code, 403)
        data = response.data
        self.assertEqual(data["error_code"], "expired_reset_link")
        self.assertEqual(data["detail"], "Reset link is invalid or expired.")
        self.assertEqual(data["message"], data["detail"])  # transitional alias
        self.assertEqual(data["status"], 403)
        self.assertEqual(data["title"], "Forbidden")
        self.assertEqual(data["instance"], "/api/users/password-reset/confirm/")
        self.assertEqual(data["type"], "/errors/expired-reset-link")

    def test_class_code_fallback_when_raised_without_message(self):
        from .exceptions import InvalidCredentialsException

        exc = InvalidCredentialsException()
        self.assertEqual(str(exc) or exc.code, "invalid_credentials")

    def test_validation_errors_passthrough(self):
        response = self.make(
            self.request,
            status_code=400,
            error_code="password_invalid",
            detail="The password does not meet the security requirements.",
            validation_errors={"new_password": ["Too short."]},
        )
        self.assertEqual(response.data["error_code"], "password_invalid")
        self.assertEqual(
            response.data["validation_errors"]["new_password"], ["Too short."]
        )
