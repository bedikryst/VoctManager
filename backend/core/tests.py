import io
import tempfile
from contextlib import contextmanager
from typing import TYPE_CHECKING, cast
from unittest.mock import patch
from uuid import uuid4

import requests
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError
from django.test import (
    RequestFactory,
    SimpleTestCase,
    TestCase,
    TransactionTestCase,
    override_settings,
)
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
from .tasks import ping_beat_heartbeat

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
            clothing_size=" M ",
            shoe_size=" 42 ",
        )

        self.assertEqual(dto.first_name, "Ada")
        self.assertEqual(dto.last_name, "Lovelace")
        self.assertIsNone(dto.phone_number)
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
                    "terms_version": "2026-07-09",
                },
                format="json",
            )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("SecurePass123!"))
        self.assertEqual(user.profile.terms_accepted_version, "2026-07-09")
        self.assertIsNotNone(user.profile.terms_accepted_at)
        enqueue_mock.assert_called_once()
        self.assertEqual(enqueue_mock.call_args.kwargs["template_name"], "welcome_email")

    @patch(EMAIL_TASK)
    def test_activation_requires_terms_version(self, enqueue_mock):
        with self.captureOnCommitCallbacks(execute=True):
            user = UserIdentityService.provision_user_account(
                email="noterms@example.com", first_name="Alan", last_name="Turing",
            )
        payload = UserIdentityService.generate_activation_token_payload(user)

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
        self.assertEqual(response.status_code, 400)
        self.assertFalse(user.is_active)

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
                "terms_version": "2026-07-09",
            },
            format="json",
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, 403)
        self.assertFalse(user.is_active)


class GreetingResolutionTests(TestCase):
    """
    Cover for who gets addressed properly and in which language.

    The vocative used to live on the choral profile, so resolving it meant
    reaching from the account into the roster — and a manager or crew member,
    who has no row there, was silently greeted in the nominative. In Polish that
    is not a nuance: "Witaj Krystian" is simply wrong where "Krystianie" belongs.
    """

    def _account(self, first_name: str, vocative: str) -> "User":
        user = User.objects.create_user(
            username=str(uuid4()), email=f"{uuid4()}@example.com",
            password="pw12345678", first_name=first_name,
        )
        UserProfile.objects.create(
            user=user, role=AppRole.MANAGER, first_name_vocative=vocative
        )
        return user

    def test_account_without_a_choral_profile_is_greeted_in_the_vocative(self):
        from .greetings import resolve_vocative

        user = self._account("Krystian", "Krystianie")
        self.assertEqual(resolve_vocative(user, "pl"), "Krystianie")

    def test_non_polish_languages_are_addressed_in_the_nominative(self):
        """French and English have no vocative case; a stored Polish form there
        would read as a misspelling of the person's own name."""
        from .greetings import resolve_vocative

        user = self._account("Krystian", "Krystianie")
        self.assertEqual(resolve_vocative(user, "fr"), "Krystian")
        self.assertEqual(resolve_vocative(user, "en"), "Krystian")

    def test_missing_vocative_falls_back_to_the_first_name(self):
        from .greetings import resolve_vocative

        user = self._account("Krystian", "")
        self.assertEqual(resolve_vocative(user, "pl"), "Krystian")

    def test_account_without_a_profile_row_does_not_crash(self):
        """Provisioning always makes one, but fixtures and legacy rows may not —
        and a greeting is never worth a 500."""
        from .greetings import resolve_vocative

        user = User.objects.create_user(
            username=str(uuid4()), email=f"{uuid4()}@example.com",
            password="pw12345678", first_name="Krystian",
        )
        self.assertEqual(resolve_vocative(user, "pl"), "Krystian")


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


class AccountErasureTests(TestCase):
    """
    Cover for GDPR erasure actually removing the profile. `delete()` on an
    EnterpriseBaseModel is a soft delete, which would leave every preference row
    (phone number, height, sizes) intact and still reachable through
    `user.profile`, since the reverse relation resolves via the unfiltered base
    manager. Erasure has to remove the data, not flag it.
    """

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username=str(uuid4()), email="erasure@example.com", password="pw12345678",
        )
        self.profile = UserProfile.objects.create(
            user=self.user, phone_number="+48 600 100 100", height_cm=180,
            clothing_size="l", shoe_size="42",
        )

    @patch(EMAIL_TASK)
    def test_erasure_removes_the_profile_row_entirely(self, _enqueue_mock):
        from .dtos import UserAccountDeletionDTO

        with self.captureOnCommitCallbacks(execute=True):
            UserIdentityService.process_account_soft_deletion(
                self.user, UserAccountDeletionDTO(current_password="pw12345678"),
            )

        # Not merely hidden by the default manager — gone from the table.
        self.assertFalse(
            UserProfile.all_objects.filter(pk=self.profile.pk).exists()
        )

    @patch(EMAIL_TASK)
    def test_erasure_anonymizes_the_core_identity(self, _enqueue_mock):
        from .dtos import UserAccountDeletionDTO

        with self.captureOnCommitCallbacks(execute=True):
            UserIdentityService.process_account_soft_deletion(
                self.user, UserAccountDeletionDTO(current_password="pw12345678"),
            )

        self.user.refresh_from_db()
        self.assertNotIn("erasure@example.com", self.user.email)
        self.assertFalse(self.user.is_active)


