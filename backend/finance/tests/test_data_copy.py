"""
The roster → ledger copy run by migration `finance/0002`, and the mark on the
payments it carried over run by `finance/0005`.

The columns it reads are dropped by `roster/0062`, so the class rolls the roster
back to the schema the copy runs against. The rollback also undoes every ledger
migration that depends on a later roster one, so neither app's live models match
the rolled-back tables: every later migration that adds a column makes them name
one the database lacks. On that database the class therefore writes and reads
through the models of exactly the migrations still applied, and hands the copy
those same models, as the migration itself gets them. A test that needs the live
models (the budget service reads through them) runs that part inside
`_at_leaves()`. The database is migrated forward again when the class ends, even
if a test or the rollback fails.
"""
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal
from itertools import count
from typing import Any

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.state import StateApps
from django.test import TransactionTestCase
from django.utils import timezone

from roster.models import Collaborator, Participation, Project, VoiceType

from ..data_copy import copy_roster_fees, mark_payments_before_ledger
from ..models import FeeForm, FinanceAction
from ..rules import local_date
from ..services.budget import BudgetService

# The last roster migration that still holds the fee columns.
_BEFORE_DROP = ("roster", "0061_rehearsalplanitem_minutes")

_sequence = count(1)


def _migrate_to_leaves() -> None:
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


def _applied_models() -> StateApps:
    """The models of the migrations the database has applied."""
    loader = MigrationLoader(connection)
    applied = [key for key in loader.applied_migrations if key in loader.graph.nodes]
    return loader.project_state(applied).apps


@contextmanager
def _at_leaves() -> Iterator[None]:
    """Runs the block on the latest schema, where the live models work, and
    rolls the roster back after it. The ledger is emptied on the way back — the
    drop refuses to be reversed while it holds fees — so a test asserts on the
    ledger before the block, not after it."""
    _migrate_to_leaves()
    try:
        yield
    finally:
        # A hard delete — a soft one still leaves fees behind — so the
        # rollback the rest of the class runs on is allowed again. A refused
        # rollback has already undone part of the graph, so the delete goes
        # through the models of whatever is applied at this point.
        _applied_models().get_model("finance", "CostItem")._base_manager.all().delete()
        MigrationExecutor(connection).migrate([_BEFORE_DROP])


