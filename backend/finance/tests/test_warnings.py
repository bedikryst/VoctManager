"""
Each warning the ledger raises (§5.4), both ways: the condition that raises it
and the fix that clears it.
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from roster.models import Participation, Project, Rehearsal

from ..dtos import CostItemDetailsDTO, PayFeesDTO, SignContractDTO
from ..models import Contract, CostItem
from ..rules import finance_today, local_date
from ..services.budget import SEVERITY_PROBLEM, BudgetService, BudgetWarning
from ..services.contracts import ContractService
from ..services.ledger import LedgerService
from .factories import make_crew, make_project, make_seat, make_user, price


class WarningTests(TestCase):
    def setUp(self) -> None:
        self.manager = make_user()

    def warnings(self, project: Project) -> dict[str, BudgetWarning]:
        money = BudgetService.build(project)
        return {warning.code: warning for warning in money.warnings}

    def pay(self, item: CostItem) -> None:
        LedgerService.pay(
            item.budget.project, PayFeesDTO(ids=(item.pk,), paid_on=finance_today()), actor=self.manager,
        )

    def test_unpriced(self) -> None:
        project = make_project()
        seat = make_seat(project)

        self.assertEqual(self.warnings(project)["UNPRICED"].subject_ids, [seat.pk])
        price(project, participation=seat, amount="0")
        self.assertNotIn("UNPRICED", self.warnings(project))

    def test_orphaned_fee_and_paid_for_declined(self) -> None:
        project = make_project()
        orphan, paid = make_seat(project, "Olga", "Sierota"), make_seat(project, "Paula", "Opłacona")
        price(project, participation=orphan, amount="100")
        self.pay(price(project, participation=paid, amount="100"))
        Participation.objects.filter(project=project).update(status=Participation.Status.DECLINED)

        warnings = self.warnings(project)

        self.assertEqual(warnings["ORPHANED_FEE"].subject_ids, [orphan.pk])
        self.assertEqual(warnings["PAID_FOR_DECLINED"].subject_ids, [paid.pk])
        self.assertEqual(warnings["PAID_FOR_DECLINED"].severity, SEVERITY_PROBLEM)

    def test_employer_cost_missing(self) -> None:
        project = make_project()
        crew = make_crew(project)
        price(project, crew=crew, amount="600")

        self.assertIn("EMPLOYER_COST_MISSING", self.warnings(project))
        price(project, crew=crew, amount="600", employer_contributions="117.18")
        self.assertNotIn("EMPLOYER_COST_MISSING", self.warnings(project))

    def test_hours_missing_and_below_minimum_rate(self) -> None:
        project = make_project(days=-3)
        contract = ContractService.issue(price(project, crew=make_crew(project), amount="300"), actor=self.manager)

        self.assertIn("HOURS_MISSING", self.warnings(project))

        ContractService.confirm_hours(contract, hours=Decimal("20"), actor=self.manager)
        warnings = self.warnings(project)
        self.assertNotIn("HOURS_MISSING", warnings)
        self.assertEqual(warnings["BELOW_MINIMUM_HOURLY_RATE"].severity, SEVERITY_PROBLEM)
        self.assertIn("minimum", warnings["BELOW_MINIMUM_HOURLY_RATE"].params)

        ContractService.confirm_hours(contract, hours=Decimal("5"), actor=self.manager)
        self.assertNotIn("BELOW_MINIMUM_HOURLY_RATE", self.warnings(project))

    def test_volunteer_insurance_for_a_short_engagement(self) -> None:
        project = make_project(days=20)
        rehearsal = Rehearsal.objects.create(
            project=project, date_time=project.date_time - timedelta(days=10), timezone="Europe/Warsaw",
        )
        ContractService.issue(price(project, participation=make_seat(project), amount="0"), actor=self.manager)

        # Both calendar days count: ten nights apart is an eleven-day engagement.
        # Read in Warsaw, as the rule does, so an evening near midnight cannot
        # move either date.
        days = (local_date(project.date_time, project.timezone)
                - local_date(rehearsal.date_time, project.timezone)).days + 1
        warning = self.warnings(project)["VOLUNTEER_INSURANCE"]
        self.assertEqual(warning.params, {"period_days": days})
        self.assertIn(days, (10, 11, 12))

        rehearsal.date_time = project.date_time - timedelta(days=60)
        rehearsal.save()
        self.assertNotIn("VOLUNTEER_INSURANCE", self.warnings(project))

    def test_not_signed_once_the_concert_has_passed(self) -> None:
        project = make_project(days=-1)
        contract = ContractService.issue(price(project, participation=make_seat(project), amount="300"),
                                         actor=self.manager)

        self.assertIn("NOT_SIGNED", self.warnings(project))
        ContractService.sign(contract, SignContractDTO(signed_on=finance_today()), actor=self.manager)
        self.assertNotIn("NOT_SIGNED", self.warnings(project))

    def test_document_missing_a_week_before_the_concert(self) -> None:
        soon, later = make_project(days=5), make_project(days=30)
        for project in (soon, later):
            price(project, participation=make_seat(project), amount="300")
            price(project, crew=make_crew(project, company_name="Firma"), amount="900")

        self.assertEqual(len(self.warnings(soon)["DOCUMENT_MISSING"].subject_ids), 2)
        self.assertNotIn("DOCUMENT_MISSING", self.warnings(later))

        invoice = CostItem.objects.get(budget__project=soon, form="INVOICE")
        LedgerService.update_details(invoice, CostItemDetailsDTO(document_number="FV/1"), actor=self.manager)
        dzielo = CostItem.objects.get(budget__project=soon, form="DZIELO")
        ContractService.issue(dzielo, actor=self.manager)
        self.assertNotIn("DOCUMENT_MISSING", self.warnings(soon))

    def test_paid_without_document(self) -> None:
        project = make_project()
        item = price(project, participation=make_seat(project), amount="300")
        self.pay(item)

        self.assertIn("PAID_WITHOUT_DOCUMENT", self.warnings(project))
        ContractService.issue(item, actor=self.manager)
        self.assertNotIn("PAID_WITHOUT_DOCUMENT", self.warnings(project))
        self.assertTrue(Contract.objects.filter(cost_item=item).exists())

    def test_payment_overdue(self) -> None:
        project = make_project()
        item = price(project, participation=make_seat(project), amount="300")
        LedgerService.update_details(
            item, CostItemDetailsDTO(due_on=finance_today() - timedelta(days=1)), actor=self.manager,
        )

        self.assertIn("PAYMENT_OVERDUE", self.warnings(project))
        self.pay(item)
        self.assertNotIn("PAYMENT_OVERDUE", self.warnings(project))

    def test_time_relative_warnings_are_computed_at_request_time(self) -> None:
        project = make_project(days=2)
        ContractService.issue(price(project, participation=make_seat(project), amount="300"), actor=self.manager)

        self.assertNotIn("NOT_SIGNED", self.warnings(project))
        later = BudgetService.build(project, now=timezone.now() + timedelta(days=3))
        self.assertIn("NOT_SIGNED", {warning.code for warning in later.warnings})
