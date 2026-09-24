"""
@file exceptions.py
@description The refusals of the finance services. Each carries a stable
             snake_case `code` the client maps to its own words, and `params`
             naming what was refused (the offending batch row, the ids a
             payment could not cover). The views render them through the
             canonical error envelope with the params attached.
@architecture Enterprise SaaS 2026
@module finance/exceptions
"""
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import CoreDomainException, make_error_response


class FinanceError(CoreDomainException):
    code = "finance_error"
    default_message = "This change to the ledger is not allowed."
    status_code = 400

    def __init__(self, message: str = "", *, params: dict[str, Any] | None = None) -> None:
        super().__init__(message or self.default_message)
        self.params: dict[str, Any] = params or {}


def finance_error_response(request: Request, exc: FinanceError) -> Response:
    """The canonical error envelope with the refusal's params attached. Used by
    every view that calls a finance service, the roster's crew removal included."""
    response = make_error_response(request, status_code=exc.status_code, error_code=exc.code, detail=str(exc))
    if exc.params:
        response.data["params"] = exc.params
    return response


class BudgetLocked(FinanceError):
    code = "budget_locked"
    default_message = "The budget is closed; reopen it before changing anything."


class UnknownFeeReference(FinanceError):
    code = "unknown_fee_reference"
    default_message = "The row does not belong to this project."


class SeatNotBillable(FinanceError):
    code = "seat_not_billable"
    default_message = "A declined or removed seat cannot be priced."


class ItemPaid(FinanceError):
    code = "item_paid"
    default_message = "A paid item cannot change its amount, form or payee; revert the payment first."


class ItemContracted(FinanceError):
    code = "item_contracted"
    default_message = "An issued contract freezes the amount, form and payee; annul it first."


class InvalidItemChange(FinanceError):
    code = "invalid_item_change"
    default_message = "This field cannot be changed on this item."


class PaymentRefused(FinanceError):
    code = "payment_refused"
    default_message = "Some of the items cannot be marked paid; nothing was changed."


class NotPaid(FinanceError):
    code = "not_paid"
    default_message = "The item is not marked paid."


class ContractRefused(FinanceError):
    code = "contract_refused"
    default_message = "A contract cannot be issued for this item."


class ContractExists(FinanceError):
    code = "contract_exists"
    default_message = "The item already has a contract; annul it before issuing another."


class ContractAnnulled(FinanceError):
    code = "contract_annulled"
    default_message = "The contract is annulled."


class HoursNotApplicable(FinanceError):
    code = "hours_not_applicable"
    default_message = "Hours are confirmed for a contract of mandate only."


class BillNotApplicable(FinanceError):
    code = "bill_not_applicable"
    default_message = "A bill belongs to a contract for a specific work or of mandate; volunteer work has none."


class CrewHasSettledFee(FinanceError):
    code = "crew_has_settled_fee"
    default_message = "This crew member has a paid or contracted fee; revert the payment or annul the contract first."
    status_code = 409


class FeeNotOrphaned(FinanceError):
    code = "fee_not_orphaned"
    default_message = "Only the fee of a declined or removed cast member can be released; this one still counts."


class PaidItemNotRemovable(FinanceError):
    code = "item_paid_not_removable"
    default_message = "A paid item cannot be removed; revert the payment first."


class PlanLocked(FinanceError):
    code = "plan_locked"
    default_message = "The plan is approved; the board reopens it for a correction."


class UnknownPlanLine(FinanceError):
    code = "unknown_plan_line"
    default_message = "The plan line does not belong to this budget."


class PlanLineCategoryMismatch(FinanceError):
    code = "plan_line_category_mismatch"
    default_message = "A cost is charged to a plan line of its own category."


class LineOrderMismatch(FinanceError):
    code = "line_order_mismatch"
    default_message = "The new order must name every line of the plan exactly once."


class PlanAmountTooLarge(FinanceError):
    code = "plan_amount_too_large"
    default_message = "Quantity times unit cost exceeds the largest amount the ledger holds."


class BudgetTransitionRefused(FinanceError):
    code = "budget_transition_refused"
    default_message = "The budget cannot move to that state from where it is."


class BudgetHasOpenItems(FinanceError):
    code = "budget_has_open_items"
    default_message = "The budget still has unpaid, unpriced or orphaned items; settle them before closing."


class AttachmentNotAllowed(FinanceError):
    code = "attachment_not_allowed"
    default_message = "Files are kept with expenses only."


class AttachmentMissing(FinanceError):
    code = "attachment_missing"
    default_message = "No file was sent."


class AttachmentTooLarge(FinanceError):
    code = "attachment_too_large"
    default_message = "The file is larger than the limit."


class AttachmentTypeNotAllowed(FinanceError):
    code = "attachment_type_not_allowed"
    default_message = "Only PDF files and photographs of a document are kept."


class UnknownFunding(FinanceError):
    code = "unknown_funding"
    default_message = "The funding does not belong to this project."


class UnknownSource(FinanceError):
    code = "unknown_source"
    default_message = "There is no such funding source."


class ChargeRefused(FinanceError):
    code = "charge_refused"
    default_message = "Some of the costs cannot be charged to this source; nothing was changed."


class FundingExists(FinanceError):
    code = "funding_exists"
    default_message = "The source is already on this project."


class FundingInUse(FinanceError):
    code = "funding_in_use"
    default_message = "Costs are charged to this funding; take them off it before removing it."


class SourceInUse(FinanceError):
    code = "source_in_use"
    default_message = "The source funds a project; remove it from every project first."


class EligibilityPeriodInvalid(FinanceError):
    code = "eligibility_period_invalid"
    default_message = "The eligibility period ends before it starts."


class SourceSettled(FinanceError):
    code = "source_settled"
    default_message = "The source is settled; what was charged to it no longer changes."


class AllocationExceedsAmount(FinanceError):
    code = "allocation_exceeds_amount"
    default_message = "The sources would cover more than the amount itself."


class AllocationKindMismatch(FinanceError):
    code = "allocation_kind_mismatch"
    default_message = "Money is charged to a source of money; volunteer work only to a volunteer-work source."


class AllocationNotCounted(FinanceError):
    code = "allocation_not_counted"
    default_message = "Only a counted cost can be charged to a source."


class ReportSourceInvalid(FinanceError):
    code = "report_source_invalid"
    default_message = "A report or export can name only a source of money on this project."
