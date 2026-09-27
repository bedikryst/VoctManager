"""
The rollout gate for the singer's own vocal-range self-report prompt
(`VOCAL_RANGE_PROMPT`, read from the root `.env`) — see
docs/specs/vocal-range-self-report-2026-09.md ("Rollout").

Three shapes the env var can take (`off`, `all`, a comma-separated list of user
IDs) and the failure mode that matters most: a malformed value must never
crash a profile read, because a typo in prod `.env` would otherwise take down
every logged-in request instead of just leaving the prompt off.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from core.permissions import vocal_range_prompt_enabled_for

User = get_user_model()


class VocalRangePromptFlagUnitTests(TestCase):
    """Direct tests of the parsing function, independent of the API surface."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="flag-singer", email="flag-singer@test.pl", password="pw123456",
        )

    def test_anonymous_never_enabled(self) -> None:
        anon = type("Anon", (), {"is_authenticated": False})()
        with override_settings(VOCAL_RANGE_PROMPT="all"):
            self.assertFalse(vocal_range_prompt_enabled_for(anon))
        self.assertFalse(vocal_range_prompt_enabled_for(None))

    def test_default_is_off(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT="off"):
            self.assertFalse(vocal_range_prompt_enabled_for(self.user))

    def test_all_enables_everybody(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT="all"):
            self.assertTrue(vocal_range_prompt_enabled_for(self.user))

    def test_all_is_case_insensitive(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT="ALL"):
            self.assertTrue(vocal_range_prompt_enabled_for(self.user))

    def test_id_list_enables_only_named_users(self) -> None:
        other = User.objects.create_user(
            username="flag-other", email="flag-other@test.pl", password="pw123456",
        )
        with override_settings(VOCAL_RANGE_PROMPT=f"{self.user.id},{other.id + 1}"):
            self.assertTrue(vocal_range_prompt_enabled_for(self.user))
            self.assertFalse(vocal_range_prompt_enabled_for(other))

    def test_whitespace_around_ids_is_tolerated(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT=f"  {self.user.id} , 999999  "):
            self.assertTrue(vocal_range_prompt_enabled_for(self.user))

    def test_malformed_entries_are_ignored_not_fatal(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT=f"not-a-number,,{self.user.id}"):
            self.assertTrue(vocal_range_prompt_enabled_for(self.user))
        # Junk alone: nobody matches, but it does not raise.
        with override_settings(VOCAL_RANGE_PROMPT="not-a-number,also-junk"):
            self.assertFalse(vocal_range_prompt_enabled_for(self.user))

    def test_blank_value_behaves_like_off(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT=""):
            self.assertFalse(vocal_range_prompt_enabled_for(self.user))


class VocalRangePromptProfilePayloadTests(APITestCase):
    """The flag as the panel actually reads it: on the user's own profile."""

    ME_URL = "/api/users/me/"

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="flag-profile", email="flag-profile@test.pl", password="pw123456",
        )
        UserProfile.objects.create(user=self.user, role=AppRole.ARTIST)
        self.client.force_authenticate(self.user)

    def test_off_by_default(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT="off"):
            response = self.client.get(self.ME_URL)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["profile"]["vocal_range_prompt_enabled"])

    def test_flag_on_for_listed_id(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT=str(self.user.id)):
            response = self.client.get(self.ME_URL)
        self.assertTrue(response.data["profile"]["vocal_range_prompt_enabled"])

    def test_flag_read_only_via_patch(self) -> None:
        with override_settings(VOCAL_RANGE_PROMPT="off"):
            response = self.client.patch(
                self.ME_URL, {"profile": {"vocal_range_prompt_enabled": True}}, format="json",
            )
        self.assertIn(response.status_code, (200, 400))
        with override_settings(VOCAL_RANGE_PROMPT="off"):
            after = self.client.get(self.ME_URL)
        self.assertFalse(after.data["profile"]["vocal_range_prompt_enabled"])
