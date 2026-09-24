"""
The roster → ledger copy run by migration `finance/0002`, and the mark on the
payments it carried over run by `finance/0005`.

The columns it reads are dropped by `roster/0062`, so the class rolls the roster
back to the schema the copy runs against, writes its seats and crew bookings
through the historical models, and hands the copy those same models — exactly
what the migration does. The ledger's side stays at its latest migration, and
the copy gets the ledger models of that state: a later finance migration adds
columns the copy never names, and the database holds them. The roster is
migrated forward again when the class ends, even if a test or the rollback fails.
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

from ..data_copy import copy_roster_fees, mark_payments_before_ledger
from ..models import CostItem, FeeForm, FinanceAction, FinanceEvent, ProjectBudget
from ..rules import local_date
from ..services.budget import BudgetService
from .factories import make_project

# The last roster migration that still holds the fee columns.
_BEFORE_DROP = ("roster", "0061_rehearsalplanitem_minutes")

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
        finance_leaves = [node for node in executor.loader.graph.leaf_nodes() if node[0] == "finance"]
        cls.historical = executor.loader.project_state([_BEFORE_DROP, *finance_leaves]).apps

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

    def _cast_later(self, seat: Any) -> None:
        """Dates the seat a day after its project: cast by hand, not by the
        project's creation."""
        type(seat).objects.filter(pk=seat.pk).update(created_at=self.project.created_at + timedelta(days=1))

    def test_a_fee_of_zero_is_volunteer_work(self) -> None:
        seat = self._seat(fee=Decimal("0"))
        self._cast_later(seat)

        copy_roster_fees(self.historical)

        item = CostItem.objects.get(participation_id=seat.pk)
        self.assertEqual((item.form, item.contract_amount, item.paid_on), (FeeForm.VOLUNTEER, Decimal("0.00"), None))

    def test_the_zero_the_project_creation_gave_its_creator_is_not_copied(self) -> None:
        creator = self._seat("Krystian", "Twórca", fee=Decimal("0"))

        report = copy_roster_fees(self.historical)

        self.assertFalse(CostItem.objects.filter(participation_id=creator.pk).exists())
        self.assertEqual(report.skipped_creator_seats, 1)

    def test_on_a_cancelled_project_only_payments_are_copied(self) -> None:
        cancelled = make_project(title="Odwołany", status=Project.Status.CANCELLED, days=-5)
        owed = self._seat("Nieopłacona", "Osoba", project=cancelled, fee=Decimal("300"))
        paid = self._seat("Opłacona", "Osoba", project=cancelled, fee=Decimal("300"), is_paid=True,
                          paid_at=timezone.now())

        report = copy_roster_fees(self.historical)

        self.assertFalse(CostItem.objects.filter(participation_id=owed.pk).exists())
        self.assertIsNotNone(CostItem.objects.get(participation_id=paid.pk).paid_on)
        self.assertEqual(report.skipped_cancelled, 1)

    def test_a_merged_artists_payment_lands_once_on_the_survivors_seat(self) -> None:
        paid_at = timezone.now() - timedelta(days=3)
        survivor = self._seat("Anna", "Nowak", fee=Decimal("300"))
        folded = self._seat("anna", "Nowak ", fee=Decimal("300"), is_paid=True, paid_at=paid_at, is_deleted=True)
        Artist.objects.filter(pk=folded.artist_id).update(is_deleted=True)
        # Same fee, same project, but another person: never taken for the survivor.
        self._seat("Ewa", "Kowalska", fee=Decimal("300"))

        report = copy_roster_fees(self.historical)
        again = copy_roster_fees(self.historical)

        item = CostItem.objects.get(participation_id=survivor.pk)
        self.assertEqual(item.paid_on, local_date(paid_at, self.project.timezone))
        self.assertFalse(CostItem.all_objects.filter(participation_id=folded.pk).exists())
        self.assertEqual(FinanceEvent.objects.get(subject_id=item.pk).before["merged_from"], str(folded.pk))
        self.assertEqual((report.merged_payments, report.paid), (1, 1))
        self.assertEqual(again.items, 0)

    def test_a_removed_duplicate_without_a_single_namesake_is_copied_as_it_stands(self) -> None:
        self._seat("Anna", "Nowak", fee=Decimal("300"))
        self._seat("Anna", "Nowak", fee=Decimal("300"))
        folded = self._seat("Anna", "Nowak", fee=Decimal("300"), is_paid=True, paid_at=timezone.now(),
                            is_deleted=True)
        Artist.objects.filter(pk=folded.artist_id).update(is_deleted=True)

        report = copy_roster_fees(self.historical)

        self.assertIsNotNone(CostItem.all_objects.get(participation_id=folded.pk).paid_on)
        self.assertEqual(report.merged_payments, 0)

    def test_payments_carried_over_need_no_contract_of_the_ledgers(self) -> None:
        paid = self._seat(fee=Decimal("250"), is_paid=True, paid_at=timezone.now() - timedelta(days=4))
        owed = self._seat("Ewa", "Kowalska", fee=Decimal("250"))

        copy_roster_fees(self.historical)
        marked = mark_payments_before_ledger(self.historical)

        self.assertEqual(marked, 1)
        self.assertTrue(CostItem.objects.get(participation_id=paid.pk).paid_before_ledger)
        self.assertFalse(CostItem.objects.get(participation_id=owed.pk).paid_before_ledger)
        codes = {warning.code for warning in BudgetService.build(self.project).warnings}
        self.assertNotIn("PAID_WITHOUT_DOCUMENT", codes)
        self.assertEqual(mark_payments_before_ledger(self.historical), 0)

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
        self._cast_later(volunteer)

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

    def test_the_drop_refuses_to_be_reversed_while_the_ledger_holds_fees(self) -> None:
        self._seat(fee=Decimal("300"))
        copy_roster_fees(self.historical)
        _migrate_to_leaves()
        try:
            with self.assertRaisesMessage(RuntimeError, "roster/0062 cannot be reversed"):
                MigrationExecutor(connection).migrate([_BEFORE_DROP])
        finally:
            # A hard delete — a soft one still leaves fees behind — so the
            # rollback the rest of the class runs on is allowed again.
            CostItem.all_objects.all().hard_delete()
            MigrationExecutor(connection).migrate([_BEFORE_DROP])

    def test_a_removed_seat_with_a_payment_is_still_copied(self) -> None:
        seat = self._seat(fee=Decimal("300"), is_paid=True, paid_at=timezone.now(), is_deleted=True)

        copy_roster_fees(self.historical)

        self.assertEqual(CostItem.objects.get(participation_id=seat.pk).contract_amount, Decimal("300.00"))
