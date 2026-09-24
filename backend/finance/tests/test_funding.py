"""
Funding (Stage 5): sources and a project's share of them, the plan's and the
actuals' split between sources and the invariants that keep each split inside
its amount, the settled lock, the grant-rule warnings, and a source's figures
across every project it funds.
"""
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.test import TestCase
from rest_framework.test import APITestCase

from core.constants import AppRole
from roster.models import Participation, Project

from ..dtos import (
    AllocationSetDTO,
    BudgetLineDTO,
    BudgetLineUpdateDTO,
    ChargeCostsDTO,
    ExpenseDTO,
    ExpenseUpdateDTO,
    FundingSourceDTO,
    FundingSourceUpdateDTO,
    ProjectFundingDTO,
    ProjectFundingUpdateDTO,
)
from ..exceptions import (
    AllocationExceedsAmount,
    AllocationKindMismatch,
    AllocationNotCounted,
    ChargeRefused,
    FundingInUse,
    PlanLocked,
    SourceInUse,
    SourceKindInUse,
    SourceSettled,
)
from ..models import (
    DEFAULT_DOCUMENT_NOTE_TEMPLATE,
    BudgetLine,
    CostAllocation,
    CostItem,
    FinanceAction,
    FinanceEvent,
    FundingSource,
    FundingStatus,
    LineAllocation,
    ProjectFunding,
)
from ..rules import finance_today
from ..services import sources
from ..services.budget import BudgetService, BudgetWarning
from ..services.expenses import ExpenseService
from ..services.funding import FundingService
from ..services.ledger import LedgerService
from ..services.plan import PlanService
from .factories import make_crew, make_project, make_seat, make_user, price


def _source(name: str = "Dotacja MKiDN", kind: str = "PUBLIC_GRANT", **rules: Any) -> FundingSource:
    return FundingService.create_source(FundingSourceDTO.model_validate({"kind": kind, "name": name, **rules}),
                                        actor=None)


def _fund(project: Project, source: FundingSource, planned: str = "0", received: str = "0") -> ProjectFunding:
    dto = ProjectFundingDTO.model_validate({
        "source": str(source.pk), "planned_amount": planned, "received_amount": received,
    })
    return FundingService.add_funding(project, dto, actor=None)


def _line(project: Project, category: str = "VENUE", quantity: str = "1", unit_cost: str = "1000") -> BudgetLine:
    dto = BudgetLineDTO(category=category, name=f"Pozycja {category}", unit="SERVICE",
                        quantity=Decimal(quantity), unit_cost=Decimal(unit_cost))
    return PlanService.create_line(project, dto, actor=None)


def _expense(project: Project, amount: str = "500", category: str = "VENUE", **extra: Any) -> CostItem:
    dto = ExpenseDTO.model_validate({
        "category": category, "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": amount, **extra,
    })
    return ExpenseService.create(project, dto, actor=None)


def _split(*pairs: tuple[ProjectFunding, str]) -> AllocationSetDTO:
    return AllocationSetDTO.model_validate({
        "allocations": [{"funding": str(funding.pk), "amount": amount} for funding, amount in pairs],
    })


def _charge(item: CostItem, *pairs: tuple[ProjectFunding, str]) -> None:
    FundingService.set_cost_allocations(item, _split(*pairs), actor=None)


def _warnings(project: Project) -> dict[str, BudgetWarning]:
    return {warning.code: warning for warning in BudgetService.build(project).warnings}


def _line_update(**values: str) -> BudgetLineUpdateDTO:
    return BudgetLineUpdateDTO.model_validate(values)


def _source_update(**values: str) -> FundingSourceUpdateDTO:
    return FundingSourceUpdateDTO.model_validate(values)


def _expense_update(**values: str) -> ExpenseUpdateDTO:
    return ExpenseUpdateDTO.model_validate(values)


