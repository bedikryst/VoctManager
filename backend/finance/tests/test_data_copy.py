"""
The roster → ledger copy run by migration `finance/0002`.

The columns it reads are dropped by `roster/0062`, so the class rolls the roster
back to the schema the copy runs against, writes its seats and crew bookings
through the historical models, and hands the copy those same models — exactly
what the migration does. The roster is migrated forward again when the class
ends, even if a test or the rollback fails.
"""
from datetime import timedelta
from decimal import Decimal
from itertools import count
from typing import Any

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

from roster.models import Artist, Collaborator, Participation, Project, VoiceType

from ..data_copy import copy_roster_fees
from ..models import CostItem, FeeForm, FinanceAction, FinanceEvent, ProjectBudget
from ..rules import local_date
from .factories import make_project

# The last roster migration that still holds the fee columns, and the copy.
_BEFORE_DROP = ("roster", "0061_rehearsalplanitem_minutes")
_COPY = ("finance", "0002_copy_roster_fees")

_sequence = count(1)


def _migrate_to_leaves() -> None:
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


class RosterCopyTests(TransactionTestCase):
    historical: Any

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.addClassCleanup(_migrate_to_leaves)
        executor = MigrationExecutor(connection)
        executor.migrate([_BEFORE_DROP])
        cls.historical = executor.loader.project_state([_BEFORE_DROP, _COPY]).apps

    def setUp(self) -> None:
        self.project = make_project(days=-10)
        self.concert_day = local_date(self.project.date_time, self.project.timezone)

    def _seat(
        self, first_name: str = "Anna", last_name: str = "Nowak", *, project: Project | None = None,
        **roster_fee: Any,
    ) -> Any:
        """A cast seat written through the historical model, which still has
        `fee`, `is_paid` and `paid_at`. The artist is a live row: its table is
        the same on both sides of the drop."""
        artist = Artist.objects.create(
            first_name=first_name, last_name=last_name,
            email=f"copy-{next(_sequence)}@test.pl", voice_type=VoiceType.SOPRANO,
        )
        seat_model = self.historical.get_model("roster", "Participation")
        return seat_model.objects.create(
            artist_id=artist.pk, project_id=(project or self.project).pk,
            status=Participation.Status.CONFIRMED, **roster_fee,
        )

    def _crew(self, **roster_fee: Any) -> Any:
        collaborator = Collaborator.objects.create(
            first_name="Jan", last_name="Kowalski", specialty=Collaborator.Specialty.SOUND,
        )
        crew_model = self.historical.get_model("roster", "CrewAssignment")
        return crew_model.objects.create(collaborator_id=collaborator.pk, project_id=self.project.pk, **roster_fee)

    def test_a_paid_fee_becomes_a_paid_dzielo_on_the_roster_payment_date(self) -> None:
        paid_at = timezone.now() - timedelta(days=4)
        seat = self._seat(fee=Decimal("250.00"), is_paid=True, paid_at=paid_at)

        report = copy_roster_fees(self.historical)

        item = CostItem.objects.get(participation_id=seat.pk)
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
        seat = self._seat(fee=Decimal("0"))

        copy_roster_fees(self.historical)

        item = CostItem.objects.get(participation_id=seat.pk)
        self.assertEqual((item.form, item.contract_amount, item.paid_on), (FeeForm.VOLUNTEER, Decimal("0.00"), None))

    def test_a_paid_seat_without_a_timestamp_falls_back_to_its_last_change(self) -> None:
        seat = self._seat(fee=Decimal("100"), is_paid=True)
        touched = timezone.now() - timedelta(days=2)
        type(seat).objects.filter(pk=seat.pk).update(updated_at=touched)

        copy_roster_fees(self.historical)

        self.assertEqual(CostItem.objects.get(participation_id=seat.pk).paid_on, local_date(touched, "Europe/Warsaw"))

    def test_a_paid_crew_fee_without_a_timestamp_falls_back_to_the_concert(self) -> None:
        crew = self._crew(fee=Decimal("700"), is_paid=True)

        copy_roster_fees(self.historical)

        item = CostItem.objects.get(crew_assignment_id=crew.pk)
        self.assertEqual((item.form, item.category, item.paid_on), (FeeForm.DZIELO, "PERSONNEL_TECHNICAL",
                                                                    self.concert_day))
        self.assertEqual(FinanceEvent.objects.get(subject_id=item.pk).after["paid_on_source"], "concert_date")

    def test_a_paid_flag_the_ledger_cannot_hold_is_kept_in_the_event(self) -> None:
        unpriced = self._seat("Ula", "Bezkwoty", fee=None, is_paid=True)
        volunteer = self._seat("Wanda", "Zero", fee=Decimal("0"), is_paid=True)

        report = copy_roster_fees(self.historical)

        self.assertEqual(report.paid_flag_dropped, 2)
        for seat in (unpriced, volunteer):
            item = CostItem.objects.get(participation_id=seat.pk)
            self.assertIsNone(item.paid_on)
            self.assertIs(FinanceEvent.objects.get(subject_id=item.pk).before["is_paid"], True)

    def test_only_touched_projects_get_a_budget_and_a_second_run_copies_nothing(self) -> None:
        self._seat("Ewa", "Bezhonorarium", project=make_project(title="Bez honorariów"))
        seat = self._seat(fee=Decimal("300"))

        copy_roster_fees(self.historical)
        again = copy_roster_fees(self.historical)

        self.assertEqual(list(ProjectBudget.objects.values_list("project_id", flat=True)), [self.project.pk])
        self.assertEqual((again.items, again.skipped_existing), (0, 1))
        self.assertEqual(list(CostItem.objects.values_list("participation_id", flat=True)), [seat.pk])

    def test_a_removed_seat_with_a_payment_is_still_copied(self) -> None:
        seat = self._seat(fee=Decimal("300"), is_paid=True, paid_at=timezone.now(), is_deleted=True)

        copy_roster_fees(self.historical)

        self.assertEqual(CostItem.objects.get(participation_id=seat.pk).contract_amount, Decimal("300.00"))
