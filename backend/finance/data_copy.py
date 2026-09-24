"""
@file data_copy.py
@description Copies the fees still held on the roster (`Participation` and
             `CrewAssignment`: `fee`, `is_paid`, `paid_at`) into FEE cost items,
             with a budget for every project it touches, and marks the payments
             it carried over. Migration `finance/0002` runs the copy and
             `finance/0005` the mark, each against the historical models it is
             handed: the mark writes a column `0002` does not have yet. The
             roster columns are gone from the live models (`roster/0062`), so the
             tests roll the roster back and hand both the same historical models.
             Both read nothing but fields and plain managers, and both are
             idempotent: a seat that already has an item is skipped, and a
             marked item is left as it is.

             Three things the roster holds are not what they look like, and are
             not copied as they stand:
             - the 0 the old project creation gave its creator's own seat, which
               nobody decided — it is no item, not volunteer work;
             - an unpaid fee on a cancelled project, which nobody will pay — a
               paid one is a payment and is copied;
             - an artist merge's folded seat, paid and removed, whose fee the
               merge copied onto the survivor's seat without its paid flag — the
               payment is copied onto the survivor's seat, once.
@architecture Enterprise SaaS 2026
@module finance/data_copy
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Q
from django.utils import timezone

from roster.models import Project

from .models import CostKind, FeeForm, FinanceAction
from .rules import (
    FINANCE_TIMEZONE,
    cast_payee_role,
    category_for_specialty,
    cost_for,
    crew_payee_role,
    full_name,
    local_date,
)
from .services.audit import snapshot

# The old project creation made the creator's seat, with its fee of 0, in the
# transaction that created the project. A seat created later was cast by hand,
# and a 0 on it was somebody's decision.
_CREATOR_SEAT_WINDOW = timedelta(seconds=5)


@dataclass
class CopyReport:
    budgets: int = 0
    items: int = 0
    paid: int = 0
    # Rows the roster marked paid that the ledger cannot hold as paid (no fee, or
    # a fee of 0 — nothing leaves the foundation for volunteer work). They are
    # copied unpaid and the roster's flag is kept in the IMPORTED event.
    paid_flag_dropped: int = 0
    skipped_existing: int = 0
    skipped_creator_seats: int = 0
    skipped_cancelled: int = 0
    # Folded seats whose payment went onto the survivor's seat.
    merged_payments: int = 0


@dataclass(frozen=True)
class _RosterFee:
    """What the roster says a seat or a crew assignment is owed and was paid."""

    fee: Decimal | None
    is_paid: bool
    paid_at: datetime | None
    # When the row last changed: the payment date of a seat marked paid
    # without a timestamp. A crew assignment has none.
    paid_fallback: datetime | None


def _paid_on(roster: _RosterFee, concert_day: date) -> tuple[date, datetime | None, str]:
    """The payment date, the moment it was marked, and where they came from.
    The roster's `paid_at` first; a seat marked paid without one falls back to
    when its row last changed; a crew assignment has no such timestamp, so it
    falls back to the concert date and no moment. The date is the office's
    calendar day, as every payment the ledger records is, wherever the concert
    was."""
    for moment, origin in ((roster.paid_at, "paid_at"), (roster.paid_fallback, "updated_at")):
        if moment is not None:
            return timezone.localtime(moment, FINANCE_TIMEZONE).date(), moment, origin
    return concert_day, None, "concert_date"


def _copy_one(
    *,
    apps: Any,
    report: CopyReport,
    budgets: dict[Any, Any],
    project: Any,
    roster: _RosterFee,
    source_field: str,
    source: Any,
    category: str,
    payee_name: str,
    payee_role: str,
    merged_from: Any = None,
) -> None:
    ProjectBudget = apps.get_model("finance", "ProjectBudget")
    CostItem = apps.get_model("finance", "CostItem")
    FinanceEvent = apps.get_model("finance", "FinanceEvent")

    fee = roster.fee
    form = FeeForm.DZIELO
    if fee is not None and fee == 0:
        form = FeeForm.VOLUNTEER
    contract_amount = Decimal("0.00") if form == FeeForm.VOLUNTEER else fee
    payable = roster.is_paid and contract_amount is not None and contract_amount > 0

    if project.status == Project.Status.CANCELLED and not payable:
        report.skipped_cancelled += 1
        return

    budget = budgets.get(project.pk)
    if budget is None:
        budget, created = ProjectBudget._base_manager.get_or_create(project_id=project.pk)
        budgets[project.pk] = budget
        report.budgets += int(created)

    concert_day = local_date(project.date_time, project.timezone)
    paid_on: date | None = None
    paid_marked_at: datetime | None = None
    paid_on_source = ""
    if payable:
        paid_on, paid_marked_at, paid_on_source = _paid_on(roster, concert_day)
    elif roster.is_paid:
        report.paid_flag_dropped += 1

    item = CostItem._base_manager.create(
        budget=budget,
        kind=CostKind.FEE,
        category=category,
        form=form,
        contract_amount=contract_amount,
        cost_amount=cost_for(form, contract_amount, None),
        incurred_on=concert_day,
        paid_on=paid_on,
        paid_marked_at=paid_marked_at,
        payee_name=payee_name,
        payee_role=payee_role,
        **{source_field: source},
    )
    before: dict[str, object] = {"fee": fee, "is_paid": roster.is_paid, "paid_at": roster.paid_at}
    if merged_from is not None:
        before["merged_from"] = merged_from.pk
    FinanceEvent._base_manager.create(
        budget=budget,
        actor=None,
        subject_type="cost_item",
        subject_id=item.pk,
        action=FinanceAction.IMPORTED,
        before=snapshot(before),
        after=snapshot({
            "form": form,
            "contract_amount": contract_amount,
            "paid_on": paid_on,
            "paid_on_source": paid_on_source,
        }),
    )
    report.items += 1
    report.paid += int(paid_on is not None)


def _name_key(artist: Any) -> tuple[str, str]:
    return (artist.first_name.strip().casefold(), artist.last_name.strip().casefold())


def _merge_folds(Participation: Any) -> dict[Any, Any]:
    """Survivor seat pk → the folded seat whose payment belongs on it.

    The old artist merge soft-deleted the duplicate artist and its seat on every
    project both were cast in, and copied the folded seat's fee onto the
    survivor's seat when that one had none — without the paid flag. A fold is
    a paid, removed seat of a removed artist that has exactly one live, unpaid
    seat on the same project at the same fee, cast to a live artist of the same
    name. Anything less certain is copied as it stands: a false match would
    mark somebody paid who was not."""
    folds: dict[Any, Any] = {}
    folded_seats = (
        Participation._base_manager
        .filter(is_deleted=True, is_paid=True, fee__gt=0, artist__is_deleted=True)
        .select_related("artist")
        .order_by("created_at")
    )
    for folded in folded_seats:
        name = _name_key(folded.artist)
        survivors = [
            seat
            for seat in Participation._base_manager
            .filter(
                project_id=folded.project_id, is_deleted=False, is_paid=False, fee=folded.fee,
                artist__is_deleted=False,
            )
            .select_related("artist")
            if _name_key(seat.artist) == name
        ]
        if len(survivors) == 1 and survivors[0].pk not in folds:
            folds[survivors[0].pk] = folded
    return folds


def copy_roster_fees(apps: Any) -> CopyReport:
    """Every seat and crew assignment with a fee or a paid flag becomes a FEE
    item, except as the module header lists.

    The form is VOLUNTEER for a fee of 0 and DZIELO otherwise — the umowa o dzieło
    every legacy contract was printed as. Soft-deleted seats are copied too: a
    payment made to somebody later removed from the cast is still a payment, and
    the ledger shows it as counted (paid) or as work (unpaid). `_base_manager`
    everywhere, because it is the unfiltered manager on every model it is
    handed, whatever managers that model declares.
    """
    Participation = apps.get_model("roster", "Participation")
    CrewAssignment = apps.get_model("roster", "CrewAssignment")
    CostItem = apps.get_model("finance", "CostItem")

    report = CopyReport()
    budgets: dict[Any, Any] = {}
    has_fee = Q(fee__isnull=False) | Q(is_paid=True)

    folds = _merge_folds(Participation)
    folded_pks = {folded.pk for folded in folds.values()}
    copied_seats = set(
        CostItem._base_manager.filter(participation__isnull=False).values_list("participation_id", flat=True)
    )
    seats = Participation._base_manager.filter(has_fee).select_related("artist", "project").order_by("created_at")
    for seat in seats:
        if seat.pk in copied_seats:
            report.skipped_existing += 1
            continue
        if seat.pk in folded_pks:
            continue
        folded = folds.get(seat.pk)
        if folded is not None:
            roster = _RosterFee(fee=folded.fee, is_paid=True, paid_at=folded.paid_at, paid_fallback=folded.updated_at)
            report.merged_payments += 1
        else:
            if seat.fee == 0 and abs(seat.created_at - seat.project.created_at) <= _CREATOR_SEAT_WINDOW:
                report.skipped_creator_seats += 1
                continue
            roster = _RosterFee(fee=seat.fee, is_paid=seat.is_paid, paid_at=seat.paid_at, paid_fallback=seat.updated_at)
        artist = seat.artist
        _copy_one(
            apps=apps, report=report, budgets=budgets, project=seat.project, roster=roster,
            source_field="participation", source=seat,
            category="PERSONNEL_ARTISTIC",
            payee_name=full_name(artist.first_name, artist.last_name),
            payee_role=cast_payee_role(artist.voice_type, artist.instrument),
            merged_from=folded,
        )

    copied_crew = set(
        CostItem._base_manager.filter(crew_assignment__isnull=False).values_list("crew_assignment_id", flat=True)
    )
    crew = CrewAssignment._base_manager.filter(has_fee).select_related("collaborator", "project").order_by("pk")
    for assignment in crew:
        if assignment.pk in copied_crew:
            report.skipped_existing += 1
            continue
        collaborator = assignment.collaborator
        _copy_one(
            apps=apps, report=report, budgets=budgets, project=assignment.project,
            roster=_RosterFee(
                fee=assignment.fee, is_paid=assignment.is_paid, paid_at=assignment.paid_at, paid_fallback=None,
            ),
            source_field="crew_assignment", source=assignment,
            category=str(category_for_specialty(collaborator.specialty)),
            payee_name=full_name(collaborator.first_name, collaborator.last_name),
            payee_role=crew_payee_role(assignment.role_description, collaborator.specialty),
        )
    return report


def mark_payments_before_ledger(apps: Any) -> int:
    """Marks `paid_before_ledger` on every fee the copy carried over as paid and
    that is still paid, so the ledger stops asking for a contract of its own
    for a payment made on paper (`PAID_WITHOUT_DOCUMENT`). A payment reverted
    since is the ledger's own and stays unmarked. Returns how many it marked."""
    CostItem = apps.get_model("finance", "CostItem")
    FinanceEvent = apps.get_model("finance", "FinanceEvent")

    events = FinanceEvent._base_manager.filter(subject_type="cost_item")
    imported_paid = {
        event.subject_id
        for event in events.filter(action=FinanceAction.IMPORTED)
        if (event.after or {}).get("paid_on")
    }
    reverted = set(events.filter(action=FinanceAction.UNPAID).values_list("subject_id", flat=True))
    marked: int = (
        CostItem._base_manager
        .filter(pk__in=imported_paid - reverted, kind=CostKind.FEE, paid_on__isnull=False, paid_before_ledger=False)
        .update(paid_before_ledger=True)
    )
    return marked
