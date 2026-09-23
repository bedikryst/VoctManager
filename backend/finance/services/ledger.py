"""
@file ledger.py
@description The write side of the fee ledger: pricing (one atomic batch with an
             optional standard rate), one-off payees, bookkeeping details, paying
             and reverting a payment, releasing a crew member's fee when they are
             unassigned, and moving a seat's fee when an artist merge folds it.
             Every rule of spec §5.1 that the database cannot
             state is enforced here, and every change is logged.
@architecture Enterprise SaaS 2026
@module finance/services/ledger
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from roster.models import CrewAssignment, Participation, Project

from ..dtos import CostItemDetailsDTO, FeeBatchDTO, FeeItemDTO, FeeRefDTO, OneOffFeeDTO, PayFeesDTO
from ..exceptions import (
    CrewHasSettledFee,
    FinanceError,
    InvalidItemChange,
    ItemContracted,
    ItemPaid,
    NotPaid,
    PaymentRefused,
    SeatNotBillable,
    UnknownFeeReference,
)
from ..models import (
    BudgetStatus,
    Contract,
    ContractStatus,
    CostItem,
    CostKind,
    FeeForm,
    FinanceAction,
    ProjectBudget,
)
from ..rules import (
    Pricing,
    category_for,
    cost_for,
    default_form_for,
    local_date,
    money,
    one_off_fallback_form,
    payee_snapshot,
    reconcile_pricing,
)
from . import audit
from .budget import BudgetService

# The fields a paid item or an issued contract freezes. Contributions and the
# volunteer valuation stay editable: the office reports contributions after the
# payment, and neither changes what the paper says.
_FROZEN_PRICING_FIELDS = frozenset({"form", "contract_amount"})
_OPTIONAL_PRICING_FIELDS = ("employer_contributions", "in_kind_hours", "in_kind_hourly_rate")
_ONE_OFF_ONLY_FIELDS = frozenset({"payee_name", "payee_role", "category"})
_TEXT_DETAIL_FIELDS = frozenset({"payee_role", "note", "document_number", "vendor_nip"})

# Forms the standard rate never overwrites: a volunteer's 0 is a decision, and an
# invoice's amount is the vendor's gross, not a rate of ours.
_STANDARD_RATE_SKIPS = frozenset({FeeForm.VOLUNTEER, FeeForm.INVOICE})


@dataclass
class _Row:
    """A ledger row as a write sees it: the item if one exists, and its source."""

    item: CostItem | None
    participation: Participation | None
    crew_assignment: CrewAssignment | None
    billable: bool

    @property
    def source(self) -> Participation | CrewAssignment | None:
        return self.participation or self.crew_assignment


def has_live_contract(item: CostItem) -> bool:
    if item._state.adding:
        return False
    return Contract.objects.filter(cost_item=item).exclude(status=ContractStatus.ANNULLED).exists()


def refresh_item(item: CostItem, project: Project) -> None:
    """Re-derive what the ledger owns: the payee snapshot from the roster while
    no contract freezes it, the concert date while the fee is unpaid, and the
    foundation's cost from the amount and the form."""
    source: Participation | CrewAssignment | None = item.participation or item.crew_assignment
    if source is not None and not has_live_contract(item):
        item.payee_name, item.payee_role = payee_snapshot(source)
    if item.kind == CostKind.FEE and item.paid_on is None:
        item.incurred_on = local_date(project.date_time, project.timezone)
    item.cost_amount = cost_for(item.form, item.contract_amount, item.employer_contributions)


def _to_grosz(value: Decimal | None) -> Decimal | None:
    """Two decimal places, as stored — so the log records "350.00", not "350"."""
    return None if value is None else money(value)


def _is_billable_seat(seat: Participation) -> bool:
    return not seat.is_deleted and seat.status != Participation.Status.DECLINED


def _resolve(budget: ProjectBudget, project: Project, ref: FeeRefDTO) -> _Row:
    if ref.participation is not None:
        seat = (
            Participation.all_objects.select_related('artist')
            .filter(project=project, pk=ref.participation)
            .first()
        )
        if seat is None:
            raise UnknownFeeReference()
        item = CostItem.objects.filter(kind=CostKind.FEE, participation=seat).first()
        return _Row(item=item, participation=seat, crew_assignment=None, billable=_is_billable_seat(seat))
    if ref.crew_assignment is not None:
        assignment = (
            CrewAssignment.objects.select_related('collaborator')
            .filter(project=project, pk=ref.crew_assignment)
            .first()
        )
        if assignment is None:
            raise UnknownFeeReference()
        item = CostItem.objects.filter(kind=CostKind.FEE, crew_assignment=assignment).first()
        return _Row(item=item, participation=None, crew_assignment=assignment, billable=True)
    if ref.cost_item is None:
        raise UnknownFeeReference()
    item = (
        CostItem.objects.select_related('participation__artist', 'crew_assignment__collaborator')
        .filter(kind=CostKind.FEE, budget=budget, pk=ref.cost_item)
        .first()
    )
    if item is None:
        raise UnknownFeeReference()
    billable = item.participation is None or _is_billable_seat(item.participation)
    return _Row(
        item=item, participation=item.participation, crew_assignment=item.crew_assignment, billable=billable,
    )


