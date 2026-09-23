"""
@file data_copy.py
@description Copies the fees still held on the roster (`Participation` and
             `CrewAssignment`: `fee`, `is_paid`, `paid_at`) into FEE cost items,
             with a budget for every project it touches. Run by migration
             `finance/0002` against the historical models it is handed, and by
             the tests against the live ones — so it reads nothing but fields
             and plain managers, and it is idempotent: a seat that already has
             an item is skipped.
@architecture Enterprise SaaS 2026
@module finance/data_copy
"""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from django.db.models import Q

from .models import CostKind, FeeForm, FinanceAction
from .rules import (
    cast_payee_role,
    category_for_specialty,
    cost_for,
    crew_payee_role,
    full_name,
    local_date,
)
from .services.audit import snapshot


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


def _paid_on(paid_at: datetime | None, fallback: datetime | None, concert_day: date, tz_name: str) -> tuple[date, str]:
    """The payment date and where it came from. The roster's `paid_at` first; a
    seat marked paid without one falls back to when its row last changed; a crew
    assignment has no such timestamp, so it falls back to the concert date."""
    if paid_at is not None:
        return local_date(paid_at, tz_name), "paid_at"
    if fallback is not None:
        return local_date(fallback, tz_name), "updated_at"
    return concert_day, "concert_date"


def _copy_one(
    *,
    apps: Any,
    report: CopyReport,
    budgets: dict[Any, Any],
    project: Any,
    fee: Decimal | None,
    is_paid: bool,
    paid_at: datetime | None,
    paid_fallback: datetime | None,
    source_field: str,
    source: Any,
    category: str,
    payee_name: str,
    payee_role: str,
) -> None:
    ProjectBudget = apps.get_model("finance", "ProjectBudget")
    CostItem = apps.get_model("finance", "CostItem")
    FinanceEvent = apps.get_model("finance", "FinanceEvent")

    budget = budgets.get(project.pk)
    if budget is None:
        budget, created = ProjectBudget._base_manager.get_or_create(project_id=project.pk)
        budgets[project.pk] = budget
        report.budgets += int(created)

    concert_day = local_date(project.date_time, project.timezone)
    form = FeeForm.DZIELO
    if fee is not None and fee == 0:
        form = FeeForm.VOLUNTEER
    contract_amount = Decimal("0.00") if form == FeeForm.VOLUNTEER else fee

    paid_on: date | None = None
    paid_on_source = ""
    if is_paid and contract_amount is not None and contract_amount > 0:
        paid_on, paid_on_source = _paid_on(paid_at, paid_fallback, concert_day, project.timezone)
    elif is_paid:
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
        payee_name=payee_name,
        payee_role=payee_role,
        **{source_field: source},
    )
    FinanceEvent._base_manager.create(
        budget=budget,
        actor=None,
        subject_type="cost_item",
        subject_id=item.pk,
        action=FinanceAction.IMPORTED,
        before=snapshot({"fee": fee, "is_paid": is_paid, "paid_at": paid_at}),
        after=snapshot({
            "form": form,
            "contract_amount": contract_amount,
            "paid_on": paid_on,
            "paid_on_source": paid_on_source,
        }),
    )
    report.items += 1
    report.paid += int(paid_on is not None)


def copy_roster_fees(apps: Any) -> CopyReport:
    """Every seat and crew assignment with a fee or a paid flag becomes a FEE item.

    The form is VOLUNTEER for a fee of 0 and DZIELO otherwise — the umowa o dzieło
    every legacy contract was printed as. Soft-deleted seats are copied too: a
    payment made to somebody later removed from the cast is still a payment, and
    the ledger shows it as counted (paid) or as work (unpaid). `_base_manager`
    everywhere, because it is the unfiltered manager on both the historical
    models and the live ones.
    """
    Participation = apps.get_model("roster", "Participation")
    CrewAssignment = apps.get_model("roster", "CrewAssignment")
    CostItem = apps.get_model("finance", "CostItem")

    report = CopyReport()
    budgets: dict[Any, Any] = {}
    has_fee = Q(fee__isnull=False) | Q(is_paid=True)

    copied_seats = set(
        CostItem._base_manager.filter(participation__isnull=False).values_list("participation_id", flat=True)
    )
    seats = Participation._base_manager.filter(has_fee).select_related("artist", "project").order_by("created_at")
    for seat in seats:
        if seat.pk in copied_seats:
            report.skipped_existing += 1
            continue
        artist = seat.artist
        _copy_one(
            apps=apps, report=report, budgets=budgets, project=seat.project,
            fee=seat.fee, is_paid=seat.is_paid, paid_at=seat.paid_at, paid_fallback=seat.updated_at,
            source_field="participation", source=seat,
            category="PERSONNEL_ARTISTIC",
            payee_name=full_name(artist.first_name, artist.last_name),
            payee_role=cast_payee_role(artist.voice_type, artist.instrument),
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
            fee=assignment.fee, is_paid=assignment.is_paid, paid_at=assignment.paid_at, paid_fallback=None,
            source_field="crew_assignment", source=assignment,
            category=str(category_for_specialty(collaborator.specialty)),
            payee_name=full_name(collaborator.first_name, collaborator.last_name),
            payee_role=crew_payee_role(assignment.role_description, collaborator.specialty),
        )
    return report
