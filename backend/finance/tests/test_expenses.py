"""
Expenses — every cost that is not a person's fee: how they count in the
budget, the paid lock they share with fees, removal, the portfolio's payables
and the office's CSV.
"""
import csv
import io
from datetime import timedelta
from decimal import Decimal
from typing import Any

from rest_framework.test import APITestCase

from ..models import CostItem, CostKind, FinanceAction, FinanceEvent
from ..rules import finance_today
from ..services.budget import BudgetService
from .factories import make_project, make_seat, make_user, price


class ExpenseTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.client.force_authenticate(self.manager)
        self.project = make_project(title="Nieszpory")
        self.base = f"/api/finance/projects/{self.project.pk}"

    def create(self, **overrides: Any) -> dict[str, Any]:
        payload = {
            "category": "VENUE", "vendor_name": "Parafia św. Anny", "vendor_nip": "676-271-89-92",
            "document_type": "INVOICE", "document_number": "FV/12/2026", "cost_amount": "1200.5",
            **overrides,
        }
        response = self.client.post(f"{self.base}/expenses/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        body: dict[str, Any] = response.json()
        return body

    def test_an_expense_counts_in_the_budget_beside_the_fees(self) -> None:
        price(self.project, participation=make_seat(self.project), amount="300")

        body = self.create()

        summary = body["summary"]
        self.assertEqual(summary["committed"], "1500.50")
        self.assertEqual(summary["fees"]["committed"], "300.00")
        self.assertEqual(summary["expenses"], {"committed": "1200.50", "paid": "0.00", "outstanding": "1200.50"})
        self.assertIn({"category": "VENUE", "committed": "1200.50", "paid": "0.00"}, summary["by_category"])
        expense = body["expenses"][0]
        self.assertEqual((expense["vendor_name"], expense["vendor_nip"]), ("Parafia św. Anny", "6762718992"))
        self.assertEqual(expense["incurred_on"], body["ledger"][0]["incurred_on"])

    def test_the_document_date_is_the_cost_date_unless_one_is_given(self) -> None:
        body = self.create(document_date="2026-05-04")
        self.assertEqual(body["expenses"][0]["incurred_on"], "2026-05-04")

    def test_a_person_is_never_an_expense(self) -> None:
        response = self.client.post(f"{self.base}/expenses/", {
            "category": "PERSONNEL_TECHNICAL", "vendor_name": "Studio", "document_type": "INVOICE",
            "cost_amount": "100",
        }, format="json")

        self.assertEqual(response.status_code, 400)

    def test_a_paid_expense_keeps_its_amount_until_the_board_reverts_the_payment(self) -> None:
        expense_id = self.create()["expenses"][0]["id"]
        paid = self.client.post(f"{self.base}/expenses/pay/", {
            "ids": [expense_id], "paid_on": finance_today().isoformat(),
        }, format="json").json()
        self.assertEqual(paid["summary"]["expenses"]["paid"], "1200.50")

        response = self.client.patch(f"{self.base}/expenses/{expense_id}/", {"cost_amount": "999"}, format="json")
        self.assertEqual(response.json()["error_code"], "item_paid")
        # What does not change what was paid stays editable.
        response = self.client.patch(f"{self.base}/expenses/{expense_id}/", {"note": "zaliczka"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.delete(f"{self.base}/expenses/{expense_id}/").json()["error_code"],
                         "item_paid_not_removable")

        self.client.force_authenticate(self.board)
        self.client.post(f"/api/finance/cost-items/{expense_id}/unpay/", {"reason": "Zła kwota"}, format="json")
        response = self.client.patch(f"{self.base}/expenses/{expense_id}/", {"cost_amount": "999"}, format="json")
        self.assertEqual(response.json()["expenses"][0]["cost_amount"], "999.00")
        self.assertTrue(FinanceEvent.objects.filter(subject_id=expense_id, action=FinanceAction.PRICED).exists())

    def test_paying_a_fee_through_the_expense_door_is_refused(self) -> None:
        fee = price(self.project, participation=make_seat(self.project), amount="300")

        response = self.client.post(f"{self.base}/expenses/pay/", {
            "ids": [str(fee.pk)], "paid_on": finance_today().isoformat(),
        }, format="json")

        self.assertEqual(response.json()["params"]["refused"], [{"id": str(fee.pk), "reason": "unknown"}])

    def test_a_removed_expense_leaves_the_budget_and_stays_in_the_record(self) -> None:
        expense_id = self.create()["expenses"][0]["id"]

        body = self.client.delete(f"{self.base}/expenses/{expense_id}/").json()

        self.assertEqual(body["expenses"], [])
        self.assertEqual(body["summary"]["committed"], "0.00")
        self.assertTrue(CostItem.all_objects.get(pk=expense_id).is_deleted)
        self.assertTrue(FinanceEvent.objects.filter(subject_id=expense_id, action=FinanceAction.REMOVED).exists())

    def test_a_new_category_leaves_a_line_of_the_old_one(self) -> None:
        line = self.client.post(f"{self.base}/lines/", {
            "category": "VENUE", "name": "Kościół", "unit": "SERVICE", "quantity": "1", "unit_cost": "1500",
        }, format="json").json()["lines"][0]
        expense_id = self.create(budget_line=line["id"])["expenses"][0]["id"]

        body = self.client.patch(f"{self.base}/expenses/{expense_id}/", {"category": "PROMOTION"},
                                 format="json").json()

        self.assertIsNone(body["expenses"][0]["budget_line_id"])

    def test_an_overdue_expense_is_work(self) -> None:
        expense_id = self.create(due_on=(finance_today() - timedelta(days=1)).isoformat())["expenses"][0]["id"]

        warnings = {warning.code: warning for warning in BudgetService.build(self.project).warnings}

        self.assertEqual([str(subject) for subject in warnings["PAYMENT_OVERDUE"].subject_ids], [expense_id])

    def test_an_unpaid_expense_is_a_payable_under_its_vendor(self) -> None:
        self.create(description="Wynajem na koncert")

        payables = self.client.get("/api/finance/overview/").json()["payables"]["results"]

        self.assertEqual(len(payables), 1)
        payable = payables[0]
        self.assertEqual((payable["kind"], payable["vendor_name"], payable["description"]),
                         (CostKind.EXPENSE, "Parafia św. Anny", "Wynajem na koncert"))

    def test_the_offices_csv_lists_the_expense_with_its_document_and_line(self) -> None:
        line = self.client.post(f"{self.base}/lines/", {
            "category": "VENUE", "name": "Wynajem kościoła", "unit": "SERVICE", "quantity": "1", "unit_cost": "1500",
        }, format="json").json()["lines"][0]
        self.create(budget_line=line["id"])

        response: Any = self.client.get(f"{self.base}/export/ledger.csv")

        body = b"".join(response.streaming_content).decode("utf-8")[1:]
        header, row = list(csv.reader(io.StringIO(body), delimiter=";"))
        self.assertEqual(header[17], "Pozycja kosztorysu")
        self.assertEqual((row[2], row[5], row[6], row[12], row[15]),
                         ("Parafia św. Anny", "Faktura", "FV/12/2026", "1200,50", "6762718992"))
        self.assertEqual(row[17], "I.1 Wynajem kościoła")

    def test_the_budget_total_the_project_card_reads_includes_expenses(self) -> None:
        self.create(cost_amount="80")

        self.assertEqual(BudgetService.build(self.project).summary.committed, Decimal("80.00"))