def _fallback_form(row: _Row) -> str:
    source = row.source
    if source is not None:
        return default_form_for(source)
    assert row.item is not None  # a row without a source is a one-off, which has an item
    return one_off_fallback_form(row.item.category)


def _apply_pricing(
    budget: ProjectBudget,
    project: Project,
    row: _Row,
    *,
    requested_form: str | None,
    requested_amount: Decimal | None,
    optional: dict[str, Decimal | None],
    actor: User | None,
) -> None:
    """Price one row. ``optional`` carries only the optional money fields the
    client actually sent; anything absent keeps its stored value."""
    item = row.item
    fallback = _fallback_form(row)
    if item is None and not row.billable:
        raise SeatNotBillable()

    current = Pricing(item.form, item.contract_amount) if item is not None else Pricing(fallback, None)
    pricing = reconcile_pricing(
        current, requested_form=requested_form, requested_amount=_to_grosz(requested_amount),
        fallback_form=fallback,
    )
    new: dict[str, Any] = {"form": pricing.form, "contract_amount": pricing.contract_amount}
    for name in _OPTIONAL_PRICING_FIELDS:
        if name in optional:
            new[name] = _to_grosz(optional[name])
        else:
            new[name] = getattr(item, name) if item is not None else None
    if pricing.form != FeeForm.ZLECENIE:
        new["employer_contributions"] = None
    if pricing.form != FeeForm.VOLUNTEER:
        new["in_kind_hours"] = None
        new["in_kind_hourly_rate"] = None

    if item is not None:
        old: dict[str, Any] = {name: getattr(item, name) for name in new}
    else:
        old = {name: None for name in new}
        old["form"] = fallback
    changed = {name for name in new if new[name] != old[name]}
    if not changed:
        return

    if item is None:
        source = row.source
        assert source is not None  # a new row is always a roster row; one-offs are created elsewhere
        item = CostItem(
            budget=budget,
            kind=CostKind.FEE,
            participation=row.participation,
            crew_assignment=row.crew_assignment,
            category=category_for(source),
            incurred_on=local_date(project.date_time, project.timezone),
        )
    else:
        frozen = changed & _FROZEN_PRICING_FIELDS
        if frozen and item.paid_on is not None:
            raise ItemPaid(params={"fields": sorted(frozen)})
        if frozen and has_live_contract(item):
            raise ItemContracted(params={"fields": sorted(frozen)})

    for name, value in new.items():
        setattr(item, name, value)
    refresh_item(item, project)
    item.save()

    if "form" in changed:
        audit.record(
            budget, actor=actor, subject=item, action=FinanceAction.FORM_CHANGED,
            before={"form": old["form"]}, after={"form": new["form"]},
        )
    money_changed = sorted(changed - {"form"})
    if money_changed:
        audit.record(
            budget, actor=actor, subject=item, action=FinanceAction.PRICED,
            before={name: old[name] for name in money_changed},
            after={name: new[name] for name in money_changed},
        )


def _optional_fields(entry: FeeItemDTO) -> dict[str, Decimal | None]:
    return {name: getattr(entry, name) for name in _OPTIONAL_PRICING_FIELDS if name in entry.model_fields_set}


def _items_by_source(budget: ProjectBudget) -> tuple[dict[Any, CostItem], dict[Any, CostItem]]:
    items = list(CostItem.objects.filter(budget=budget, kind=CostKind.FEE))
    by_seat = {item.participation_id: item for item in items if item.participation_id is not None}
    by_crew = {item.crew_assignment_id: item for item in items if item.crew_assignment_id is not None}
    return by_seat, by_crew


def _takes_standard_rate(row: _Row) -> bool:
    item = row.item
    form = item.form if item is not None else _fallback_form(row)
    if form in _STANDARD_RATE_SKIPS:
        return False
    return item is None or (item.paid_on is None and not has_live_contract(item))


