"""
Who may do what, and what the person themselves is given: the effective board
capability in the profile payload, and no money at all in their data export.
"""
import json

from django.test import TestCase

from core.constants import AppRole
from core.permissions import user_is_board
from core.serializers import UserProfileSerializer
from core.services import UserPreferencesService

from ..services.contracts import ContractService
from .factories import make_crew, make_project, make_seat, make_user, price


class BoardCapabilityTests(TestCase):
    def test_the_profile_reports_the_effective_board_capability(self) -> None:
        board, manager = make_user(staff=True), make_user(role=AppRole.MANAGER)

        self.assertTrue(UserProfileSerializer(board.profile).data["can_approve_finance"])
        self.assertFalse(UserProfileSerializer(manager.profile).data["can_approve_finance"])

    def test_anonymous_and_missing_users_are_not_the_board(self) -> None:
        self.assertFalse(user_is_board(None))


class PersonalExportTests(TestCase):
    def test_the_export_carries_no_money_not_even_the_persons_own(self) -> None:
        singer = make_user(role=AppRole.ARTIST)
        project = make_project(title="Nieszpory")
        item = price(project, participation=make_seat(project, user=singer), amount="300")
        ContractService.issue(item, actor=make_user())
        # An account that took a crew member's address matches nothing either.
        borrower = make_user(role=AppRole.ARTIST)
        price(project, crew=make_crew(project, email=borrower.email.upper()), amount="500")

        for user in (singer, borrower):
            export = json.dumps(UserPreferencesService.generate_gdpr_export(user, {}))
            self.assertNotIn("finance", export)
            self.assertNotIn("300.00", export)
            self.assertNotIn("500.00", export)
