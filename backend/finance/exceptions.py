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
