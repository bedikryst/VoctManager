"""A member added without an e-mail address.

Some members will not use the app, and the ensemble still has to cast, price
and brief them. They are added as ordinary Artists — an account, a roster row,
a participation like anyone's — with the one difference that nothing is sent,
because there is nowhere to send it.

What is pinned here is the consent: being without an address is only ever the
result of the explicit `without_email` flag at creation. A blank field on its
own is refused, a cleared field on edit is refused, and adding an address later
is the one way out, which invites them exactly as a new member would be.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from roster.dtos import ArtistCreateDTO
from roster.exceptions import ActivationResendException
from roster.models import Artist, VoiceType
from roster.services import ArtistHRService

EMAIL_TASK = "core.services.send_transactional_email_task.delay"


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "first_name": "Jan",
        "last_name": "Bezmailowy",
        "voice_type": VoiceType.BASS,
    }
    payload.update(overrides)
    return payload


class WithoutEmailDTOTests(TestCase):
    """The address and the waiver have to agree before anything is written."""

    def test_waiver_without_an_address_is_accepted(self) -> None:
        dto = ArtistCreateDTO(**_payload(without_email=True))
        self.assertIsNone(dto.email)

    def test_blank_address_under_the_waiver_normalizes_to_none(self) -> None:
        dto = ArtistCreateDTO(**_payload(without_email=True, email="  "))
        self.assertIsNone(dto.email)

    def test_missing_address_without_the_waiver_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            ArtistCreateDTO(**_payload())
        with self.assertRaises(ValueError):
            ArtistCreateDTO(**_payload(email=""))

    def test_address_alongside_the_waiver_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            ArtistCreateDTO(**_payload(without_email=True, email="jan@test.pl"))


class WithoutEmailProvisioningTests(TestCase):
    """Same account and roster row as anyone else, and nothing sent."""

    def _provision(self, **overrides: object) -> Artist:
        dto = ArtistCreateDTO(**_payload(without_email=True, **overrides))
        with self.captureOnCommitCallbacks(execute=True):
            return ArtistHRService.provision_artist(dto)

    @patch(EMAIL_TASK)
    def test_provisions_an_unactivated_account_and_sends_nothing(self, enqueue: MagicMock) -> None:
        artist = self._provision()

        self.assertEqual(artist.email, "")
        self.assertIsNone(artist.activation_email_sent_at)
        user = artist.user
        assert user is not None  # provisioning always links an account; narrows for mypy
        self.assertEqual(user.email, "")
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        enqueue.assert_not_called()

    @patch(EMAIL_TASK)
    def test_two_members_without_an_address_do_not_collide(self, enqueue: MagicMock) -> None:
        first = self._provision(first_name="Jan")
        second = self._provision(first_name="Piotr")

        self.assertNotEqual(first.pk, second.pk)
        self.assertEqual(Artist.objects.filter(email="").count(), 2)

    @patch(EMAIL_TASK)
    def test_resending_an_invitation_is_refused(self, enqueue: MagicMock) -> None:
        artist = self._provision()

        with self.assertRaises(ActivationResendException):
            ArtistHRService.resend_activation(artist)

        enqueue.assert_not_called()
        artist.refresh_from_db()
        self.assertIsNone(artist.activation_email_sent_at)


class WithoutEmailAPITests(APITestCase):
    """The manager's endpoints: the flag on create, the guard on edit."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("noemail-mgr", "noemail-mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.client.force_authenticate(user=self.manager)

    def _create_without_email(self) -> Artist:
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/artists/", _payload(without_email=True), format="json"
            )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["email"], "")
        return Artist.objects.get(pk=response.data["id"])

    @patch(EMAIL_TASK)
    def test_create_with_the_flag_succeeds_silently(self, enqueue: MagicMock) -> None:
        self._create_without_email()
        enqueue.assert_not_called()

    @patch(EMAIL_TASK)
    def test_create_with_a_blank_address_and_no_flag_is_refused(self, enqueue: MagicMock) -> None:
        response = self.client.post("/api/artists/", _payload(email=""), format="json")

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Artist.objects.filter(last_name="Bezmailowy").exists())
        enqueue.assert_not_called()

    @patch(EMAIL_TASK)
    def test_resend_endpoint_refuses_a_member_without_an_address(self, enqueue: MagicMock) -> None:
        artist = self._create_without_email()

        response = self.client.post(f"/api/artists/{artist.pk}/resend-activation/")

        self.assertEqual(response.status_code, 400, response.data)
        enqueue.assert_not_called()

    @patch(EMAIL_TASK)
    def test_editing_other_fields_keeps_the_member_without_an_address(self, enqueue: MagicMock) -> None:
        artist = self._create_without_email()

        response = self.client.patch(
            f"/api/artists/{artist.pk}/",
            {"email": "", "voice_type": VoiceType.BARITONE},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        artist.refresh_from_db()
        self.assertEqual(artist.voice_type, VoiceType.BARITONE)
        self.assertEqual(artist.email, "")
        enqueue.assert_not_called()

    @patch(EMAIL_TASK)
    def test_adding_an_address_later_invites_them(self, enqueue: MagicMock) -> None:
        artist = self._create_without_email()

        response = self.client.patch(
            f"/api/artists/{artist.pk}/", {"email": "jan@test.pl"}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        artist.refresh_from_db()
        self.assertEqual(artist.email, "jan@test.pl")
        assert artist.user is not None  # narrows for mypy
        self.assertEqual(artist.user.email, "jan@test.pl")
        self.assertIsNotNone(artist.activation_email_sent_at)
        enqueue.assert_called_once()
        self.assertEqual(enqueue.call_args.kwargs["template_name"], "account_activation")
        self.assertEqual(enqueue.call_args.kwargs["recipient_email"], "jan@test.pl")

    @patch(EMAIL_TASK)
    def test_clearing_an_existing_address_is_refused(self, enqueue: MagicMock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            created = self.client.post(
                "/api/artists/", _payload(email="jan@test.pl"), format="json"
            )
        self.assertEqual(created.status_code, 201, created.data)
        enqueue.reset_mock()

        response = self.client.patch(
            f"/api/artists/{created.data['id']}/", {"email": ""}, format="json"
        )

        self.assertEqual(response.status_code, 400, response.data)
        artist = Artist.objects.get(pk=created.data["id"])
        self.assertEqual(artist.email, "jan@test.pl")
        assert artist.user is not None  # narrows for mypy
        self.assertEqual(artist.user.email, "jan@test.pl")
        enqueue.assert_not_called()
