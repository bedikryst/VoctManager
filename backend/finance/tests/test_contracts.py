"""
Contracts as data: issuing with a number per (form, year), one live contract
per item, signing, a mandate's hours, and the board's annulment.
"""
from typing import Any

from rest_framework.test import APITestCase

from ..models import Contract, ContractSequence, ContractStatus, CostItem, FeeForm, FinanceAction, FinanceEvent
from ..rules import finance_today
from .factories import make_crew, make_project, make_seat, make_user, price


class ContractTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.project = make_project()
        self.year = finance_today().year
        self.client.force_authenticate(self.manager)

    def issue(self, item: CostItem) -> Any:
        return self.client.post(f"/api/finance/cost-items/{item.pk}/contract/", format="json")

    def post(self, path: str, payload: dict[str, str]) -> Any:
        return self.client.post(f"/api/finance/{path}", payload, format="json")

    def priced_seat(self, amount: str = "300") -> CostItem:
        seat = make_seat(self.project, "Anna", f"Nowak-{CostItem.objects.count()}")
        return price(self.project, participation=seat, amount=amount)

    def test_each_form_is_numbered_on_its_own_sequence(self) -> None:
        items = [
            self.priced_seat(), self.priced_seat("310"), self.priced_seat("0"),
            price(self.project, crew=make_crew(self.project), amount="500"),
        ]

        for item in items:
            self.assertEqual(self.issue(item).status_code, 201)

        self.assertEqual(set(Contract.objects.values_list("number", flat=True)), {
            f"UoD/1/{self.year}", f"UoD/2/{self.year}", f"W/1/{self.year}", f"UZ/1/{self.year}",
        })

    def test_numbering_continues_from_the_sequence_row(self) -> None:
        ContractSequence.objects.create(year=self.year, form=FeeForm.DZIELO, last_number=41)

        self.issue(self.priced_seat())

        self.assertTrue(Contract.objects.filter(number=f"UoD/42/{self.year}").exists())

    def test_the_contract_freezes_amount_and_payee(self) -> None:
        item = self.priced_seat("450")

        response = self.issue(item)

        contract = Contract.objects.get()
        self.assertEqual((contract.amount, contract.payee_name), (item.contract_amount, item.payee_name))
        [row] = [row for row in response.data["ledger"] if row["contract"]]
        self.assertEqual(row["contract"]["number"], f"UoD/1/{self.year}")
        self.assertTrue(
            FinanceEvent.objects.filter(subject_id=contract.pk, action=FinanceAction.CONTRACT_ISSUED).exists()
        )

    def test_an_invoice_an_unpriced_item_and_a_second_contract_are_refused(self) -> None:
        invoice = price(self.project, crew=make_crew(self.project, company_name="Firma"), amount="900")
        unpriced = price(self.project, crew=make_crew(self.project, "Ewa", "Bezkwoty"), amount=None, form="DZIELO")
        item = self.priced_seat()
        self.issue(item)

        self.assertEqual(self.issue(invoice).data["error_code"], "contract_refused")
        self.assertEqual(self.issue(unpriced).data["error_code"], "contract_refused")
        self.assertEqual(self.issue(item).data["error_code"], "contract_exists")

    def test_signing_records_the_paper(self) -> None:
        self.issue(self.priced_seat())
        contract = Contract.objects.get()

        response = self.post(f"contracts/{contract.pk}/sign/", {
            "signed_on": finance_today().isoformat(), "signed_copy_location": "segregator 2026",
        })

        self.assertEqual(response.status_code, 200)
        contract.refresh_from_db()
        self.assertEqual((contract.status, contract.signed_copy_location), (ContractStatus.SIGNED, "segregator 2026"))

    def test_hours_are_for_a_mandate_only(self) -> None:
        self.issue(price(self.project, crew=make_crew(self.project), amount="500"))
        self.issue(self.priced_seat())
        zlecenie = Contract.objects.get(form=FeeForm.ZLECENIE)
        dzielo = Contract.objects.get(form=FeeForm.DZIELO)

        ok = self.post(f"contracts/{zlecenie.pk}/hours/", {"hours_confirmed": "12.5"})
        refused = self.post(f"contracts/{dzielo.pk}/hours/", {"hours_confirmed": "3"})

        self.assertEqual(ok.status_code, 200)
        self.assertEqual(refused.data["error_code"], "hours_not_applicable")

    def test_annulment_is_the_boards_and_the_number_stays_spent(self) -> None:
        item = self.priced_seat()
        self.issue(item)
        contract = Contract.objects.get()
        annul = f"contracts/{contract.pk}/annul/"

        self.assertEqual(self.post(annul, {"reason": "Zła kwota"}).status_code, 403)
        self.client.force_authenticate(self.board)
        self.assertEqual(self.post(annul, {"reason": "Zła kwota"}).status_code, 200)

        contract.refresh_from_db()
        self.assertEqual(contract.status, ContractStatus.ANNULLED)
        event = FinanceEvent.objects.get(subject_id=contract.pk, action=FinanceAction.CONTRACT_ANNULLED)
        self.assertEqual((event.reason, event.actor), ("Zła kwota", self.board))

        # The amount is editable again, and the new contract takes the next number.
        self.issue(price(self.project, item=item, amount="320"))
        self.assertEqual(
            set(Contract.objects.values_list("number", flat=True)), {f"UoD/1/{self.year}", f"UoD/2/{self.year}"},
        )
        self.assertEqual(self.post(annul, {"reason": "again"}).data["error_code"], "contract_annulled")
