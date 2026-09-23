"""
Unassigning a crew member goes through the ledger: an open fee goes with the
assignment, a settled one (paid or contracted) refuses the removal with 409.
"""
from rest_framework.test import APITestCase

from roster.models import CrewAssignment

from ..dtos import PayFeesDTO
from ..models import CostItem, FinanceAction, FinanceEvent
from ..rules import finance_today
from ..services.contracts import ContractService
from ..services.ledger import LedgerService
from .factories import make_crew, make_project, make_user, price


class CrewRemovalGuardTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.project = make_project()
        self.crew = make_crew(self.project)
        self.client.force_authenticate(self.manager)
        self.url = f"/api/crew-assignments/{self.crew.pk}/"

    def test_an_unpriced_crew_member_is_removed_as_before(self) -> None:
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertFalse(CrewAssignment.objects.filter(pk=self.crew.pk).exists())

    def test_an_open_fee_goes_with_the_assignment_and_is_logged(self) -> None:
        item = price(self.project, crew=self.crew, amount="600")

        self.assertEqual(self.client.delete(self.url).status_code, 204)

        released = CostItem.all_objects.get(pk=item.pk)
        self.assertTrue(released.is_deleted)
        self.assertIsNone(released.crew_assignment_id)
        event = FinanceEvent.objects.get(subject_id=item.pk, action=FinanceAction.REMOVED)
        self.assertEqual(event.before["crew_assignment"], str(self.crew.pk))

    def test_a_paid_fee_refuses_the_removal(self) -> None:
        item = price(self.project, crew=self.crew, amount="600")
        LedgerService.pay(self.project, PayFeesDTO(ids=(item.pk,), paid_on=finance_today()), actor=self.manager)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error_code"], "crew_has_settled_fee")
        self.assertEqual(response.data["params"]["cost_item_ids"], [str(item.pk)])
        self.assertTrue(CrewAssignment.objects.filter(pk=self.crew.pk).exists())

    def test_a_contracted_fee_refuses_until_the_contract_is_annulled(self) -> None:
        item = price(self.project, crew=self.crew, amount="600")
        contract = ContractService.issue(item, actor=self.manager)

        self.assertEqual(self.client.delete(self.url).status_code, 409)

        ContractService.annul(contract, reason="Zmiana składu", actor=self.board)
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertTrue(CostItem.all_objects.get(pk=item.pk).is_deleted)