class SourceApiTests(APITestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(make_user())

    def test_a_source_gets_the_default_note_and_refuses_an_unknown_placeholder(self) -> None:
        response = self.client.post("/api/finance/funding-sources/", {
            "kind": "PUBLIC_GRANT", "name": "Dotacja miasta", "awarded_amount": "12000",
        }, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["source"]["document_note_template"], DEFAULT_DOCUMENT_NOTE_TEMPLATE)

        refused = self.client.post("/api/finance/funding-sources/", {
            "kind": "PUBLIC_GRANT", "name": "Zła formuła", "document_note_template": "Kwota {kwota}",
        }, format="json")
        self.assertEqual(refused.json()["error_code"], "validation_error")

    def test_an_inverted_eligibility_period_is_refused(self) -> None:
        source = _source()

        response = self.client.patch(f"/api/finance/funding-sources/{source.pk}/", {
            "eligible_from": "2026-12-01", "eligible_to": "2026-11-01",
        }, format="json")

        self.assertEqual(response.json()["error_code"], "eligibility_period_invalid")

    def test_a_source_on_a_project_cannot_be_deleted(self) -> None:
        source = _source()
        _fund(make_project(), source)

        with self.assertRaises(SourceInUse):
            FundingService.delete_source(source, actor=None)

    def test_a_singer_reaches_no_funding_endpoint(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self.client.get("/api/finance/funding-sources/").status_code, 403)


class ProjectFundingTests(TestCase):
    def setUp(self) -> None:
        self.project = make_project()
        self.source = _source()

    def test_the_planned_amount_is_the_plan_and_the_received_one_a_fact(self) -> None:
        funding = _fund(self.project, self.source, planned="5000")
        PlanService.approve(self.project, actor=None)

        with self.assertRaises(PlanLocked):
            FundingService.update_funding(
                funding, ProjectFundingUpdateDTO(planned_amount=Decimal("6000")), actor=None,
            )
        FundingService.update_funding(funding, ProjectFundingUpdateDTO(received_amount=Decimal("2500")), actor=None)

        funding.refresh_from_db()
        self.assertEqual(funding.received_amount, Decimal("2500.00"))

    def test_a_source_arriving_after_approval_comes_with_nothing_planned(self) -> None:
        PlanService.approve(self.project, actor=None)

        with self.assertRaises(PlanLocked):
            _fund(self.project, self.source, planned="1000")
        funding = _fund(self.project, _source("Sponsor", kind="SPONSOR"), received="3000")

        self.assertEqual(funding.planned_amount, Decimal("0.00"))

    def test_a_funding_carrying_costs_stays_and_its_plan_share_goes_with_it(self) -> None:
        funding = _fund(self.project, self.source, planned="1000")
        line = _line(self.project)
        FundingService.set_line_allocations(line, _split((funding, "800")), actor=None)
        expense = _expense(self.project, budget_line=str(line.pk))
        _charge(expense, (funding, "500"))

        with self.assertRaises(FundingInUse):
            FundingService.remove_funding(funding, actor=None)
        _charge(expense)
        FundingService.remove_funding(funding, actor=None)

        self.assertFalse(LineAllocation.objects.filter(budget_line=line).exists())
        self.assertTrue(LineAllocation.all_objects.filter(budget_line=line, is_deleted=True).exists())


class SplitTests(TestCase):
    def setUp(self) -> None:
        self.project = make_project()
        self.grant = _fund(self.project, _source(), planned="10000")
        self.volunteers = _fund(self.project, _source("Wolontariat", kind="VOLUNTEER_WORK"), planned="2000")
        self.gift = _fund(self.project, _source("Kościół użyczony", kind="IN_KIND"), planned="1500")

    def test_a_line_is_split_up_to_its_planned_amount_and_the_set_is_replaced(self) -> None:
        line = _line(self.project, unit_cost="1000")

        with self.assertRaises(AllocationExceedsAmount):
            FundingService.set_line_allocations(line, _split((self.grant, "700"), (self.gift, "400")), actor=None)
        FundingService.set_line_allocations(line, _split((self.grant, "600"), (self.gift, "400")), actor=None)
        FundingService.set_line_allocations(line, _split((self.grant, "900")), actor=None)

        view = BudgetService.build(self.project).lines[0]
        self.assertEqual([(a.funding_id, a.amount) for a in view.allocations], [(self.grant.pk, Decimal("900.00"))])
        self.assertEqual(view.allocated, Decimal("900.00"))

    def test_a_line_cannot_shrink_below_its_split(self) -> None:
        line = _line(self.project, quantity="2", unit_cost="500")
        FundingService.set_line_allocations(line, _split((self.grant, "1000")), actor=None)

        response_line = BudgetLine.objects.get(pk=line.pk)
        with self.assertRaises(AllocationExceedsAmount):
            PlanService.update_line(response_line, _line_update(quantity="1"), actor=None)

    def test_the_plan_split_is_locked_with_the_plan(self) -> None:
        line = _line(self.project)
        PlanService.approve(self.project, actor=None)

        with self.assertRaises(PlanLocked):
            FundingService.set_line_allocations(line, _split((self.grant, "100")), actor=None)

    def test_a_cost_is_split_up_to_its_cost_and_only_between_sources_of_money(self) -> None:
        expense = _expense(self.project, amount="500")

        with self.assertRaises(AllocationExceedsAmount):
            _charge(expense, (self.grant, "501"))
        with self.assertRaises(AllocationKindMismatch):
            _charge(expense, (self.volunteers, "100"))
        with self.assertRaises(AllocationKindMismatch):
            _charge(expense, (self.gift, "100"))
        _charge(expense, (self.grant, "500"))

        self.assertEqual(BudgetService.build(self.project).expenses[0].allocated, Decimal("500.00"))

    def test_volunteer_work_is_charged_its_valuation_to_a_volunteer_work_source(self) -> None:
        seat = make_seat(self.project)
        item = price(self.project, participation=seat, amount="0", in_kind_hours="10", in_kind_hourly_rate="40")

        with self.assertRaises(AllocationKindMismatch):
            _charge(item, (self.grant, "100"))
        _charge(item, (self.volunteers, "400"))

        row = next(row for row in BudgetService.build(self.project).rows if row.key == seat.pk)
        self.assertEqual(row.allocatable, Decimal("400.00"))
        self.assertEqual(row.allocated, Decimal("400.00"))

    def test_repricing_below_the_split_refuses_the_batch_and_names_the_row(self) -> None:
        seat = make_seat(self.project)
        item = price(self.project, participation=seat, amount="400")
        _charge(item, (self.grant, "400"))

        with self.assertRaises(AllocationExceedsAmount) as refusal:
            price(self.project, participation=seat, amount="300")

        self.assertEqual(refusal.exception.params["ref"], str(seat.pk))
        with self.assertRaises(AllocationKindMismatch):
            price(self.project, participation=seat, amount="0")

    def test_a_cost_the_budget_does_not_count_can_only_be_taken_off_its_sources(self) -> None:
        seat = make_seat(self.project)
        item = price(self.project, participation=seat, amount="400")
        _charge(item, (self.grant, "400"))
        Participation.objects.filter(pk=seat.pk).update(status=Participation.Status.DECLINED)

        self.assertEqual(sources.measure([self.grant.source]).fundings[self.grant.pk].charged, Decimal("0.00"))
        with self.assertRaises(AllocationNotCounted):
            _charge(item, (self.grant, "200"))
        _charge(item)
        self.assertFalse(CostAllocation.objects.filter(cost_item=item).exists())

    def test_a_removed_expense_and_a_released_crew_fee_leave_their_sources(self) -> None:
        expense = _expense(self.project)
        _charge(expense, (self.grant, "500"))
        crew = make_crew(self.project)
        fee = price(self.project, crew=crew, amount="800")
        _charge(fee, (self.grant, "800"))

        ExpenseService.delete(expense, actor=None)
        LedgerService.release_crew_assignment(crew, actor=None)

        self.assertFalse(CostAllocation.objects.exists())
        event = FinanceEvent.objects.filter(subject_id=expense.pk, action=FinanceAction.ALLOCATION_CHANGED).first()
        assert event is not None
        self.assertEqual(event.after, {"allocations": []})
        self.assertEqual(event.before["allocations"][0]["source"], "Dotacja MKiDN")

    def test_charging_costs_fills_what_each_leaves_uncovered_and_refuses_as_a_whole(self) -> None:
        sponsor = _fund(self.project, _source("Sponsor", kind="SPONSOR"), planned="200")
        first, second = _expense(self.project, "500"), _expense(self.project, "300")
        _charge(first, (sponsor, "200"))
        seat = make_seat(self.project)
        volunteer = price(self.project, participation=seat, amount="0", in_kind_hours="5", in_kind_hourly_rate="30")

        with self.assertRaises(ChargeRefused) as refusal:
            FundingService.charge_costs(self.grant, ChargeCostsDTO(ids=(first.pk, volunteer.pk)), actor=None)
        self.assertEqual(refusal.exception.params["refused"], [{"id": str(volunteer.pk), "reason": "kind_mismatch"}])

        charged = FundingService.charge_costs(self.grant, ChargeCostsDTO(ids=(first.pk, second.pk)), actor=None)

        self.assertEqual(charged, 2)
        amounts = {
            (allocation.cost_item_id, allocation.project_funding_id): allocation.amount
            for allocation in CostAllocation.objects.all()
        }
        self.assertEqual(amounts[(first.pk, self.grant.pk)], Decimal("300.00"))
        self.assertEqual(amounts[(second.pk, self.grant.pk)], Decimal("300.00"))
        self.assertEqual(
            FundingService.charge_costs(self.grant, ChargeCostsDTO(ids=(first.pk,)), actor=None), 0,
        )


class SettledSourceTests(TestCase):
    def test_what_is_charged_to_a_settled_source_no_longer_changes(self) -> None:
        project = make_project()
        source = _source()
        funding = _fund(project, source, planned="1000")
        expense = _expense(project)
        _charge(expense, (funding, "400"))
        FundingService.update_source(source, _source_update(status=FundingStatus.SETTLED), actor=None)

        with self.assertRaises(SourceSettled):
            _charge(expense, (funding, "300"))
        with self.assertRaises(SourceSettled):
            ExpenseService.delete(expense, actor=None)
        with self.assertRaises(SourceSettled):
            FundingService.update_funding(funding, ProjectFundingUpdateDTO(received_amount=Decimal("1")), actor=None)

    def test_a_settled_source_keeps_its_figures_and_its_costs_their_date_and_category(self) -> None:
        project = make_project()
        source = _source(awarded_amount="5000")
        funding = _fund(project, source, planned="1000")
        expense = _expense(project)
        _charge(expense, (funding, "400"))
        FundingService.update_source(source, _source_update(status=FundingStatus.SETTLED), actor=None)

        with self.assertRaises(SourceSettled):
            FundingService.update_source(source, _source_update(awarded_amount="6000"), actor=None)
        with self.assertRaises(SourceSettled):
            ExpenseService.update(expense, _expense_update(category="TRAVEL"), actor=None)
        with self.assertRaises(SourceSettled):
            ExpenseService.update(expense, _expense_update(document_date=str(finance_today())), actor=None)
        FundingService.update_source(source, _source_update(note="Rozliczone w terminie"), actor=None)
        ExpenseService.update(expense, _expense_update(document_number="FV/1/2026"), actor=None)

        # Reopening and correcting in one save is allowed.
        FundingService.update_source(
            source, _source_update(status=FundingStatus.AWARDED, awarded_amount="6000"), actor=None,
        )
        source.refresh_from_db()
        self.assertEqual(source.awarded_amount, Decimal("6000.00"))


class SourceKindTests(TestCase):
    def test_a_source_carrying_charges_keeps_a_kind_that_accepts_them(self) -> None:
        project = make_project()
        source = _source()
        funding = _fund(project, source)
        fee = price(project, participation=make_seat(project), amount="5000")
        _charge(fee, (funding, "5000"))

        with self.assertRaises(SourceKindInUse):
            FundingService.update_source(source, _source_update(kind="VOLUNTEER_WORK"), actor=None)
        FundingService.update_source(source, _source_update(kind="SPONSOR"), actor=None)

        CostAllocation.objects.filter(cost_item=fee).delete()
        FundingService.update_source(source, _source_update(kind="VOLUNTEER_WORK"), actor=None)
        source.refresh_from_db()
        self.assertEqual(source.kind, "VOLUNTEER_WORK")


class FundingWarningTests(TestCase):
    def setUp(self) -> None:
        self.project = make_project(days=20)

    def test_overallocation_by_plan_by_charges_and_by_the_award(self) -> None:
        funding = _fund(self.project, _source(awarded_amount="3000"), planned="1000")
        line = _line(self.project, unit_cost="2000")
        FundingService.set_line_allocations(line, _split((funding, "1500")), actor=None)

        self.assertEqual(_warnings(self.project)["SOURCE_OVERALLOCATED"].subject_ids, [funding.pk])
        FundingService.set_line_allocations(line, _split((funding, "1000")), actor=None)
        self.assertNotIn("SOURCE_OVERALLOCATED", _warnings(self.project))

        expense = _expense(self.project, amount="1200")
        _charge(expense, (funding, "1200"))
        self.assertIn("SOURCE_OVERALLOCATED", _warnings(self.project))
        FundingService.update_funding(funding, ProjectFundingUpdateDTO(received_amount=Decimal("1200")), actor=None)
        self.assertNotIn("SOURCE_OVERALLOCATED", _warnings(self.project))

        # The award is shared with a second concert that expects more of it.
        _fund(make_project(days=40), funding.source, planned="2500")
        self.assertIn("SOURCE_OVERALLOCATED", _warnings(self.project))

    def test_own_funds_carry_whatever_the_foundation_spends(self) -> None:
        own = _fund(self.project, _source("Środki własne", kind="OWN_FUNDS"))
        expense = _expense(self.project, amount="900")

        _charge(expense, (own, "900"))

        self.assertNotIn("SOURCE_OVERALLOCATED", _warnings(self.project))
        self.assertEqual(BudgetService.build(self.project).funding.uncovered, Decimal("0.00"))

    def test_a_rejected_source_carries_nothing(self) -> None:
        source = _source()
        funding = _fund(self.project, source, planned="1000")
        self.assertNotIn("SOURCE_OVERALLOCATED", _warnings(self.project))

        FundingService.update_source(source, _source_update(status=FundingStatus.REJECTED), actor=None)

        self.assertEqual(_warnings(self.project)["SOURCE_OVERALLOCATED"].subject_ids, [funding.pk])

    def test_a_cost_outside_the_eligibility_period(self) -> None:
        today = finance_today()
        funding = _fund(self.project, _source(eligible_from=str(today), eligible_to=str(today + timedelta(days=10))),
                        planned="1000")
        expense = _expense(self.project, document_date=str(today + timedelta(days=15)))
        _charge(expense, (funding, "500"))

        warning = _warnings(self.project)["OUTSIDE_ELIGIBILITY"]
        self.assertEqual(warning.subject_ids, [expense.pk])

        ExpenseService.update(expense, _expense_update(document_date=str(today + timedelta(days=5))), actor=None)
        self.assertNotIn("OUTSIDE_ELIGIBILITY", _warnings(self.project))

    def test_an_expense_booked_before_its_invoice_is_judged_on_the_invoice(self) -> None:
        today = finance_today()
        funding = _fund(self.project, _source(eligible_from=str(today), eligible_to=str(today + timedelta(days=25))),
                        planned="1000")
        expense = _expense(self.project)
        _charge(expense, (funding, "500"))
        self.assertNotIn("OUTSIDE_ELIGIBILITY", _warnings(self.project))

        ExpenseService.update(expense, _expense_update(document_date=str(today + timedelta(days=30))), actor=None)

        expense.refresh_from_db()
        self.assertEqual(expense.incurred_on, today + timedelta(days=30))
        self.assertEqual(_warnings(self.project)["OUTSIDE_ELIGIBILITY"].subject_ids, [expense.pk])

    def test_the_costs_follow_a_concert_moved_past_the_grant(self) -> None:
        today = finance_today()
        funding = _fund(self.project, _source(eligible_from=str(today), eligible_to=str(today + timedelta(days=25))),
                        planned="1000")
        seat = make_seat(self.project)
        fee = price(self.project, participation=seat, amount="800")
        undocumented = _expense(self.project, amount="300")
        documented = _expense(self.project, amount="200", document_date=str(today))
        for item in (fee, undocumented, documented):
            _charge(item, (funding, "100"))
        self.assertNotIn("OUTSIDE_ELIGIBILITY", _warnings(self.project))

        self.project.date_time += timedelta(days=10)
        self.project.save()
        LedgerService.follow_concert_date(self.project)

        self.assertEqual(
            set(_warnings(self.project)["OUTSIDE_ELIGIBILITY"].subject_ids), {seat.pk, undocumented.pk},
        )
        documented.refresh_from_db()
        self.assertEqual(documented.incurred_on, today)

    def test_own_share_on_the_plan_and_on_the_actuals(self) -> None:
        source = _source(required_own_share_pct="10")
        funding = _fund(self.project, source, planned="950")
        _line(self.project, unit_cost="1000")

        self.assertEqual(_warnings(self.project)["OWN_SHARE_BELOW"].subject_ids, [funding.pk])
        figures = sources.measure([source]).sources[source.pk].figures
        self.assertEqual(figures.own_share_plan_pct, Decimal("5.00"))

        FundingService.update_funding(funding, ProjectFundingUpdateDTO(planned_amount=Decimal("900")), actor=None)
        self.assertNotIn("OWN_SHARE_BELOW", _warnings(self.project))

        expense = _expense(self.project, amount="1000")
        _charge(expense, (funding, "950"))
        self.assertIn("OWN_SHARE_BELOW", _warnings(self.project))

    def test_volunteer_work_counts_towards_the_own_share(self) -> None:
        source = _source(required_own_share_pct="20")
        funding = _fund(self.project, source)
        volunteer_work = _fund(self.project, _source("Wolontariat", kind="VOLUNTEER_WORK"))
        expense = _expense(self.project, amount="1000")
        _charge(expense, (funding, "1000"))
        self.assertIn("OWN_SHARE_BELOW", _warnings(self.project))

        seat = make_seat(self.project)
        item = price(self.project, participation=seat, amount="0", in_kind_hours="10", in_kind_hourly_rate="30")
        _charge(item, (volunteer_work, "300"))

        self.assertNotIn("OWN_SHARE_BELOW", _warnings(self.project))

    def test_administration_above_the_cap(self) -> None:
        funding = _fund(self.project, _source(admin_cost_cap_pct="10"), planned="2000")
        venue = _expense(self.project, amount="900")
        office = _expense(self.project, amount="200", category="ADMINISTRATION")
        _charge(venue, (funding, "900"))
        _charge(office, (funding, "200"))

        self.assertEqual(_warnings(self.project)["ADMIN_CAP_EXCEEDED"].subject_ids, [funding.pk])
        _charge(office, (funding, "100"))
        self.assertNotIn("ADMIN_CAP_EXCEEDED", _warnings(self.project))

    def test_a_report_due_within_two_weeks_until_the_source_is_settled(self) -> None:
        source = _source(report_due_on=str(finance_today() + timedelta(days=14)))
        funding = _fund(self.project, source)

        self.assertEqual(_warnings(self.project)["REPORT_DUE_SOON"].subject_ids, [funding.pk])
        FundingService.update_source(source, _source_update(status=FundingStatus.SETTLED), actor=None)
        self.assertNotIn("REPORT_DUE_SOON", _warnings(self.project))

    def test_a_line_over_plan_within_its_sources_tolerance_is_not_flagged(self) -> None:
        funding = _fund(self.project, _source(line_tolerance_pct="10"), planned="1000")
        line = _line(self.project, unit_cost="1000")
        expense = _expense(self.project, amount="1080", budget_line=str(line.pk))
        self.assertIn("LINE_OVER_PLAN", _warnings(self.project))

        _charge(expense, (funding, "500"))
        view = BudgetService.build(self.project).lines[0]

        self.assertEqual(view.tolerance_pct, Decimal("10.00"))
        self.assertTrue(view.over_plan)
        self.assertNotIn("LINE_OVER_PLAN", _warnings(self.project))


class SourceFiguresTests(APITestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(make_user())

    def test_a_source_sums_every_project_it_funds_and_lists_what_is_charged_to_it(self) -> None:
        source = _source(awarded_amount="5000", eligible_to=str(finance_today() + timedelta(days=60)))
        first, second = make_project(days=10, title="Wiosna"), make_project(days=90, title="Jesień")
        first_funding = _fund(first, source, planned="2000", received="1000")
        second_funding = _fund(second, source, planned="3000")
        line = _line(first)
        early = _expense(first, amount="700", budget_line=str(line.pk))
        late = _expense(second, amount="400")
        _charge(early, (first_funding, "700"))
        _charge(late, (second_funding, "400"))

        figures = sources.measure([source]).sources[source.pk].figures
        self.assertEqual(
            (figures.project_count, figures.planned, figures.received, figures.charged, figures.remaining),
            (2, Decimal("5000.00"), Decimal("1000.00"), Decimal("1100.00"), Decimal("3900.00")),
        )

        page = self.client.get(f"/api/finance/funding-sources/{source.pk}/").json()
        self.assertEqual([charge["project_title"] for charge in page["charges"]], ["Wiosna", "Jesień"])
        self.assertEqual(page["charges"][0]["plan_line"], "I.1 Pozycja VENUE")
        self.assertEqual([charge["eligible"] for charge in page["charges"]], [True, False])

        overview = self.client.get("/api/finance/overview/").json()
        self.assertEqual(overview["sources"][0]["figures"]["charged"], "1100.00")

    def test_the_funding_figures_read_the_same_money_as_the_ledger_rows(self) -> None:
        project = make_project()
        funding = _fund(project, _source(), planned="5000")
        charged_seat, declined_seat = make_seat(project, "Anna", "A"), make_seat(project, "Beata", "B")
        _charge(price(project, participation=charged_seat, amount="300"), (funding, "300"))
        _charge(price(project, participation=declined_seat, amount="200"), (funding, "200"))
        Participation.objects.filter(pk=declined_seat.pk).update(status=Participation.Status.DECLINED)

        money = BudgetService.build(project)
        from_rows = sum((row.allocated for row in money.rows if row.counted), Decimal("0"))

        self.assertEqual(money.fundings[0].charged, from_rows)
        self.assertEqual(money.funding.charged, Decimal("300.00"))
        self.assertEqual(money.funding.uncovered, money.summary.committed - Decimal("300.00"))

    def test_the_budget_payload_carries_fundings_and_splits(self) -> None:
        project = make_project()
        funding = _fund(project, _source(), planned="1000")
        line = _line(project)

        response = self.client.put(
            f"/api/finance/projects/{project.pk}/lines/{line.pk}/allocations/",
            {"allocations": [{"funding": str(funding.pk), "amount": "600"}]}, format="json",
        )

        payload = response.json()
        self.assertEqual(payload["lines"][0]["allocations"], [{"funding_id": str(funding.pk), "amount": "600.00"}])
        self.assertEqual(payload["fundings"][0]["source"]["name"], "Dotacja MKiDN")
        self.assertEqual(payload["funding"]["plan_uncovered"], "0.00")