class LedgerService:
    @staticmethod
    def apply_fee_batch(project: Project, dto: FeeBatchDTO, *, actor: User | None) -> None:
        """The standard rate first, then the rows, in one transaction. A refused
        row names itself (``index``, ``ref``) and nothing at all is written."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)

            rate = dto.standard_rate
            if rate is not None and (rate.cast is not None or rate.crew is not None):
                by_seat, by_crew = _items_by_source(budget)
                rows: list[tuple[_Row, Decimal]] = []
                if rate.cast is not None:
                    seats = (
                        Participation.objects.filter(project=project)
                        .exclude(status=Participation.Status.DECLINED)
                        .select_related('artist')
                    )
                    rows += [
                        (_Row(item=by_seat.get(seat.pk), participation=seat, crew_assignment=None, billable=True),
                         rate.cast)
                        for seat in seats
                    ]
                if rate.crew is not None:
                    crew = CrewAssignment.objects.filter(project=project).select_related('collaborator')
                    rows += [
                        (_Row(item=by_crew.get(assignment.pk), participation=None, crew_assignment=assignment,
                              billable=True),
                         rate.crew)
                        for assignment in crew
                    ]
                for row, amount in rows:
                    if _takes_standard_rate(row):
                        _apply_pricing(
                            budget, project, row,
                            requested_form=None, requested_amount=amount, optional={}, actor=actor,
                        )

            for index, entry in enumerate(dto.items):
                try:
                    row = _resolve(budget, project, entry.ref)
                    _apply_pricing(
                        budget, project, row,
                        requested_form=entry.form,
                        requested_amount=entry.contract_amount,
                        optional=_optional_fields(entry),
                        actor=actor,
                    )
                except FinanceError as exc:
                    exc.params.setdefault("index", index)
                    exc.params.setdefault("ref", str(entry.ref.key))
                    raise

    @staticmethod
    def create_one_off(project: Project, dto: OneOffFeeDTO, *, actor: User | None) -> CostItem:
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            pricing = reconcile_pricing(
                Pricing("", None),
                requested_form=dto.form,
                requested_amount=_to_grosz(dto.contract_amount),
                fallback_form=one_off_fallback_form(dto.category),
            )
            is_zlecenie = pricing.form == FeeForm.ZLECENIE
            is_volunteer = pricing.form == FeeForm.VOLUNTEER
            item = CostItem(
                budget=budget,
                kind=CostKind.FEE,
                category=dto.category,
                payee_name=dto.payee_name,
                payee_role=dto.payee_role,
                form=pricing.form,
                contract_amount=pricing.contract_amount,
                employer_contributions=_to_grosz(dto.employer_contributions) if is_zlecenie else None,
                in_kind_hours=_to_grosz(dto.in_kind_hours) if is_volunteer else None,
                in_kind_hourly_rate=_to_grosz(dto.in_kind_hourly_rate) if is_volunteer else None,
                incurred_on=local_date(project.date_time, project.timezone),
                due_on=dto.due_on,
                note=dto.note,
                document_number=dto.document_number,
                document_date=dto.document_date,
                vendor_nip=dto.vendor_nip,
            )
            refresh_item(item, project)
            item.save()
            audit.record(
                budget, actor=actor, subject=item, action=FinanceAction.CREATED,
                after={
                    "payee_name": item.payee_name,
                    "category": item.category,
                    "form": item.form,
                    "contract_amount": item.contract_amount,
                },
            )
            return item

    @staticmethod
    def update_details(item: CostItem, dto: CostItemDetailsDTO, *, actor: User | None) -> CostItem:
        with transaction.atomic():
            project = item.budget.project
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.select_for_update().get(pk=item.pk)

            requested = {name: getattr(dto, name) for name in dto.model_fields_set}
            for name in _TEXT_DETAIL_FIELDS & requested.keys():
                if requested[name] is None:
                    requested[name] = ""
            if "payee_name" in requested and requested["payee_name"] is None:
                raise InvalidItemChange(params={"fields": ["payee_name"]})
            if "category" in requested and requested["category"] is None:
                raise InvalidItemChange(params={"fields": ["category"]})

            changed = {name: value for name, value in requested.items() if getattr(item, name) != value}
            if not changed:
                return item
            identity = sorted(changed.keys() & _ONE_OFF_ONLY_FIELDS)
            if identity:
                if not item.is_one_off:
                    raise InvalidItemChange(params={"fields": identity})
                if item.paid_on is not None:
                    raise ItemPaid(params={"fields": identity})
                if has_live_contract(item):
                    raise ItemContracted(params={"fields": identity})

            before = {name: getattr(item, name) for name in changed}
            for name, value in changed.items():
                setattr(item, name, value)
            refresh_item(item, project)
            item.save()
            audit.record(
                budget, actor=actor, subject=item, action=FinanceAction.DETAILS_CHANGED,
                before=before, after=changed,
            )
            return item

    @staticmethod
    def pay(project: Project, dto: PayFeesDTO, *, actor: User | None) -> list[CostItem]:
        """All or nothing: an unpriced, volunteer, already-paid or foreign id
        refuses the whole call and names every one of them."""
        with transaction.atomic():
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            items = {
                item.pk: item
                for item in CostItem.objects.filter(budget=budget, kind=CostKind.FEE, pk__in=dto.ids)
            }
            refused: list[dict[str, str]] = []
            for item_id in dto.ids:
                item = items.get(item_id)
                reason = ""
                if item is None:
                    reason = "unknown"
                elif item.contract_amount is None:
                    reason = "unpriced"
                elif item.form == FeeForm.VOLUNTEER:
                    reason = "volunteer"
                elif item.paid_on is not None:
                    reason = "already_paid"
                if reason:
                    refused.append({"id": str(item_id), "reason": reason})
            if refused:
                raise PaymentRefused(params={"refused": refused})

            marked_at = timezone.now()
            paid: list[CostItem] = []
            for item_id in dto.ids:
                item = items[item_id]
                item.paid_on = dto.paid_on
                item.paid_marked_by = actor
                item.paid_marked_at = marked_at
                item.save(update_fields=["paid_on", "paid_marked_by", "paid_marked_at", "updated_at"])
                audit.record(
                    budget, actor=actor, subject=item, action=FinanceAction.PAID,
                    after={"paid_on": item.paid_on, "cost_amount": item.cost_amount},
                )
                paid.append(item)
            return paid

    @staticmethod
    def unpay(item: CostItem, *, reason: str, actor: User | None) -> CostItem:
        """The board's correction path: the payment is reverted, with a reason,
        so the amount can be edited again. The event keeps what was undone."""
        with transaction.atomic():
            budget = BudgetService.lock(item.budget.project)
            BudgetService.assert_writable(budget)
            item = CostItem.objects.select_for_update().get(pk=item.pk)
            if item.paid_on is None:
                raise NotPaid()
            before = {
                "paid_on": item.paid_on,
                "paid_marked_by": item.paid_marked_by_id,
                "paid_marked_at": item.paid_marked_at,
            }
            item.paid_on = None
            item.paid_marked_by = None
            item.paid_marked_at = None
            item.save(update_fields=["paid_on", "paid_marked_by", "paid_marked_at", "updated_at"])
            audit.record(
                budget, actor=actor, subject=item, action=FinanceAction.UNPAID,
                before=before, after={"paid_on": None}, reason=reason,
            )
            return item

    @staticmethod
    def release_crew_assignment(assignment: CrewAssignment, *, actor: User | None) -> None:
        """Called before a crew assignment is deleted.

        An unpaid, uncontracted fee goes with the assignment: it is detached and
        soft-deleted, and the event keeps what it was. A paid or contracted one
        refuses the removal — that fee is an accounting record, and the person
        has to be unpaid or their contract annulled first. `all_objects`, because
        the foreign key protects soft-deleted rows too.
        """
        with transaction.atomic():
            items = list(CostItem.all_objects.filter(crew_assignment=assignment))
            if not items:
                return
            live = set(
                Contract.objects.filter(cost_item__in=items)
                .exclude(status=ContractStatus.ANNULLED)
                .values_list("cost_item_id", flat=True)
            )
            settled = [
                item for item in items
                if not item.is_deleted and (item.paid_on is not None or item.pk in live)
            ]
            if settled:
                raise CrewHasSettledFee(params={"cost_item_ids": [str(item.pk) for item in settled]})

            budget = BudgetService.lock(assignment.project)
            BudgetService.assert_writable(budget)
            for item in items:
                was_active = not item.is_deleted
                item.crew_assignment = None
                item.is_deleted = True
                item.save(update_fields=["crew_assignment", "is_deleted", "updated_at"])
                if was_active:
                    audit.record(
                        budget, actor=actor, subject=item, action=FinanceAction.REMOVED,
                        before={
                            "crew_assignment": assignment.pk,
                            "form": item.form,
                            "contract_amount": item.contract_amount,
                        },
                    )

    @staticmethod
    def fold_seat(source: Participation, target: Participation, *, actor: User | None) -> bool:
        """Called when an artist merge folds the duplicate's seat into the
        survivor's seat on the same project, before the folded seat leaves.

        The duplicate's fee moves to the survivor's seat when that seat has none,
        so the person keeps one priced row, paid or contracted as it was. It stays
        on the folded seat when the survivor has a fee of its own — money is not
        something a cleanup chooses between — or when the budget is closed. The
        answer is True in those two cases, so the merge can say where to look.
        """
        with transaction.atomic():
            if not CostItem.objects.filter(participation=source).exists():
                return False
            budget = BudgetService.lock(target.project)
            item = CostItem.objects.select_for_update().get(participation=source)
            if budget.status == BudgetStatus.CLOSED or CostItem.objects.filter(participation=target).exists():
                return True
            item.participation = target
            refresh_item(item, target.project)
            item.save()
            audit.record(
                budget, actor=actor, subject=item, action=FinanceAction.DETAILS_CHANGED,
                before={"participation": source.pk}, after={"participation": target.pk},
            )
            return False
