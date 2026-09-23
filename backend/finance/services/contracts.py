"""
@file contracts.py
@description Contracts as data: issuing one (with its number taken under a row
             lock), recording that the paper was signed and where it is kept,
             confirming a mandate's hours, and annulling. The PDF is rendered
             from the contract row by the documents layer, never from the item,
             so a document always prints its number and the frozen amount.
@architecture Enterprise SaaS 2026
@module finance/services/contracts
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from roster.models import Participation

from ..dtos import SignContractDTO
from ..exceptions import ContractAnnulled, ContractExists, ContractRefused, HoursNotApplicable, SeatNotBillable
from ..models import (
    CONTRACT_FORMS,
    Contract,
    ContractSequence,
    ContractStatus,
    CostItem,
    CostKind,
    FeeForm,
    FinanceAction,
)
from ..rules import contract_number, finance_today
from . import audit
from .budget import BudgetService
from .ledger import has_live_contract, refresh_item


def _next_number(form: str, year: int) -> str:
    """The next number for (form, year). The sequence row stays locked until the
    issuing transaction commits, so two contracts issued at once cannot share one."""
    sequence, _ = ContractSequence.objects.select_for_update().get_or_create(year=year, form=form)
    sequence.last_number += 1
    sequence.save(update_fields=["last_number"])
    return contract_number(form, sequence.last_number, year)


def _locked_contract(contract: Contract) -> Contract:
    """Takes the project's budget lock and re-reads the contract under it."""
    project = contract.cost_item.budget.project
    budget = BudgetService.lock(project)
    BudgetService.assert_writable(budget)
    locked = Contract.objects.select_related("cost_item__budget").get(pk=contract.pk)
    if locked.status == ContractStatus.ANNULLED:
        raise ContractAnnulled()
    return locked


class ContractService:
    @staticmethod
    def issue(item: CostItem, *, actor: User | None) -> Contract:
        with transaction.atomic():
            project = item.budget.project
            budget = BudgetService.lock(project)
            BudgetService.assert_writable(budget)
            item = (
                CostItem.objects.select_related("participation__artist", "crew_assignment__collaborator")
                .get(pk=item.pk)
            )
            if item.kind != CostKind.FEE or item.form not in CONTRACT_FORMS:
                raise ContractRefused(params={"reason": "form", "form": item.form})
            if item.contract_amount is None:
                raise ContractRefused(params={"reason": "unpriced"})
            if has_live_contract(item):
                raise ContractExists()
            seat = item.participation
            if (
                seat is not None
                and item.paid_on is None
                and (seat.is_deleted or seat.status == Participation.Status.DECLINED)
            ):
                raise SeatNotBillable()

            # The last refresh before the snapshot freezes: the paper carries the
            # name as the roster has it at this moment.
            refresh_item(item, project)
            item.save()

            contract = Contract.objects.create(
                cost_item=item,
                number=_next_number(item.form, finance_today().year),
                form=item.form,
                amount=item.contract_amount,
                payee_name=item.payee_name,
                issued_at=timezone.now(),
                issued_by=actor,
            )
            audit.record(
                budget, actor=actor, subject=contract, action=FinanceAction.CONTRACT_ISSUED,
                after={
                    "number": contract.number,
                    "form": contract.form,
                    "amount": contract.amount,
                    "payee_name": contract.payee_name,
                    "cost_item": item.pk,
                },
            )
            return contract

    @staticmethod
    def sign(contract: Contract, dto: SignContractDTO, *, actor: User | None) -> Contract:
        """Records the signed paper: the date written on it and where the copy is.
        Repeating it corrects either; the event keeps the earlier values."""
        with transaction.atomic():
            contract = _locked_contract(contract)
            before = {
                "status": contract.status,
                "signed_on": contract.signed_on,
                "signed_copy_location": contract.signed_copy_location,
            }
            contract.status = ContractStatus.SIGNED
            contract.signed_on = dto.signed_on
            contract.signed_copy_location = dto.signed_copy_location
            contract.save(update_fields=["status", "signed_on", "signed_copy_location", "updated_at"])
            audit.record(
                contract.cost_item.budget, actor=actor, subject=contract, action=FinanceAction.CONTRACT_SIGNED,
                before=before,
                after={
                    "status": contract.status,
                    "signed_on": contract.signed_on,
                    "signed_copy_location": contract.signed_copy_location,
                },
            )
            return contract

    @staticmethod
    def confirm_hours(contract: Contract, hours: Decimal, *, actor: User | None) -> Contract:
        """The hours from the signed confirmation a mandate is paid against."""
        with transaction.atomic():
            contract = _locked_contract(contract)
            if contract.form != FeeForm.ZLECENIE:
                raise HoursNotApplicable()
            before = {"hours_confirmed": contract.hours_confirmed}
            contract.hours_confirmed = hours
            contract.save(update_fields=["hours_confirmed", "updated_at"])
            audit.record(
                contract.cost_item.budget, actor=actor, subject=contract, action=FinanceAction.CONTRACT_HOURS,
                before=before, after={"hours_confirmed": hours},
            )
            return contract

    @staticmethod
    def annul(contract: Contract, *, reason: str, actor: User | None) -> Contract:
        """The board's correction path for a contract. Its number stays spent."""
        with transaction.atomic():
            contract = _locked_contract(contract)
            before = {"status": contract.status}
            contract.status = ContractStatus.ANNULLED
            contract.annulled_at = timezone.now()
            contract.annulled_by = actor
            contract.annul_reason = reason
            contract.save(update_fields=["status", "annulled_at", "annulled_by", "annul_reason", "updated_at"])
            audit.record(
                contract.cost_item.budget, actor=actor, subject=contract, action=FinanceAction.CONTRACT_ANNULLED,
                before=before, after={"status": contract.status}, reason=reason,
            )
            return contract