class RosterCopyTests(TransactionTestCase):
    historical: Any

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.addClassCleanup(_migrate_to_leaves)
        MigrationExecutor(connection).migrate([_BEFORE_DROP])
        cls.historical = _applied_models()

    def setUp(self) -> None:
        self.project = self._project(days=-10)
        self.concert_day = local_date(self.project.date_time, self.project.timezone)

    def _roster(self, model_name: str) -> Any:
        return self.historical.get_model("roster", model_name)

    def _ledger(self, model_name: str) -> Any:
        return self.historical.get_model("finance", model_name)

    def _items(self, *, removed_too: bool = False) -> Any:
        """The ledger lines; without `removed_too`, the ones `CostItem.objects` shows."""
        items = self._ledger("CostItem")._base_manager.all()
        return items if removed_too else items.filter(is_deleted=False)

    def _event(self, item: Any) -> Any:
        return self._ledger("FinanceEvent")._base_manager.get(subject_id=item.pk)

    def _project(self, *, days: float = 30, status: str = Project.Status.ACTIVE, title: str = "Koncert") -> Any:
        return self._roster("Project").objects.create(
            title=title, date_time=timezone.now() + timedelta(days=days), status=status,
        )

    def _seat(
        self, first_name: str = "Anna", last_name: str = "Nowak", *, project: Any = None,
        **roster_fee: Any,
    ) -> Any:
        """A cast seat written through the historical model, which still has
        `fee`, `is_paid` and `paid_at`."""
        artist = self._roster("Artist").objects.create(
            first_name=first_name, last_name=last_name,
            email=f"copy-{next(_sequence)}@test.pl", voice_type=VoiceType.SOPRANO,
        )
        return self._roster("Participation").objects.create(
            artist_id=artist.pk, project_id=(project or self.project).pk,
            status=Participation.Status.CONFIRMED, **roster_fee,
        )

    def _remove_artist(self, seat: Any) -> None:
        self._roster("Artist").objects.filter(pk=seat.artist_id).update(is_deleted=True)

    def _crew(self, **roster_fee: Any) -> Any:
        collaborator = self._roster("Collaborator").objects.create(
            first_name="Jan", last_name="Kowalski", specialty=Collaborator.Specialty.SOUND,
        )
        return self._roster("CrewAssignment").objects.create(
            collaborator_id=collaborator.pk, project_id=self.project.pk, **roster_fee,
        )

    def test_a_paid_fee_becomes_a_paid_dzielo_on_the_roster_payment_date(self) -> None:
        paid_at = timezone.now() - timedelta(days=4)
        seat = self._seat(fee=Decimal("250.00"), is_paid=True, paid_at=paid_at)

        report = copy_roster_fees(self.historical)

        item = self._items().get(participation_id=seat.pk)
        self.assertEqual((item.form, item.contract_amount, item.cost_amount), (FeeForm.DZIELO, Decimal("250.00"),
                                                                             Decimal("250.00")))
        self.assertEqual(item.paid_on, local_date(paid_at, "Europe/Warsaw"))
        self.assertEqual(item.paid_marked_at, paid_at)
        self.assertEqual(item.incurred_on, self.concert_day)
        self.assertEqual(item.payee_name, "Anna Nowak")
        self.assertEqual(item.payee_role, "Sopran")
        event = self._event(item)
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

        item = self._items().get(participation_id=seat.pk)
        self.assertEqual((item.form, item.contract_amount, item.paid_on), (FeeForm.VOLUNTEER, Decimal("0.00"), None))

    def test_the_zero_the_project_creation_gave_its_creator_is_not_copied(self) -> None:
        creator = self._seat("Krystian", "Twórca", fee=Decimal("0"))

        report = copy_roster_fees(self.historical)

        self.assertFalse(self._items().filter(participation_id=creator.pk).exists())
        self.assertEqual(report.skipped_creator_seats, 1)

    def test_on_a_cancelled_project_only_payments_are_copied(self) -> None:
        cancelled = self._project(title="Odwołany", status=Project.Status.CANCELLED, days=-5)
        owed = self._seat("Nieopłacona", "Osoba", project=cancelled, fee=Decimal("300"))
        paid = self._seat("Opłacona", "Osoba", project=cancelled, fee=Decimal("300"), is_paid=True,
                          paid_at=timezone.now())

        report = copy_roster_fees(self.historical)

        self.assertFalse(self._items().filter(participation_id=owed.pk).exists())
        self.assertIsNotNone(self._items().get(participation_id=paid.pk).paid_on)
        self.assertEqual(report.skipped_cancelled, 1)

    def test_a_merged_artists_payment_lands_once_on_the_survivors_seat(self) -> None:
        paid_at = timezone.now() - timedelta(days=3)
        survivor = self._seat("Anna", "Nowak", fee=Decimal("300"))
        folded = self._seat("anna", "Nowak ", fee=Decimal("300"), is_paid=True, paid_at=paid_at, is_deleted=True)
        self._remove_artist(folded)
        # Same fee, same project, but another person: never taken for the survivor.
        self._seat("Ewa", "Kowalska", fee=Decimal("300"))

        report = copy_roster_fees(self.historical)
        again = copy_roster_fees(self.historical)

        item = self._items().get(participation_id=survivor.pk)
        self.assertEqual(item.paid_on, local_date(paid_at, self.project.timezone))
        self.assertFalse(self._items(removed_too=True).filter(participation_id=folded.pk).exists())
        self.assertEqual(self._event(item).before["merged_from"], str(folded.pk))
        self.assertEqual((report.merged_payments, report.paid), (1, 1))
        self.assertEqual(again.items, 0)

    def test_a_removed_duplicate_without_a_single_namesake_is_copied_as_it_stands(self) -> None:
        self._seat("Anna", "Nowak", fee=Decimal("300"))
        self._seat("Anna", "Nowak", fee=Decimal("300"))
        folded = self._seat("Anna", "Nowak", fee=Decimal("300"), is_paid=True, paid_at=timezone.now(),
                            is_deleted=True)
        self._remove_artist(folded)

        report = copy_roster_fees(self.historical)

        self.assertIsNotNone(self._items(removed_too=True).get(participation_id=folded.pk).paid_on)
        self.assertEqual(report.merged_payments, 0)

    def test_payments_carried_over_need_no_contract_of_the_ledgers(self) -> None:
        paid = self._seat(fee=Decimal("250"), is_paid=True, paid_at=timezone.now() - timedelta(days=4))
        owed = self._seat("Ewa", "Kowalska", fee=Decimal("250"))

        copy_roster_fees(self.historical)
        marked = mark_payments_before_ledger(self.historical)

        self.assertEqual(marked, 1)
        self.assertTrue(self._items().get(participation_id=paid.pk).paid_before_ledger)
        self.assertFalse(self._items().get(participation_id=owed.pk).paid_before_ledger)
        self.assertEqual(mark_payments_before_ledger(self.historical), 0)
        # The budget reads seats and artists through the live models.
        with _at_leaves():
            codes = {warning.code for warning in BudgetService.build(Project.objects.get(pk=self.project.pk)).warnings}
        self.assertNotIn("PAID_WITHOUT_DOCUMENT", codes)

    def test_a_paid_seat_without_a_timestamp_falls_back_to_its_last_change(self) -> None:
        seat = self._seat(fee=Decimal("100"), is_paid=True)
        touched = timezone.now() - timedelta(days=2)
        type(seat).objects.filter(pk=seat.pk).update(updated_at=touched)

        copy_roster_fees(self.historical)

        self.assertEqual(self._items().get(participation_id=seat.pk).paid_on, local_date(touched, "Europe/Warsaw"))

    def test_a_paid_crew_fee_without_a_timestamp_falls_back_to_the_concert(self) -> None:
        crew = self._crew(fee=Decimal("700"), is_paid=True)

        copy_roster_fees(self.historical)

        item = self._items().get(crew_assignment_id=crew.pk)
        self.assertEqual((item.form, item.category, item.paid_on), (FeeForm.DZIELO, "PERSONNEL_TECHNICAL",
                                                                    self.concert_day))
        self.assertEqual(self._event(item).after["paid_on_source"], "concert_date")

    def test_a_paid_flag_the_ledger_cannot_hold_is_kept_in_the_event(self) -> None:
        unpriced = self._seat("Ula", "Bezkwoty", fee=None, is_paid=True)
        volunteer = self._seat("Wanda", "Zero", fee=Decimal("0"), is_paid=True)
        self._cast_later(volunteer)

        report = copy_roster_fees(self.historical)

        self.assertEqual(report.paid_flag_dropped, 2)
        for seat in (unpriced, volunteer):
            item = self._items().get(participation_id=seat.pk)
            self.assertIsNone(item.paid_on)
            self.assertIs(self._event(item).before["is_paid"], True)

    def test_only_touched_projects_get_a_budget_and_a_second_run_copies_nothing(self) -> None:
        self._seat("Ewa", "Bezhonorarium", project=self._project(title="Bez honorariów"))
        seat = self._seat(fee=Decimal("300"))

        copy_roster_fees(self.historical)
        again = copy_roster_fees(self.historical)

        budgets = self._ledger("ProjectBudget")._base_manager.filter(is_deleted=False)
        self.assertEqual(list(budgets.values_list("project_id", flat=True)), [self.project.pk])
        self.assertEqual((again.items, again.skipped_existing), (0, 1))
        self.assertEqual(list(self._items().values_list("participation_id", flat=True)), [seat.pk])

    def test_the_drop_refuses_to_be_reversed_while_the_ledger_holds_fees(self) -> None:
        self._seat(fee=Decimal("300"))
        copy_roster_fees(self.historical)
        with _at_leaves(), self.assertRaisesMessage(RuntimeError, "roster/0062 cannot be reversed"):
            MigrationExecutor(connection).migrate([_BEFORE_DROP])

    def test_a_removed_seat_with_a_payment_is_still_copied(self) -> None:
        seat = self._seat(fee=Decimal("300"), is_paid=True, paid_at=timezone.now(), is_deleted=True)

        copy_roster_fees(self.historical)

        self.assertEqual(self._items().get(participation_id=seat.pk).contract_amount, Decimal("300.00"))
