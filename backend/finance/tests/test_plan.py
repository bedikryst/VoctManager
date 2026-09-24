"""
The plan (kosztorys) and the budget's standing: lines and their numbers, what a
fee is charged to, the two plan warnings, and the board's approve → reopen →
close path with the locks each state holds — including the short path of a
budget with no plan, and the awarded grant that forbids it.
"""
from decimal import Decimal
from typing import Any

from rest_framework.test import APITestCase

from ..dtos import BudgetLineDTO, ExpenseDTO, FundingSourceDTO, PayFeesDTO, ProjectFundingDTO
from ..models import BudgetLine, BudgetStatus, CostItem, FinanceAction, FinanceEvent
from ..rules import finance_today
from ..services.budget import BudgetService
from ..services.expenses import ExpenseService
from ..services.funding import FundingService
from ..services.ledger import LedgerService
from ..services.plan import PlanService
from .factories import make_crew, make_project, make_seat, make_user, price


def _line(project: Any, name: str, category: str = "VENUE", quantity: str = "1", unit_cost: str = "1000") -> BudgetLine:
    dto = BudgetLineDTO(category=category, name=name, unit="SERVICE", quantity=Decimal(quantity),
                        unit_cost=Decimal(unit_cost))
    return PlanService.create_line(project, dto, actor=None)


def _grant(project: Any, *, status: str, name: str = "Dotacja MKiDN") -> None:
    source = FundingService.create_source(FundingSourceDTO.model_validate({
        "kind": "PUBLIC_GRANT", "name": name, "status": status,
    }), actor=None)
    FundingService.add_funding(project, ProjectFundingDTO.model_validate({"source": str(source.pk)}), actor=None)


def _expense(project: Any, amount: str = "500", category: str = "VENUE", **extra: Any) -> CostItem:
    dto = ExpenseDTO.model_validate({
        "category": category, "vendor_name": "Parafia", "document_type": "INVOICE",
        "cost_amount": amount, **extra,
    })
    return ExpenseService.create(project, dto, actor=None)


class PlanLineTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.client.force_authenticate(self.manager)
        self.project = make_project()
        self.base = f"/api/finance/projects/{self.project.pk}"

    def test_a_line_is_worth_quantity_times_unit_cost_and_is_numbered_by_section(self) -> None:
        response = self.client.post(f"{self.base}/lines/", {
            "category": "PERSONNEL_ARTISTIC", "name": "Honoraria chórzystów", "unit": "PERSON",
            "quantity": "8", "unit_cost": "412.50",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        _line(self.project, "Księgowość", category="ADMINISTRATION", unit_cost="300")
        _line(self.project, "Wynajem kościoła", category="VENUE")

        lines = BudgetService.build(self.project).lines

        self.assertEqual(
            [(line.number, line.name) for line in lines],
            [("I.1", "Honoraria chórzystów"), ("I.2", "Wynajem kościoła"), ("II.1", "Księgowość")],
        )
        self.assertEqual(lines[0].planned_amount, Decimal("3300.00"))
        self.assertEqual(BudgetService.build(self.project).summary.planned, Decimal("4600.00"))

    def test_reordering_renumbers_within_a_category_and_names_every_line(self) -> None:
        first, second = _line(self.project, "Kościół"), _line(self.project, "Sala prób")

        response = self.client.post(f"{self.base}/lines/reorder/", {"ids": [str(second.pk)]}, format="json")
        self.assertEqual(response.json()["error_code"], "line_order_mismatch")

        self.client.post(f"{self.base}/lines/reorder/", {"ids": [str(second.pk), str(first.pk)]}, format="json")
        names = [line.name for line in BudgetService.build(self.project).lines]
        self.assertEqual(names, ["Sala prób", "Kościół"])

    def test_a_product_past_the_ledgers_range_is_refused(self) -> None:
        response = self.client.post(f"{self.base}/lines/", {
            "category": "VENUE", "name": "Za dużo", "unit": "DAY", "quantity": "999999", "unit_cost": "99999999",
        }, format="json")

        self.assertEqual(response.json()["error_code"], "plan_amount_too_large")

    def test_removing_a_line_leaves_its_costs_outside_the_plan_and_logs_both(self) -> None:
        line = _line(self.project, "Kościół")
        expense = _expense(self.project, budget_line=str(line.pk))

        self.client.delete(f"{self.base}/lines/{line.pk}/")

        expense.refresh_from_db()
        self.assertIsNone(expense.budget_line_id)
        self.assertTrue(FinanceEvent.objects.filter(subject_id=line.pk, action=FinanceAction.REMOVED).exists())
        self.assertTrue(FinanceEvent.objects.filter(subject_id=expense.pk, action=FinanceAction.DETAILS_CHANGED)
                        .exists())

    def test_a_cost_is_charged_only_to_a_line_of_its_own_category(self) -> None:
        catering = _line(self.project, "Catering", category="CATERING")

        response = self.client.post(f"{self.base}/expenses/", {
            "category": "VENUE", "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": "200",
            "budget_line": str(catering.pk),
        }, format="json")

        self.assertEqual(response.json()["error_code"], "plan_line_category_mismatch")


class FeeChargeTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.client.force_authenticate(self.manager)
        self.project = make_project()

    def test_a_newly_priced_fee_takes_the_only_line_of_its_category(self) -> None:
        line = _line(self.project, "Honoraria", category="PERSONNEL_ARTISTIC")

        item = price(self.project, participation=make_seat(self.project), amount="300")

        self.assertEqual(item.budget_line_id, line.pk)

    def test_with_two_lines_of_its_category_the_fee_waits_outside_the_plan(self) -> None:
        _line(self.project, "Chór", category="PERSONNEL_ARTISTIC")
        _line(self.project, "Dyrygent", category="PERSONNEL_ARTISTIC")

        item = price(self.project, participation=make_seat(self.project), amount="300")

        self.assertIsNone(item.budget_line_id)
        warnings = {warning.code: warning for warning in BudgetService.build(self.project).warnings}
        self.assertEqual(warnings["COST_OUTSIDE_PLAN"].subject_ids, [item.participation_id])

    def test_charging_a_line_takes_the_priced_fees_its_category_left_outside(self) -> None:
        earlier = price(self.project, participation=make_seat(self.project, "Anna", "Nowak"), amount="300")
        make_seat(self.project, "Bez", "Stawki")
        line = _line(self.project, "Honoraria", category="PERSONNEL_ARTISTIC")

        self.client.post(f"/api/finance/projects/{self.project.pk}/lines/{line.pk}/charge/")

        earlier.refresh_from_db()
        self.assertEqual(earlier.budget_line_id, line.pk)
        plan_line = BudgetService.build(self.project).lines[0]
        self.assertEqual((plan_line.actual, plan_line.cost_count), (Decimal("300.00"), 1))

    def test_a_fees_line_is_set_through_its_details(self) -> None:
        item = price(self.project, participation=make_seat(self.project), amount="300")
        _line(self.project, "Chór", category="PERSONNEL_ARTISTIC")
        conductor = _line(self.project, "Dyrygent", category="PERSONNEL_ARTISTIC")

        response = self.client.patch(
            f"/api/finance/cost-items/{item.pk}/", {"budget_line": str(conductor.pk)}, format="json",
        )

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.budget_line_id, conductor.pk)


class PlanWarningTests(APITestCase):
    def setUp(self) -> None:
        self.project = make_project()

    def codes(self) -> dict[str, list[Any]]:
        return {warning.code: warning.subject_ids for warning in BudgetService.build(self.project).warnings}

    def test_a_cost_outside_the_plan_is_work_only_once_the_budget_has_a_plan(self) -> None:
        expense = _expense(self.project)
        price(self.project, participation=make_seat(self.project), amount="0")
        self.assertNotIn("COST_OUTSIDE_PLAN", self.codes())

        line = _line(self.project, "Kościół")

        # The volunteer's 0 is no cost to place; the expense is.
        self.assertEqual(self.codes()["COST_OUTSIDE_PLAN"], [expense.pk])
        PlanService.charge_unplanned(line, actor=None)
        self.assertNotIn("COST_OUTSIDE_PLAN", self.codes())

    def test_a_line_over_its_plan(self) -> None:
        line = _line(self.project, "Kościół", unit_cost="400")
        _expense(self.project, amount="400", budget_line=str(line.pk))
        self.assertNotIn("LINE_OVER_PLAN", self.codes())

        _expense(self.project, amount="0.01", budget_line=str(line.pk))

        self.assertEqual(self.codes()["LINE_OVER_PLAN"], [line.pk])


class BudgetStandingTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.project = make_project()
        self.base = f"/api/finance/projects/{self.project.pk}"

    def as_board(self) -> None:
        self.client.force_authenticate(self.board)

    def as_manager(self) -> None:
        self.client.force_authenticate(self.manager)

    def status(self) -> str:
        return str(BudgetService.get_or_create(self.project).status)

    def test_only_the_board_moves_the_budget(self) -> None:
        self.as_manager()
        for act in ("approve", "close"):
            self.assertEqual(self.client.post(f"{self.base}/budget/{act}/").status_code, 403)
        self.assertEqual(self.client.post(f"{self.base}/budget/reopen/", {"reason": "x"}, format="json").status_code,
                         403)

    def test_an_approved_plan_is_locked_until_the_board_reopens_it_with_a_reason(self) -> None:
        line = _line(self.project, "Kościół")
        self.as_board()
        self.assertEqual(self.client.post(f"{self.base}/budget/approve/").status_code, 200)
        self.assertEqual(self.status(), BudgetStatus.APPROVED)

        self.as_manager()
        response = self.client.patch(f"{self.base}/lines/{line.pk}/", {"unit_cost": "2000"}, format="json")
        self.assertEqual(response.json()["error_code"], "plan_locked")
        # Actuals are still recorded in an approved budget.
        self.assertEqual(self.client.post(f"{self.base}/expenses/", {
            "category": "VENUE", "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": "900",
        }, format="json").status_code, 201)

        self.as_board()
        self.assertEqual(self.client.post(f"{self.base}/budget/reopen/", {}, format="json").status_code, 400)
        self.client.post(f"{self.base}/budget/reopen/", {"reason": "Korekta: droższy kościół"}, format="json")
        self.assertEqual(self.status(), BudgetStatus.PLANNING)
        event = FinanceEvent.objects.get(action=FinanceAction.BUDGET_REOPENED)
        self.assertEqual((event.before["status"], event.reason), ("APPROVED", "Korekta: droższy kościół"))

        self.as_manager()
        response = self.client.patch(f"{self.base}/lines/{line.pk}/", {"unit_cost": "2000"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_closing_waits_for_every_cost_to_be_settled_and_then_locks_everything(self) -> None:
        _line(self.project, "Honoraria", category="PERSONNEL_ARTISTIC", unit_cost="300")
        item = price(self.project, participation=make_seat(self.project), amount="300")
        self.as_board()
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").json()["error_code"], "plan_not_approved")
        self.client.post(f"{self.base}/budget/approve/")

        response = self.client.post(f"{self.base}/budget/close/")
        self.assertEqual(response.json()["error_code"], "budget_has_open_items")
        self.assertEqual(response.json()["params"]["outstanding"], "300.00")

        LedgerService.pay(self.project, PayFeesDTO(ids=(item.pk,), paid_on=finance_today()), actor=self.manager)
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").status_code, 200)
        self.assertEqual(self.status(), BudgetStatus.CLOSED)
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").json()["error_code"],
                         "budget_transition_refused")

        self.as_manager()
        response = self.client.post(f"{self.base}/expenses/", {
            "category": "VENUE", "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": "900",
        }, format="json")
        self.assertEqual(response.json()["error_code"], "budget_locked")

        self.as_board()
        self.client.post(f"{self.base}/budget/reopen/", {"reason": "Zaległa faktura"}, format="json")
        self.assertEqual(self.status(), BudgetStatus.APPROVED)

    def test_an_empty_plan_is_not_approved(self) -> None:
        self.as_board()

        response = self.client.post(f"{self.base}/budget/approve/")

        self.assertEqual(response.json()["error_code"], "plan_empty")
        self.assertEqual(self.status(), BudgetStatus.PLANNING)

    def test_a_budget_without_a_plan_closes_without_approval_and_reopens_to_planning(self) -> None:
        item = price(self.project, participation=make_seat(self.project), amount="300")
        self.as_board()
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").json()["error_code"],
                         "budget_has_open_items")

        LedgerService.pay(self.project, PayFeesDTO(ids=(item.pk,), paid_on=finance_today()), actor=self.manager)
        response = self.client.post(f"{self.base}/budget/close/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.status(), BudgetStatus.CLOSED)
        closed = FinanceEvent.objects.get(action=FinanceAction.BUDGET_CLOSED)
        self.assertEqual(closed.before["status"], "PLANNING")

        self.client.post(f"{self.base}/budget/reopen/", {"reason": "Zaległa faktura"}, format="json")
        self.assertEqual(self.status(), BudgetStatus.PLANNING)

    def test_an_awarded_grant_closes_only_through_an_approved_plan(self) -> None:
        _grant(self.project, status="APPLIED")
        self.as_board()
        self.assertFalse(self.client.get(f"{self.base}/budget/").json()["plan_required"])

        _grant(self.project, status="AWARDED", name="Dotacja miasta")
        self.assertTrue(self.client.get(f"{self.base}/budget/").json()["plan_required"])
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").json()["error_code"], "grant_needs_plan")

        _line(self.project, "Kościół")
        self.client.post(f"{self.base}/budget/approve/")
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").status_code, 200)

    def test_closing_waits_for_a_mandates_employer_contributions(self) -> None:
        item = price(self.project, crew=make_crew(self.project), amount="600")
        LedgerService.pay(self.project, PayFeesDTO(ids=(item.pk,), paid_on=finance_today()), actor=self.manager)
        self.as_board()

        response = self.client.post(f"{self.base}/budget/close/")
        self.assertEqual(response.json()["error_code"], "budget_has_open_items")
        self.assertEqual(response.json()["params"]["contributions_missing"], 1)

        price(self.project, crew=item.crew_assignment, amount="600", employer_contributions="117.18")
        self.assertEqual(self.client.post(f"{self.base}/budget/close/").status_code, 200)

    def test_the_history_names_each_act_and_its_subject(self) -> None:
        _line(self.project, "Kościół")
        self.as_board()
        self.client.post(f"{self.base}/budget/approve/")

        response = self.client.get(f"{self.base}/history/?limit=10")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 2)
        newest, oldest = body["results"]
        self.assertEqual((newest["action"], newest["actor_name"]), ("BUDGET_APPROVED", self.board.username))
        self.assertEqual((oldest["subject_type"], oldest["subject_label"]), ("budget_line", "Kościół"))
