"""
The roster → ledger copy run by migration `finance/0002`, against the live models.
"""
from datetime import timedelta
from decimal import Decimal

from django.apps import apps
from django.test import TestCase
from django.utils import timezone

from roster.models import CrewAssignment, Participation

from ..data_copy import copy_roster_fees
from ..models import CostItem, FeeForm, FinanceAction, FinanceEvent, ProjectBudget
from ..rules import local_date
from .factories import make_crew, make_project, make_seat


class RosterCopyTests(TestCase):
    def setUp(self) -> None:
        self.project = make_project(days=-10)
        self.concert_day = local_date(self.project.date_time, self.project.timezone)

    def test_a_paid_fee_becomes_a_paid_dzielo_on_the_roster_payment_date(self) -> None:
        seat = make_seat(self.project)
        paid_at = timezone.now() - timedelta(days=4)
        Participation.objects.filter(pk=seat.pk).update(fee=Decimal("250.00"), is_paid=True, paid_at=paid_at)

        report = copy_roster_fees(apps)

        item = CostItem.objects.get(participation=seat)
        self.assertEqual((item.form, item.contract_amount, item.cost_amount), (FeeForm.DZIELO, Decimal("250.00"),
                                                                             Decimal("250.00")))
        self.assertEqual(item.paid_on, local_date(paid_at, self.project.timezone))
        self.assertEqual(item.incurred_on, self.concert_day)
        self.assertEqual(item.payee_name, "Anna Nowak")
        self.assertEqual(item.payee_role, "Sopran")
        event = FinanceEvent.objects.get(subject_id=item.pk)
        self.assertEqual(event.action, FinanceAction.IMPORTED)
        self.assertEqual(event.before["fee"], "250.00")
        self.assertEqual(event.after["paid_on_source"], "paid_at")
        self.assertEqual((report.items, report.paid, report.budgets), (1, 1, 1))

    def test_a_fee_of_zero_is_volunteer_work(self) -> None:
        seat = make_seat(self.project)
        Participation.objects.filter(pk=seat.pk).update(fee=Decimal("0"))

        copy_roster_fees(apps)

        item = CostItem.objects.get(participation=seat)
        self.assertEqual((item.form, item.contract_amount, item.paid_on), (FeeForm.VOLUNTEER, Decimal("0.00"), None))

    def test_a_paid_seat_without_a_timestamp_falls_back_to_its_last_change(self) -> None:
        seat = make_seat(self.project)
        touched = timezone.now() - timedelta(days=2)
        Participation.objects.filter(pk=seat.pk).update(fee=Decimal("100"), is_paid=True, updated_at=touched)

        copy_roster_fees(apps)

        self.assertEqual(CostItem.objects.get(participation=seat).paid_on, local_date(touched, "Europe/Warsaw"))

    def test_a_paid_crew_fee_without_a_timestamp_falls_back_to_the_concert(self) -> None:
        crew = make_crew(self.project)
        CrewAssignment.objects.filter(pk=crew.pk).update(fee=Decimal("700"), is_paid=True)

        copy_roster_fees(apps)

        item = CostItem.objects.get(crew_assignment=crew)
        self.assertEqual((item.form, item.category, item.paid_on), (FeeForm.DZIELO, "PERSONNEL_TECHNICAL",
                                                                    self.concert_day))
        self.assertEqual(FinanceEvent.objects.get(subject_id=item.pk).after["paid_on_source"], "concert_date")

    def test_a_paid_flag_the_ledger_cannot_hold_is_kept_in_the_event(self) -> None:
        unpriced, volunteer = make_seat(self.project, "Ula", "Bezkwoty"), make_seat(self.project, "Wanda", "Zero")
        Participation.objects.filter(pk=unpriced.pk).update(fee=None, is_paid=True)
        Participation.objects.filter(pk=volunteer.pk).update(fee=Decimal("0"), is_paid=True)

        report = copy_roster_fees(apps)

        self.assertEqual(report.paid_flag_dropped, 2)
        for seat in (unpriced, volunteer):
            item = CostItem.objects.get(participation=seat)
            self.assertIsNone(item.paid_on)
            self.assertIs(FinanceEvent.objects.get(subject_id=item.pk).before["is_paid"], True)

    def test_only_touched_projects_get_a_budget_and_a_second_run_copies_nothing(self) -> None:
        make_seat(make_project(title="Bez honorariów"))
        seat = make_seat(self.project)
        Participation.objects.filter(pk=seat.pk).update(fee=Decimal("300"))

        copy_roster_fees(apps)
        again = copy_roster_fees(apps)

        self.assertEqual(list(ProjectBudget.objects.values_list("project_id", flat=True)), [self.project.pk])
        self.assertEqual((again.items, again.skipped_existing), (0, 1))
        self.assertEqual(CostItem.objects.count(), 1)

    def test_a_removed_seat_with_a_payment_is_still_copied(self) -> None:
        seat = make_seat(self.project)
        Participation.objects.filter(pk=seat.pk).update(
            fee=Decimal("300"), is_paid=True, paid_at=timezone.now(), is_deleted=True,
        )

        copy_roster_fees(apps)

        self.assertEqual(CostItem.objects.get(participation_id=seat.pk).contract_amount, Decimal("300.00"))