class AccountEmailAuditCommandTests(TestCase):
    """
    Cover for the pre-flight that gates enforcing e-mail as a real identifier.
    It has to be trustworthy in both directions: silent when the data is clean,
    and refusing to pass when it is not — a false all-clear would send a
    uniqueness migration into a collision mid-deploy.
    """

    def _run(self, **kwargs) -> str:
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command("audit_account_emails", stdout=out, **kwargs)
        return out.getvalue()

    def _user(self, email: str):
        return User.objects.create_user(username=str(uuid4()), email=email, password="pw12345678")

    @contextmanager
    def _without_email_constraint(self):
        """
        Drops the case-insensitive unique index for the duration of the block.

        The command exists to inspect a database that does NOT yet have that
        index — it is the pre-flight run before the constraint is applied. Once
        the index exists, the duplicate state it reports can no longer be created
        through the ORM, so removing it is the only way to reach the detection
        path at all.

        Nothing is restored on exit, and nothing needs to be: both SQLite and
        PostgreSQL have transactional DDL, so this class's TestCase rollback
        undoes the drop along with the rows. Rebuilding it here would in fact
        fail — the duplicates are still present until that rollback.
        """
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("DROP INDEX IF EXISTS voct_user_email_ci_uniq;")
        yield

    def test_clean_data_passes(self):
        self._user("ada@example.com")
        self._user("grace@example.com")

        output = self._run()
        self.assertIn("will apply cleanly", output)

    def test_case_insensitive_duplicates_block_the_constraint(self):
        from django.core.management.base import CommandError

        with self._without_email_constraint():
            self._user("ada@example.com")
            self._user("ADA@example.com")

            with self.assertRaises(CommandError) as ctx:
                self._run()
        self.assertIn("duplicate address group", str(ctx.exception))

    @patch(EMAIL_TASK)
    def test_roster_drift_is_reported(self, _enqueue_mock):
        from roster.dtos import ArtistCreateDTO
        from roster.services import ArtistHRService

        with self.captureOnCommitCallbacks(execute=True):
            artist = ArtistHRService.provision_artist(
                ArtistCreateDTO(
                    first_name="Ada", last_name="Lovelace",
                    email="ada@example.com", voice_type="SOP",
                )
            )
        # Simulate the divergence a roster-side write used to create.
        artist.email = "stale@example.com"
        artist.save(update_fields=["email"])

        output = self._run()
        self.assertIn("stale@example.com", output)
        self.assertIn("ada@example.com", output)

    @patch(EMAIL_TASK)
    def test_fix_drift_realigns_the_roster_to_the_account(self, _enqueue_mock):
        from roster.dtos import ArtistCreateDTO
        from roster.models import Artist
        from roster.services import ArtistHRService

        with self.captureOnCommitCallbacks(execute=True):
            artist = ArtistHRService.provision_artist(
                ArtistCreateDTO(
                    first_name="Ada", last_name="Lovelace",
                    email="ada@example.com", voice_type="SOP",
                )
            )
        artist.email = "stale@example.com"
        artist.save(update_fields=["email"])

        self._run(fix_drift=True)

        artist.refresh_from_db()
        self.assertEqual(artist.email, "ada@example.com")
        self.assertEqual(Artist.all_objects.filter(email="stale@example.com").count(), 0)

    @patch(EMAIL_TASK)
    def test_fix_drift_leaves_duplicates_alone(self, _enqueue_mock):
        """Merging accounts decides who keeps the concert history — not a script's
        call. The command must still refuse even when asked to repair."""
        from django.core.management.base import CommandError

        with self._without_email_constraint():
            self._user("ada@example.com")
            self._user("ADA@example.com")

            with self.assertRaises(CommandError):
                self._run(fix_drift=True)
            self.assertEqual(User.objects.filter(email__iexact="ada@example.com").count(), 2)

    def test_blank_addresses_are_reported_but_not_duplicates(self):
        """Two blank addresses are not a collision to resolve by merging — they
        are accounts that simply cannot sign in, and must not mask the real
        duplicate report."""
        User.objects.create_user(username=str(uuid4()), email="", password="pw12345678")
        User.objects.create_user(username=str(uuid4()), email="", password="pw12345678")

        output = self._run()
        self.assertIn("blank address", output)
        self.assertIn("will apply cleanly", output)


