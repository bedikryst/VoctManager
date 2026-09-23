"""
Who may do what, and what the person themselves is given: the effective board
capability in the profile payload, and their own fees in the data export.
"""
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
    def test_the_export_carries_the_persons_own_fees_and_contracts(self) -> None:
        singer = make_user(role=AppRole.ARTIST)
        project = make_project(title="Nieszpory")
        item = price(project, participation=make_seat(project, user=singer), amount="300")
        ContractService.issue(item, actor=make_user())
        crew_member = make_user(role=AppRole.CREW)
        price(project, crew=make_crew(project, email=crew_member.email.upper()), amount="500")
        price(project, participation=make_seat(project, "Obca", "Osoba"), amount="999")

        mine = UserPreferencesService.generate_gdpr_export(singer, {})["finance"]
        theirs = UserPreferencesService.generate_gdpr_export(crew_member, {})["finance"]

        self.assertEqual(len(mine), 1)
        self.assertEqual((mine[0]["project"], mine[0]["contract_amount"]), ("Nieszpory", "300.00"))
        self.assertEqual(mine[0]["contracts"][0]["number"][:4], "UoD/")
        self.assertEqual([record["contract_amount"] for record in theirs], ["500.00"])