class AccountEmailUniquenessConstraintTests(TransactionTestCase):
    """
    Cover for the database actually refusing a duplicate address.

    Every application-side guard is a check-then-insert, so the only real
    enforcement is the index — and an index nobody exercises is an index that
    quietly stops existing after some future migration. TransactionTestCase
    because an IntegrityError marks the surrounding transaction unusable, which a
    single-transaction TestCase cannot recover from.
    """

    def _make(self, email: str):
        return User.objects.create_user(username=str(uuid4()), email=email, password="pw12345678")

    def test_exact_duplicate_is_refused(self):
        self._make("ada@example.com")
        with self.assertRaises(IntegrityError):
            self._make("ada@example.com")

    def test_case_variant_duplicate_is_refused(self):
        """Authentication looks accounts up with `email__iexact`, so a case
        variant is the same account as far as sign-in is concerned."""
        self._make("ada@example.com")
        with self.assertRaises(IntegrityError):
            self._make("ADA@Example.com")

    def test_blank_addresses_do_not_collide(self):
        """`AbstractUser.email` is blankable; several blank rows are accounts that
        cannot sign in, not a collision — the index is partial for this reason."""
        self._make("")
        self._make("")
        self.assertEqual(User.objects.filter(email="").count(), 2)

    @patch(EMAIL_TASK)
    def test_provisioning_reports_a_lost_race_as_a_domain_error(self, _enqueue_mock):
        """Simulates the window between the existence check and the insert: the
        caller must see the ordinary duplicate error, not a 500."""
        self._make("ada@example.com")

        with patch.object(User.objects, "filter") as guard:
            guard.return_value.exists.return_value = False
            with self.assertRaises(EmailAlreadyInUseException):
                UserIdentityService.provision_user_account(
                    email="ADA@example.com", first_name="Ada", last_name="Lovelace",
                )


class ReadinessProbeTests(TestCase):
    """The external uptime monitor branches on this endpoint's status code, so
    200-vs-503 is a production contract rather than cosmetics."""

    URL = "/api/health/ready/"

    def test_liveness_stays_dependency_free(self):
        """`/api/health/` backs the Docker healthcheck. If it ever grew a database
        call, a slow Postgres would start restarting the web container — and take
        celery down with it through `depends_on: service_healthy`."""
        with patch("config.health.connections") as connections_mock:
            response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        connections_mock.__getitem__.assert_not_called()

    def test_healthy_stack_reports_ok(self):
        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}
        )

    def test_unreachable_database_degrades_to_503(self):
        with patch("config.health.connections") as connections_mock:
            connections_mock.__getitem__.side_effect = RuntimeError("connection refused")
            with self.assertLogs("config.health", level="ERROR"):
                response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "degraded")
        self.assertEqual(response.json()["checks"]["database"], "error")

    def test_unreachable_cache_degrades_to_503(self):
        """Redis backs the cache and the Celery broker alike, so losing it must not
        read as healthy merely because Django can still answer."""
        with (
            patch("config.health.cache.set", side_effect=RuntimeError("connection refused")),
            self.assertLogs("config.health", level="ERROR"),
        ):
            response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["checks"]["redis"], "error")
        self.assertEqual(response.json()["checks"]["database"], "ok")

    def test_write_only_cache_does_not_pass_as_healthy(self):
        """A Redis at maxmemory under noeviction accepts the connection and answers
        PING happily while dropping writes. The probe does a round-trip, not a ping,
        precisely so that instance is reported degraded."""
        with (
            patch("config.health.cache.get", return_value=None),
            self.assertLogs("config.health", level="ERROR"),
        ):
            response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["checks"]["redis"], "error")

    def test_driver_detail_never_reaches_an_anonymous_caller(self):
        """The endpoint is unauthenticated and the driver's error text carries
        hostnames and credential fragments; only the check name may travel."""
        secret = "redis://admin:hunter2@10.0.0.5:6379"
        with (
            patch("config.health.cache.set", side_effect=RuntimeError(secret)),
            self.assertLogs("config.health", level="ERROR"),
        ):
            response = self.client.get(self.URL)

        body = response.content.decode()
        self.assertNotIn("10.0.0.5", body)
        self.assertNotIn("hunter2", body)


class BeatHeartbeatTaskTests(SimpleTestCase):
    """Alerting depends on this ping ARRIVING, so the task must fail closed and
    quietly — never by raising into the worker it is meant to vouch for."""

    @override_settings(BEAT_HEARTBEAT_URL="")
    def test_no_monitor_configured_is_a_no_op(self):
        """Dev and CI run without a monitor; the absence must not look like a fault."""
        self.assertFalse(ping_beat_heartbeat())

    @override_settings(BEAT_HEARTBEAT_URL="https://hc-ping.invalid/uuid")
    @patch("core.tasks.requests.get")
    def test_ping_is_sent_when_configured(self, get_mock):
        self.assertTrue(ping_beat_heartbeat())
        get_mock.assert_called_once()
        self.assertEqual(get_mock.call_args.args[0], "https://hc-ping.invalid/uuid")

    @override_settings(BEAT_HEARTBEAT_URL="https://hc-ping.invalid/uuid")
    @patch("core.tasks.requests.get", side_effect=requests.RequestException("unreachable"))
    def test_unreachable_monitor_never_raises(self, _get_mock):
        """A flaky monitor must not generate alerts about itself or burn worker
        slots on retries — the real signal is the ping that never arrives."""
        with self.assertLogs("core.tasks", level="WARNING"):
            self.assertFalse(ping_beat_heartbeat())
